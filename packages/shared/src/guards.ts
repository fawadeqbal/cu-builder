/** Exhaustiveness check for switch statements over unions. */
export function assertNever(value: never, message = "Unexpected value"): never {
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}

export const isDefined = <T>(v: T | null | undefined): v is T => v !== null && v !== undefined;

export const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** Nominal typing for ids and other primitives: `type ResumeId = Brand<string, "ResumeId">`. */
export type Brand<T, B extends string> = T & { readonly __brand: B };
