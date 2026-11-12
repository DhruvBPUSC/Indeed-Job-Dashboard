import { env } from '../../src/config/env.js';
import { prisma } from '../../src/lib/prisma.js';

/** Empties every table. Refuses to run outside NODE_ENV=test so it can't wipe the dev database. */
export async function resetDb(): Promise<void> {
  if (env.NODE_ENV !== 'test') {
    throw new Error(`resetDb() refused: NODE_ENV is "${env.NODE_ENV}", expected "test"`);
  }
  // Cascades to Application, StatusHistory, and Interview.
  await prisma.$executeRaw`TRUNCATE TABLE "User", "Job" CASCADE`;
}

export { prisma };
