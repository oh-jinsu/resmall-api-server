import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AuthService } from './auth.service';
import { ItemEntity } from './item.entity';
import { JobService } from './job.service';
import { ItemOptionEntity } from './item_option.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env'],
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [ItemEntity, ItemOptionEntity],
    }),
    TypeOrmModule.forFeature([ItemEntity, ItemOptionEntity]),
    HttpModule,
  ],
  controllers: [AppController],
  providers: [JobService, AuthService],
})
export class AppModule {}
