import { execSync } from 'node:child_process';

/** Applies migrations to the test database once before the suite runs. */
export default function setup(): void {
  try {
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: 'pipe',
    });
  } catch (err) {
    const output = (err as { stdout?: Buffer; stderr?: Buffer }).stderr?.toString() ?? '';
    throw new Error(
      'Could not migrate the test database. Is it running? Try: docker compose up -d db-test\n' +
        output,
      { cause: err },
    );
  }
}
