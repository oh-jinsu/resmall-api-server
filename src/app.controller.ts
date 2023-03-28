import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { JobService } from './job.service';

@Controller()
export class AppController {
  private readonly zone = 'Asia/Seoul';

  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly appService: JobService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  @Get('/health')
  health() {
    if (!this.schedulerRegistry.doesExist('cron', 'job')) {
      return {
        running: false,
      };
    }

    const job = this.schedulerRegistry.getCronJob('job');

    return {
      nextDate: job.nextDate().setZone(this.zone).toISO(),
      running: job.running,
    };
  }

  @Post('/execute')
  execute() {
    return this.appService.execute();
  }

  @Post('/execute/:id')
  executeOne(@Param('id') id: string) {
    return this.appService.executeOne(id);
  }

  @Post('/job')
  post(@Body() { cron }: { cron: string }) {
    if (this.schedulerRegistry.doesExist('cron', 'job')) {
      throw new ConflictException('이미 작업이 실행중입니다.');
    }

    if (typeof cron !== 'string') {
      throw new BadRequestException();
    }

    const job = new CronJob(
      cron,
      () => this.appService.execute(),
      undefined,
      true,
      this.zone,
    );

    this.schedulerRegistry.addCronJob('job', job);

    this.logger.log('작업을 예약했습니다.');

    return {
      nextDate: job.nextDate().setZone(this.zone).toISO(),
      running: job.running,
    };
  }

  @Delete('/job')
  delete() {
    if (!this.schedulerRegistry.doesExist('cron', 'job')) {
      throw new NotFoundException('해제할 작업이 없습니다.');
    }

    this.schedulerRegistry.deleteCronJob('job');

    this.logger.log('작업을 해제했습니다.');

    return {
      running: false,
    };
  }
}
