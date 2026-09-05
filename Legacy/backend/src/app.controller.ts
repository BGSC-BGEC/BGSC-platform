import { Controller, Get } from '@nestjs/common';

/**
 * Local routes served by the gateway itself (not proxied). Everything else is
 * routed to the downstream services by the edge pipeline in `main.ts`.
 */
@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  root() {
    return { service: 'api-gateway', status: 'ok' };
  }
}
