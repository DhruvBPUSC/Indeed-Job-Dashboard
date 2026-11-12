import { z } from 'zod';

import { nameSchema } from '../users/users.schemas.js';

// Lowercased so "Me@X.com" and "me@x.com" are the same account.
const email = z.string().trim().toLowerCase().pipe(z.email('Invalid email address').max(254));

export const registerSchema = z.strictObject({
  name: nameSchema,
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const loginSchema = z.strictObject({
  email,
  password: z.string().min(1, 'Password is required').max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
