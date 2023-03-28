import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AuthService {
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
}
