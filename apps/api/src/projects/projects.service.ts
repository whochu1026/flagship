import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnvType } from '@prisma/client';
import { generateApiKey } from '../common/crypto.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto, CreateProjectDto } from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        environments: true,
        _count: { select: { flags: true, apiKeys: true } },
      },
    });
  }

  async get(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        environments: { orderBy: { createdAt: 'asc' } },
        apiKeys: {
          where: { revokedAt: null },
          select: {
            id: true,
            name: true,
            keyPrefix: true,
            lastUsedAt: true,
            createdAt: true,
          },
        },
        _count: { select: { flags: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException();
    return project;
  }

  create(userId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        userId,
        environments: {
          create: [
            { name: 'Development', type: EnvType.DEVELOPMENT },
            { name: 'Staging', type: EnvType.STAGING },
            { name: 'Production', type: EnvType.PRODUCTION },
          ],
        },
      },
      include: { environments: true },
    });
  }

  async createApiKey(userId: string, projectId: string, dto: CreateApiKeyDto) {
    await this.assertOwnership(userId, projectId);
    const generated = generateApiKey();
    const record = await this.prisma.apiKey.create({
      data: {
        projectId,
        name: dto.name,
        keyPrefix: generated.prefix,
        keyHash: generated.hash,
      },
    });
    return {
      id: record.id,
      name: record.name,
      keyPrefix: record.keyPrefix,
      apiKey: generated.raw,
      createdAt: record.createdAt,
      warning: 'Store this API key now. It will not be shown again.',
    };
  }

  async assertOwnership(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException();
    return project;
  }
}
