/**
 * Errors the application raises on purpose. Each has a stable `code` that the API maps to an
 * HTTP status and that clients can switch on. Infrastructure never leaks raw errors past this.
 */
export type ErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "PLAN_REQUIRED"
  | "PASSWORD_REQUIRED"
  | "RATE_LIMITED"
  | "INTERNAL";

export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  readonly code = "VALIDATION_FAILED" as const;
}

export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND" as const;
  constructor(entity: string, id?: string) {
    super(id ? `${entity} ${id} was not found` : `${entity} was not found`);
  }
}

export class ConflictError extends AppError {
  readonly code = "CONFLICT" as const;
}

export class UnauthenticatedError extends AppError {
  readonly code = "UNAUTHENTICATED" as const;
  constructor(message = "Sign in to continue") {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  readonly code = "FORBIDDEN" as const;
  constructor(message = "You don't have access to this") {
    super(message);
  }
}

export class PlanRequiredError extends AppError {
  readonly code = "PLAN_REQUIRED" as const;
  constructor(feature: string, requiredPlan: string) {
    super(`${feature} needs the ${requiredPlan} plan`, { feature, requiredPlan });
  }
}

export class PasswordRequiredError extends AppError {
  readonly code = "PASSWORD_REQUIRED" as const;
  constructor(message = "This CV is protected with a password") {
    super(message);
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;
