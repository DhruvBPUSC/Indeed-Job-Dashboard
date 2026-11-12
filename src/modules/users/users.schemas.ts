import { z } from 'zod';

export const nameSchema = z.string().trim().min(1, 'Name is required').max(100);

// Strict: unsupported fields (email, password, ...) are rejected rather than silently ignored.
export const updateMeSchema = z.strictObject({
  name: nameSchema,
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
