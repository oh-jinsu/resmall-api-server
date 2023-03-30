import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Headers,
  Logger,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AuthService } from './auth.service';
import { JobService } from './job.service';

@Controller()
export class AppController {
  private readonly zone = 'Asia/Seoul';

  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly jobService: JobService,
    private readonly authService: AuthService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  @Get('/issue')
  issue(@Headers('Authorization') auth: string) {
    this.authService.assert(auth);

    return {
      sessionId: this.authService.getSessionId(),
    };
  }

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
  execute(@Headers('Authorization') auth: string) {
    this.authService.assert(auth);

    return this.jobService.execute();
  }

  @Post('/execute/:id')
  executeOne(@Headers('Authorization') auth: string, @Param('id') id: string) {
    this.authService.assert(auth);

    return this.jobService.executeOne(id);
  }

  @Post('/job')
  post(
    @Headers('Authorization') auth: string,
    @Body() { cron }: { cron: string },
  ) {
    this.authService.assert(auth);

    if (this.schedulerRegistry.doesExist('cron', 'job')) {
      throw new ConflictException('이미 작업이 실행중입니다.');
    }

    if (typeof cron !== 'string') {
      throw new BadRequestException();
    }

    const job = new CronJob(
      cron,
      () => this.jobService.execute(),
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
  delete(@Headers('Authorization') auth: string) {
    this.authService.assert(auth);

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
