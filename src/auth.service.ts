import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { catchError, firstValueFrom } from 'rxjs';

@Injectable()
export class AuthService {
  private sessionId: string | undefined;

  private lastTime: number | undefined;

  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly httpService: HttpService) {}

  assert(auth?: string) {
    if (!auth) {
      throw new UnauthorizedException();
    }

    if (!auth.startsWith('Basic ')) {
      throw new UnauthorizedException();
    }

    const raw = Buffer.from(auth.replace('Basic ', ''), 'base64').toString();

    const credentials = raw.split(':');

    if (credentials.length !== 2) {
      throw new UnauthorizedException();
    }

    const [id, password] = credentials;

    if (id !== process.env.EXECUTOR_ID) {
      throw new UnauthorizedException();
    }

    if (password !== process.env.EXECUTOR_PASSWORD) {
      throw new UnauthorizedException();
    }
  }

  async getSessionId() {
    if (!this.lastTime || Date.now() > this.lastTime + 10 * 60 * 1000) {
      this.sessionId = await this.fetchSessionId();

      this.lastTime = Date.now();
    }

    return this.sessionId;
  }

  private async fetchSessionId() {
    const { data: auth } = await firstValueFrom(
      this.httpService
        .post(process.env.URL_ERP_LOGIN, {
          COM_CODE: process.env.COM_CODE,
          USER_ID: process.env.USER_ID,
          API_CERT_KEY: process.env.API_CERT_KEY,
          LAN_TYPE: process.env.LAN_TYPE,
          ZONE: process.env.ZONE,
        })
        .pipe(
          catchError((error) => {
            this.logger.error(error.response.data);

            throw new InternalServerErrorException(error.response.data);
          }),
        ),
    );

    return auth['Data']['Datas']['SESSION_ID'];
  }
}
