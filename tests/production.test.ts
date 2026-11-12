/**
 * Runs the real entry points as child processes, the way Render does: the server in
 * production mode (cookie flags, docs off, SIGTERM handling) and the demo reset script.
 */
import { spawn, type ChildProcess } from 'node:child_process';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma, resetDb } from './helpers/db.js';
import { createJob, createUserAgent } from './helpers/factories.js';

const TEST_DB = 'postgresql://tracker:tracker@localhost:5433/tracker_test?schema=public';

interface Run {
  child: ChildProcess;
  output: () => string;
  exited: Promise<number | null>;
}

function run(script: string, args: string[], env: Record<string, string>): Run {
  const child = spawn(process.execPath, ['--import', 'tsx', script, ...args], {
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (d: Buffer) => (out += d.toString()));
  child.stderr.on('data', (d: Buffer) => (out += d.toString()));
  const exited = new Promise<number | null>((resolve) => child.on('exit', resolve));
  return { child, output: () => out, exited };
}

async function waitFor(check: () => boolean, ms = 15_000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 50));
  }
}

const prodEnv = (port: number): Record<string, string> => ({
  NODE_ENV: 'production',
  PORT: String(port),
  DATABASE_URL: TEST_DB,
  JWT_SECRET: 'production-test-secret-that-is-at-least-32-chars',
  FRONTEND_URL: 'https://job-tracker-web.onrender.com',
  COOKIE_SAMESITE: 'none',
  TRUST_PROXY: '1',
  LOG_LEVEL: 'info',
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('production server process', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('serves with production cookie flags, hides docs, and shuts down cleanly on SIGTERM', async () => {
    const port = 40_000 + Math.floor(Math.random() * 10_000);
    const server = run('src/server.ts', [], prodEnv(port));
    try {
      await waitFor(() => server.output().includes('API listening'));
      const base = `http://localhost:${port}`;

      expect((await fetch(`${base}/api/health`)).status).toBe(200);
      expect((await fetch(`${base}/api/docs/`)).status).toBe(404);

      const res = await fetch(`${base}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://job-tracker-web.onrender.com',
        },
        body: JSON.stringify({
          name: 'Prod',
          email: 'prod@example.com',
          password: 'correct-horse-9',
        }),
      });
      expect(res.status).toBe(201);
      const cookie = res.headers.get('set-cookie') ?? '';
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Secure/i);
      expect(cookie).toMatch(/SameSite=None/i);
      expect(res.headers.get('access-control-allow-origin')).toBe(
        'https://job-tracker-web.onrender.com',
      );

      // Logs are JSON in production, with the client IP taken from X-Forwarded-For (TRUST_PROXY=1).
      await fetch(`${base}/api/me`, { headers: { 'X-Forwarded-For': '203.0.113.7' } });
      await waitFor(() => server.output().includes('203.0.113.7'));
      expect(server.output()).not.toContain('correct-horse-9');

      server.child.kill('SIGTERM');
      expect(await server.exited).toBe(0);
      expect(server.output()).toContain('Shutdown complete');
    } finally {
      server.child.kill('SIGKILL');
    }
  }, 30_000);

  it('refuses to start with COOKIE_SAMESITE=none outside production', async () => {
    const server = run('src/server.ts', [], { ...prodEnv(40_001), NODE_ENV: 'development' });

    expect(await server.exited).toBe(1);
    expect(server.output()).toContain('COOKIE_SAMESITE=none requires NODE_ENV=production');
  });
});

describe('npm run demo:reset', () => {
  const resetEnv = { NODE_ENV: 'test', SEED_DEMO_PASSWORD: 'DemoPass123!' };

  beforeEach(async () => {
    await resetDb();
  });

  it('does nothing without --yes and shows the target without the password', async () => {
    const reset = run('prisma/demo-reset.ts', [], resetEnv);

    expect(await reset.exited).toBe(1);
    expect(reset.output()).toContain('Demo reset target: localhost:5433/tracker_test');
    expect(reset.output()).toContain('Dry run: nothing changed');
    expect(reset.output()).not.toContain('tracker:tracker');
    expect(await prisma.job.count()).toBe(0);
  });

  it('resets the demo account with --yes, leaves other users alone, and can run twice', async () => {
    const classmate = await createUserAgent('classmate@example.com');
    const theirJob = await createJob({ title: 'Their Job' });
    await prisma.application.create({
      data: { userId: classmate.id, jobId: theirJob.id, status: 'APPLIED' },
    });

    for (let i = 0; i < 2; i++) {
      const reset = run('prisma/demo-reset.ts', ['--yes'], resetEnv);
      expect(await reset.exited).toBe(0);
      expect(reset.output()).toContain('demo@example.com has 16 applications');
    }

    expect(await prisma.job.count()).toBe(41); // 40 seeded + the classmate's
    expect(await prisma.application.count({ where: { userId: classmate.id } })).toBe(1);
    const demo = await prisma.user.findUniqueOrThrow({
      where: { email: 'demo@example.com' },
      select: { _count: { select: { applications: true } } },
    });
    expect(demo._count.applications).toBe(16);
  }, 30_000);
});
