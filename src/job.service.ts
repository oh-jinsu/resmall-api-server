import { HttpService } from '@nestjs/axios';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { catchError, firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { ItemEntity } from './item.entity';

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(ItemEntity)
    private readonly itemRepository: Repository<ItemEntity>,
  ) {}

  async executeOne(id: string) {
    return this.withCatch(async () => {
      const sessionId = await this.fetchSessionId();

      const item = await this.getItem(id, sessionId);

      return this.updateQuantity(item['PROD_CD'], item['BAL_QTY']);
    });
  }

  async execute() {
    return this.withCatch(async () => {
      const sessionId = await this.fetchSessionId();

      const items = await this.getItems(sessionId);

      return await Promise.all(
        items.map(async ({ PROD_CD, BAL_QTY }) =>
          this.updateQuantity(PROD_CD, BAL_QTY),
        ),
      );
    });
  }

  private async withCatch<T>(fn: () => Promise<T>, count = 5): Promise<T> {
    try {
      const result = await fn();

      this.logger.log('재고를 갱신했습니다.');

      this.logger.log(JSON.stringify(result));

      return result;
    } catch (e) {
      this.logger.error(e);

      if (count > 0 && e instanceof InternalServerErrorException) {
        this.logger.log('다시 요청을 시도합니다.');

        await new Promise((resolve) => setTimeout(resolve, 1000));

        return this.withCatch(fn, count - 1);
      }

      throw new InternalServerErrorException(
        '일시적인 오류입니다. 잠시 후 다시 시도해 주세요.',
      );
    }
  }

  private async updateQuantity(id: string, quantity: number) {
    await this.itemRepository.update(
      { id },
      {
        quantity,
      },
    );

    return this.itemRepository.findOne({
      where: {
        id,
      },
    });
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

  private async getItem(id: string, sessionId: string) {
    const url = `${process.env.URL_ERP_INVENTORY}?SESSION_ID=${sessionId}`;

    const body = { PROD_CD: id, BASE_DATE: this.getToday() };

    const items = await this.fetchItems(url, body);

    return items[0];
  }

  private async getItems(sessionId: string) {
    const url = `${process.env.URL_ERP_INVENTORY_LIST}?SESSION_ID=${sessionId}`;

    const body = { BASE_DATE: this.getToday() };

    const items = await this.fetchItems(url, body);

    return items;
  }

  private async fetchItems(url: string, body: any) {
    const { data } = await firstValueFrom(
      this.httpService.post(url, body).pipe(
        catchError((error) => {
          this.logger.error(error.response.data);

          throw new InternalServerErrorException(error.response.data);
        }),
      ),
    );

    const items = data['Data']['Result'];

    if (!Array.isArray(items) || items.length === 0) {
      throw new ConflictException('등록한 재고가 없습니다.');
    }

    return items;
  }

  private getToday(): string {
    const date = new Date();

    const year = date.getFullYear();

    const month = ('0' + (1 + date.getMonth())).slice(-2);

    const day = ('0' + date.getDate()).slice(-2);

    return year + month + day;
  }
}
