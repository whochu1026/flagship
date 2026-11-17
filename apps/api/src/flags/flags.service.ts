import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvType, Prisma } from '@prisma/client';
import { evaluateFlag } from '../common/evaluate.util';
import { ProjectsService } from '../projects/projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateFlagDto, EvaluateDto, UpdateFlagDto } from './dto/flag.dto';

@Injectable()
export class FlagsService {
  private readonly cacheTtl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.cacheTtl = Number(config.get('FLAG_CACHE_TTL_SECONDS', 60));
  }

  async list(userId: string, projectId: string, environmentId?: string) {
    await this.projects.assertOwnership(userId, projectId);
    return this.prisma.featureFlag.findMany({
      where: {
        projectId,
        ...(environmentId ? { environmentId } : {}),
      },
      include: { environment: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(
    userId: string,
    projectId: string,
    environmentId: string,
    dto: CreateFlagDto,
  ) {
    await this.projects.assertOwnership(userId, projectId);
    const env = await this.prisma.environment.findFirst({
      where: { id: environmentId, projectId },
    });
    if (!env) throw new NotFoundException('Environment not found');

    try {
      const flag = await this.prisma.featureFlag.create({
        data: {
          projectId,
          environmentId,
          key: dto.key,
          name: dto.name,
          description: dto.description,
          enabled: dto.enabled,
          rolloutPercentage: dto.rolloutPercentage,
          targetUsers: dto.targetUsers as Prisma.InputJsonValue,
        },
      });
      await this.audit(projectId, flag.id, userId, 'CREATE', null, flag);
      await this.invalidateCache(projectId, env.type, flag.key);
      return flag;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Flag key already exists in this environment');
      }
      throw error;
    }
  }

  async update(
    userId: string,
    projectId: string,
    flagId: string,
    dto: UpdateFlagDto,
  ) {
    await this.projects.assertOwnership(userId, projectId);
    const before = await this.prisma.featureFlag.findFirst({
      where: { id: flagId, projectId },
      include: { environment: true },
    });
    if (!before) throw new NotFoundException('Flag not found');

    const flag = await this.prisma.featureFlag.update({
      where: { id: flagId },
      data: {
        name: dto.name,
        description: dto.description,
        enabled: dto.enabled,
        rolloutPercentage: dto.rolloutPercentage,
        targetUsers: dto.targetUsers as Prisma.InputJsonValue | undefined,
      },
      include: { environment: true },
    });

    await this.audit(projectId, flag.id, userId, 'UPDATE', before, flag);
    await this.invalidateCache(projectId, flag.environment.type, flag.key);
    return flag;
  }

  async remove(userId: string, projectId: string, flagId: string) {
    await this.projects.assertOwnership(userId, projectId);
    const before = await this.prisma.featureFlag.findFirst({
      where: { id: flagId, projectId },
      include: { environment: true },
    });
    if (!before) throw new NotFoundException('Flag not found');

    await this.prisma.featureFlag.delete({ where: { id: flagId } });
    await this.audit(projectId, flagId, userId, 'DELETE', before, null);
    await this.invalidateCache(projectId, before.environment.type, before.key);
    return { ok: true };
  }

  async audits(userId: string, projectId: string) {
    await this.projects.assertOwnership(userId, projectId);
    return this.prisma.flagAudit.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: { select: { id: true, email: true, name: true } },
        flag: { select: { id: true, key: true, name: true } },
      },
    });
  }

  /** JWT dashboard evaluate (preview). */
  async evaluatePreview(userId: string, projectId: string, dto: EvaluateDto) {
    await this.projects.assertOwnership(userId, projectId);
    return this.evaluate(projectId, dto);
  }

  /** Public SDK evaluate via API key. */
  async evaluate(projectId: string, dto: EvaluateDto) {
    const cacheKey = `flag:${projectId}:${dto.environment}:${dto.key}`;
    let fromCache = false;
    let flagPayload: {
      key: string;
      enabled: boolean;
      rolloutPercentage: number;
      targetUsers: string[];
    };

    const cached = await this.safeRedisGet(cacheKey);
    if (cached) {
      flagPayload = JSON.parse(cached);
      fromCache = true;
    } else {
      flagPayload = await this.loadFlagPayload(projectId, dto.environment, dto.key);
      await this.safeRedisSet(cacheKey, JSON.stringify(flagPayload), this.cacheTtl);
    }

    const result = evaluateFlag(flagPayload, dto.userId);
    return {
      ...result,
      environment: dto.environment,
      userId: dto.userId ?? null,
      cached: fromCache,
    };
  }

  private async loadFlagPayload(
    projectId: string,
    environment: EvaluateDto['environment'],
    key: string,
  ) {
    const env = await this.prisma.environment.findFirst({
      where: { projectId, type: environment as EnvType },
    });
    if (!env) throw new NotFoundException('Environment not found');

    const flag = await this.prisma.featureFlag.findUnique({
      where: {
        environmentId_key: {
          environmentId: env.id,
          key,
        },
      },
    });
    if (!flag) throw new NotFoundException('Flag not found');

    return {
      key: flag.key,
      enabled: flag.enabled,
      rolloutPercentage: flag.rolloutPercentage,
      targetUsers: (flag.targetUsers as string[]) ?? [],
    };
  }

  private async safeRedisGet(key: string) {
    try {
      return await this.redis.get(key);
    } catch {
      return null;
    }
  }

  private async safeRedisSet(key: string, value: string, ttl: number) {
    try {
      await this.redis.set(key, value, ttl);
    } catch {
      /* cache is best-effort */
    }
  }

  private async invalidateCache(
    projectId: string,
    envType: EnvType,
    key: string,
  ) {
    try {
      await this.redis.del(`flag:${projectId}:${envType}:${key}`);
    } catch {
      /* ignore — next evaluate will refresh from DB */
    }
  }

  private async audit(
    projectId: string,
    flagId: string | null,
    userId: string,
    action: string,
    before: unknown,
    after: unknown,
  ) {
    await this.prisma.flagAudit.create({
      data: {
        projectId,
        flagId,
        userId,
        action,
        before: before as Prisma.InputJsonValue,
        after: after as Prisma.InputJsonValue,
      },
    });
  }
}
