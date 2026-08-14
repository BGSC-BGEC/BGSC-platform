import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * M7: Global exception filter — prevents stack traces, TypeORM errors, and
 * internal paths from leaking in HTTP responses regardless of NODE_ENV.
 *
 * Full error detail is logged server-side; the client only receives a
 * sanitised { statusCode, error, message } shape.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (Array.isArray(b['message'])
          ? (b['message'] as string[]).join(', ')
          : String(b['message'] ?? message));
        error = String(b['error'] ?? error);
      }
    }

    // Log full details server-side (including stack for 5xx).
    const logLevel = statusCode >= 500 ? 'error' : 'warn';
    this.logger[logLevel](
      `${req.method} ${req.path} → ${statusCode}: ${message}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    if (!res.headersSent) {
      res.status(statusCode).json({ statusCode, error, message });
    }
  }
}
