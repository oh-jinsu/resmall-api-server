import { HttpService } from '@nestjs/axios';
import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { catchError, firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { ItemEntity } from './item.entity';
import { ItemOptionEntity } from './item_option.entity';

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    private readonly authService: AuthService,
    private readonly httpService: HttpService,
    @InjectRepository(ItemEntity)
    private readonly itemRepository: Repository<ItemEntity>,
    @InjectRepository(ItemOptionEntity)
    private readonly itemOptionRepository: Repository<ItemOptionEntity>,
  ) {}

  async executeOne(id: string) {
    this.logger.log('작업을 시작합니다.');

    const sessionId = await this.authService.getSessionId();

    const item = await this.getItem(id, sessionId);

    const result = this.updateQuantity(item['PROD_CD'], item['BAL_QTY']);

    this.logger.log(JSON.stringify(result));

    this.logger.log('재고를 갱신했습니다.');

    return result;
  }

  async execute() {
    this.logger.log('작업을 시작합니다.');

    const sessionId = await this.authService.getSessionId();

    const items = await this.getItems(sessionId);

    const result = await Promise.all(
      items.map(async ({ PROD_CD, BAL_QTY }) =>
        this.updateQuantity(PROD_CD, BAL_QTY),
      ),
    );

    this.logger.log(JSON.stringify(result));

    this.logger.log('재고를 갱신했습니다.');

    return result;
  }

  private async updateQuantity(prodCd: string, quantity: number) {
    if (prodCd.includes('-')) {
      const [itemId, optionId] = prodCd.split('-');

      await this.itemOptionRepository.update(
        {
          id: optionId,
          itemId,
        },
        {
          quantity,
        },
      );

      return this.itemOptionRepository.findOne({
        where: {
          id: optionId,
          itemId,
        },
      });
    }

    await this.itemRepository.update(
      { id: prodCd },
      {
        quantity,
      },
    );

    return this.itemRepository.findOne({
      where: {
        id: prodCd,
      },
    });
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
    const { data } = await this.withCatch(() =>
      firstValueFrom(
        this.httpService
          .post(url, body, {
            headers: {
              'Content-Type': `application/json`,
            },
          })
          .pipe(
            catchError((error) => {
              this.logger.error(error.response.data);

              throw new ServiceUnavailableException(error.response.data);
            }),
          ),
      ),
    );

    if ((data['Error']?.['Message'] as string | undefined)?.includes('초과')) {
      throw new HttpException('허용량을 초과했습니다.', 429);
    }

    const items = data['Data']?.['Result'];

    if (!Array.isArray(items) || items.length === 0) {
      throw new ConflictException('등록한 재고가 없습니다.');
    }

    return items;
  }

  private async withCatch<T>(fn: () => Promise<T>, count = 5): Promise<T> {
    try {
      const result = await fn();

      return result;
    } catch (e) {
      this.logger.error(e);

      if (count > 0 && e instanceof ServiceUnavailableException) {
        this.logger.log('다시 요청을 시도합니다.');

        await new Promise((resolve) => setTimeout(resolve, 3000));

        return this.withCatch(fn, count - 1);
      }

      throw e;
    }
  }

  private getToday(): string {
    const date = new Date();

    const year = date.getFullYear();

    const month = ('0' + (1 + date.getMonth())).slice(-2);

    const day = ('0' + date.getDate()).slice(-2);

    return year + month + day;
  }
}
