import { z, type ZodType, type ZodTypeDef } from 'zod';
import { AppError } from '../errors.js';
import { isIsoDate } from './time.js';

/** Parses input with a zod schema (unknown keys stripped) or throws 422 VALIDATION_ERROR with one message per field. */
export function parse<T>(schema: ZodType<T, ZodTypeDef, unknown>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) fields[String(issue.path[0] ?? 'body')] ??= issue.message;
  throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', fields);
}

const DATE_MESSAGE = 'Enter a valid date (YYYY-MM-DD).';
/** A required `date=YYYY-MM-DD` query field (a real calendar date). */
export const isoDateField = z.string({ required_error: DATE_MESSAGE, invalid_type_error: DATE_MESSAGE }).refine(isIsoDate, DATE_MESSAGE);
