import { z } from "zod";

/** Every error response from the API has this shape. */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiError = z.output<typeof ApiErrorSchema>;

export const PaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.output<typeof PaginationQuerySchema>;

export const page = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export type Page<T> = { items: T[]; nextCursor: string | null };

export const IdParamSchema = z.object({ id: z.string().min(1).max(64) });
