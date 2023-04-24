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

type Stock = {
  readonly code: string;
  readonly quantity: number;
};

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

  async executeOne(itemId: string) {
    this.logger.log('작업을 시작합니다.');

    const result = [];

    const updateAndPushIfExists = async (code: string) => {
      const stock = await this.getStock(code);

      if (stock) {
        result.push(await this.updateQuantityByCode(stock));
      }
    };

    await updateAndPushIfExists(itemId);

    const itemOptions = await this.itemOptionRepository.find({
      where: {
        itemId,
      },
    });

    for (const element of itemOptions) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // await updateAndPushIfExists(`${itemId}-${element.id}`);

      await updateAndPushIfExists(element.id);
    }

    this.logger.log(JSON.stringify(result));

    this.logger.log('재고를 갱신했습니다.');

    return result;
  }

  async execute() {
    this.logger.log('작업을 시작합니다.');

    const stocks = await this.getStocks();

    const result = await Promise.all(
      stocks.map((stock) => this.updateQuantityByCode(stock)),
    );

    this.logger.log(JSON.stringify(result));

    this.logger.log('재고를 갱신했습니다.');

    return result;
  }

  private async updateQuantityByCode({ code, quantity }: Stock) {
    if (code.length > 10) {
      const itemId = code.substring(0, 10);

      await this.itemOptionRepository.update(
        {
          id: code,
          itemId,
        },
        {
          quantity,
        },
      );

      return this.itemOptionRepository.findOne({
        where: {
          id: code,
          itemId,
        },
      });
    }

    await this.itemRepository.update(
      { id: code },
      {
        quantity,
      },
    );

    return this.itemRepository.findOne({
      where: {
        id: code,
      },
    });
  }

  private async getStock(id: string): Promise<Stock | undefined> {
    const body = { PROD_CD: id, BASE_DATE: this.getToday() };

    const items = await this.fetchStocksFromAPI(
      process.env.URL_ERP_INVENTORY,
      body,
    );

    if (items.length === 0) {
      return undefined;
    }

    const result = items[0];

    if (result.quantity > 0) {
      return result;
    }

    return undefined;
  }

  private async getStocks(): Promise<Stock[]> {
    const body = { BASE_DATE: this.getToday() };

    const items = await this.fetchStocksFromAPI(
      process.env.URL_ERP_INVENTORY_LIST,
      body,
    );

    return items.filter((item) => item.quantity > 0);
  }

  private async fetchStocksFromAPI(url: string, body: any): Promise<Stock[]> {
    const sessionId = await this.authService.getSessionId();

    const { data } = await this.withCatch(() =>
      firstValueFrom(
        this.httpService
          .post(`${url}?SESSION_ID=${sessionId}`, body, {
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

    if (!Array.isArray(items)) {
      throw new ConflictException('등록한 재고가 없습니다.');
    }

    return items.map(({ PROD_CD, BAL_QTY }) => ({
      code: PROD_CD,
      quantity: BAL_QTY,
    }));
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
