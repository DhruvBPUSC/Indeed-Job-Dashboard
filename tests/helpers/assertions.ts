import type { Response } from 'supertest';
import { expect } from 'vitest';

import { prisma } from './db.js';

/** Every object key in a JSON value, at any depth. */
function allKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(allKeys);
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => [k, ...allKeys(v)]);
  }
  return [];
}

/**
 * Asserts a response leaks no password hash: no `passwordHash` key anywhere in the body, and
 * none of the stored hashes (or any argon2 string) appear in the raw response text.
 */
export async function expectNoPasswordHash(res: Response): Promise<void> {
  expect(allKeys(res.body)).not.toContain('passwordHash');

  const raw = res.text;
  expect(raw).not.toMatch(/\$argon2/);
  const users = await prisma.user.findMany({ select: { passwordHash: true } });
  for (const { passwordHash } of users) {
    expect(raw).not.toContain(passwordHash);
  }
}
