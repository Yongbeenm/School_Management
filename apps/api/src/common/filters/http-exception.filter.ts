import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException ? exception.getResponse() : undefined;
    const responseBody = typeof exceptionResponse === 'object' && exceptionResponse !== null
      ? exceptionResponse as Record<string, unknown>
      : {};

    const message = Array.isArray(responseBody.message)
      ? 'Request validation failed'
      : typeof responseBody.message === 'string'
        ? responseBody.message
        : status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'An unexpected error occurred'
          : 'Request failed';

    response.status(status).json({
      success: false,
      error: {
        code: typeof responseBody.error === 'string' ? responseBody.error : HttpStatus[status],
        message,
        ...(Array.isArray(responseBody.message) ? { details: responseBody.message } : {}),
      },
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
