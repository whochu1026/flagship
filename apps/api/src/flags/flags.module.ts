import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { FlagsController } from './flags.controller';
import { FlagsService } from './flags.service';

@Module({
  imports: [ProjectsModule],
  controllers: [FlagsController],
  providers: [FlagsService],
})
export class FlagsModule {}
