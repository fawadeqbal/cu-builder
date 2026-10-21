import { Injectable, type PipeTransform } from "@nestjs/common";
import type { ZodType, output } from "zod";

/**
 * Validates and parses a request part against a contract schema from @cvb/contracts:
 * `@Body(new ZodPipe(CreateResumeSchema)) dto: CreateResumeDto`.
 * Failures throw ZodError, which AppExceptionFilter turns into a 400.
 */
@Injectable()
export class ZodPipe<S extends ZodType> implements PipeTransform<unknown, output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): output<S> {
    return this.schema.parse(value);
  }
}
