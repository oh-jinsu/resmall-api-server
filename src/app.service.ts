import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  constructor(private readonly httpService: HttpService) {}

  sayHealth(): string {
    return "I'm healthy";
  }

  update(): string {
    return '';
  }
}
