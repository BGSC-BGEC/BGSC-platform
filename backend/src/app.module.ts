import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  gatewayConfig,
  gatewayConfigValidationSchema,
} from './config/gateway.config';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [gatewayConfig],
      validationSchema: gatewayConfigValidationSchema,
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
