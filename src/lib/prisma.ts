import { PrismaPg } from '@prisma/adapter-pg';

import { env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  // Defense in depth: no query returns passwordHash unless it asks for it by name
  // (only the login check does, with an explicit select).
  omit: { user: { passwordHash: true } },
});
