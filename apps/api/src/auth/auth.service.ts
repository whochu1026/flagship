import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EnvType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export const DEMO_EMAIL = 'demo@flagship.test';
export const DEMO_PASSWORD = 'password123';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Email already registered');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash: await bcrypt.hash(dto.password, 10),
        name: dto.name,
      },
    });
    return this.token(user.id, user.email, user.name);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.token(user.id, user.email, user.name);
  }

  async demoLogin() {
    const enabled =
      this.config.get('DEMO_LOGIN_ENABLED', 'true') !== 'false' &&
      this.config.get('NODE_ENV', 'development') !== 'production';
    if (!enabled) throw new ForbiddenException('Demo login is disabled');

    let user = await this.prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: DEMO_EMAIL,
          passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
          name: 'Demo User',
        },
      });
    }

    await this.ensureDemoProject(user.id);
    return this.token(user.id, user.email, user.name);
  }

  async me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });
  }

  private async ensureDemoProject(userId: string) {
    const existing = await this.prisma.project.findFirst({
      where: { userId, name: 'Demo App' },
    });
    if (existing) return;

    const project = await this.prisma.project.create({
      data: {
        name: 'Demo App',
        description: '샘플 Feature Flag 프로젝트',
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

    const production = project.environments.find(
      (e) => e.type === EnvType.PRODUCTION,
    )!;

    await this.prisma.featureFlag.create({
      data: {
        projectId: project.id,
        environmentId: production.id,
        key: 'new_dashboard',
        name: 'New Dashboard',
        description: '점진적으로 공개하는 새 대시보드',
        enabled: true,
        rolloutPercentage: 30,
        targetUsers: ['user_101', 'user_102'],
      },
    });
  }

  private token(id: string, email: string, name: string) {
    return {
      accessToken: this.jwt.sign({ sub: id, email }),
      user: { id, email, name },
    };
  }
}
