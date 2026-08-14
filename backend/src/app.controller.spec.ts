import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports the gateway as healthy', () => {
      const result = appController.health();
      expect(result.status).toBe('ok');
      expect(result.service).toBe('api-gateway');
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('root', () => {
    it('identifies the service', () => {
      expect(appController.root()).toEqual({
        service: 'api-gateway',
        status: 'ok',
      });
    });
  });
});
