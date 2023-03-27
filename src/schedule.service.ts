import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  @Cron('45 * * * * *')
  handleCron() {
    this.logger.debug('Hey!');
  }
}
