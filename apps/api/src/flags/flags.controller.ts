import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFlagDto, EvaluateDto, UpdateFlagDto } from './dto/flag.dto';
import { FlagsService } from './flags.service';

@ApiTags('flags')
@Controller()
export class FlagsController {
  constructor(private readonly flagsService: FlagsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('projects/:projectId/flags')
  list(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Query('environmentId') environmentId?: string,
  ) {
    return this.flagsService.list(user.id, projectId, environmentId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('projects/:projectId/environments/:environmentId/flags')
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Body() dto: CreateFlagDto,
  ) {
    return this.flagsService.create(user.id, projectId, environmentId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('projects/:projectId/flags/:flagId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('flagId') flagId: string,
    @Body() dto: UpdateFlagDto,
  ) {
    return this.flagsService.update(user.id, projectId, flagId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('projects/:projectId/flags/:flagId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('flagId') flagId: string,
  ) {
    return this.flagsService.remove(user.id, projectId, flagId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('projects/:projectId/audits')
  audits(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.flagsService.audits(user.id, projectId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('projects/:projectId/evaluate')
  evaluatePreview(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: EvaluateDto,
  ) {
    return this.flagsService.evaluatePreview(user.id, projectId, dto);
  }

  /** SDK endpoint — authenticate with project API key. */
  @ApiTags('sdk')
  @ApiHeader({ name: 'X-API-Key', required: true })
  @UseGuards(ApiKeyGuard)
  @Post('v1/evaluate')
  evaluateSdk(
    @Req() req: Request & { projectId: string },
    @Body() dto: EvaluateDto,
  ) {
    return this.flagsService.evaluate(req.projectId, dto);
  }
}
