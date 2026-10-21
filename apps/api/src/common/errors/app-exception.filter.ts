import type { ApiError } from "@cvb/contracts";
import { isAppError, type ErrorCode } from "@cvb/shared";
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { ZodError } from "zod";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  UNAUTHENTICATED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  PLAN_REQUIRED: HttpStatus.PAYMENT_REQUIRED,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  INTERNAL: HttpStatus.INTERNAL_SERVER_ERROR,
};

/**
 * Turns every error into the one response shape clients know (`ApiError`).
 * Domain errors keep their code; unknown errors are logged and hidden behind INTERNAL.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const requestId = req.header("x-request-id") ?? undefined;

    const { status, body } = this.toResponse(exception);
    if (status >= 500) this.logger.error(exception instanceof Error ? exception.stack : String(exception), { requestId });
    res.status(status).json({ error: { ...body.error, requestId } } satisfies ApiError);
  }

  private toResponse(exception: unknown): { status: number; body: ApiError } {
    if (isAppError(exception)) {
      return {
        status: STATUS[exception.code],
        body: { error: { code: exception.code, message: exception.message, details: exception.details } },
      };
    }
    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          error: {
            code: "VALIDATION_FAILED",
            message: "Some fields are not valid",
            details: exception.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          },
        },
      };
    }
    if (exception instanceof HttpException) {
      return {
        status: exception.getStatus(),
        body: { error: { code: HttpStatus[exception.getStatus()] ?? "HTTP_ERROR", message: exception.message } },
      };
    }
    return { status: 500, body: { error: { code: "INTERNAL", message: "Something went wrong" } } };
  }
}
