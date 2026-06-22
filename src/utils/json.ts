import { z, type ZodSchema } from 'zod';

export function safeParseJson<T>(schema: ZodSchema<T>, raw: string): T | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
