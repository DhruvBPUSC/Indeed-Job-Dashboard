/**
 * Resets the demo account to its scripted state before a presentation:
 *   npm run demo:reset -- --yes
 *
 * Touches only demo data: upserts the seeded jobs and rebuilds demo@example.com's applications,
 * history, and interviews (dates are relative to today, so upcoming interviews are upcoming).
 * Other users and their applications are left alone.
 *
 * Without --yes it only prints the target database and exits, so it can't be run by accident.
 * Point it at production with DATABASE_URL (Render: the database's External Database URL).
 */
import { DEMO_EMAIL, seed } from './seed.js';
import { prisma } from '../src/lib/prisma.js';

function describeTarget(url: string | undefined): string {
  if (!url) return '(DATABASE_URL is not set)';
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || '5432'}${u.pathname}`; // never print the password
  } catch {
    return '(DATABASE_URL is not a valid URL)';
  }
}

async function main(): Promise<number> {
  const target = describeTarget(process.env.DATABASE_URL);
  console.log(`Demo reset target: ${target}`);
  console.log(`Resets ${DEMO_EMAIL} and the seeded jobs. Other users are not touched.`);

  if (!process.argv.includes('--yes')) {
    console.log('\nDry run: nothing changed. Re-run with --yes to reset:');
    console.log('  npm run demo:reset -- --yes');
    return 1;
  }

  await seed();
  const demo = await prisma.user.findUniqueOrThrow({
    where: { email: DEMO_EMAIL },
    select: { _count: { select: { applications: true } } },
  });
  const jobs = await prisma.job.count();
  console.log(
    `Done: ${DEMO_EMAIL} has ${demo._count.applications} applications; ${jobs} jobs in total.`,
  );
  return 0;
}

try {
  process.exitCode = await main();
} catch (err) {
  console.error('Demo reset failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
