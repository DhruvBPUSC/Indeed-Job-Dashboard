/**
 * The security rules from CLAUDE.md, checked across the whole app rather than per feature:
 *   - every route validates body, params, and query with Zod (fail-closed)
 *   - user-owned data is scoped to the token's user (404 for anyone else's)
 *   - passwordHash is never returned
 *   - /api/auth/* is rate-limited
 * plus HTTP hardening: helmet headers, body size limit, proxy-aware rate limiting.
 */
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { apiRouters, app, createApp } from '../src/app.js';
import { loadOpenApiSpec } from '../src/lib/openapi.js';
import { prisma, resetDb } from './helpers/db.js';
import { createJob, createUserAgent, type TestUser } from './helpers/factories.js';

interface Layer {
  name: string;
  route?: { path: string; methods: Record<string, boolean>; stack: Layer[] };
}

/** Every route with the names of the middleware it runs (router-level + route-level). */
function routes(): { route: string; middleware: string[] }[] {
  const out: { route: string; middleware: string[] }[] = [];
  const collect = (prefix: string, stack: Layer[]): void => {
    const routerLevel = stack.filter((l) => !l.route).map((l) => l.name);
    for (const layer of stack) {
      if (!layer.route) continue;
      const path = prefix + (layer.route.path === '/' ? '' : layer.route.path);
      for (const m of Object.keys(layer.route.methods)) {
        out.push({
          route: `${m.toUpperCase()} ${path}`,
          middleware: [...routerLevel, ...layer.route.stack.map((l) => l.name)],
        });
      }
    }
  };
  collect(
    '',
    (app as unknown as { router: { stack: Layer[] } }).router.stack.filter((l) => l.route),
  );
  for (const [prefix, router] of apiRouters)
    collect(prefix, (router as unknown as { stack: Layer[] }).stack);
  return out;
}

const PUBLIC_ROUTES = [
  'GET /api/health',
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/logout',
];

afterAll(async () => {
  await prisma.$disconnect();
});

describe('route audit', () => {
  it('finds every route the API documents', () => {
    const paths = loadOpenApiSpec().paths as Record<string, Record<string, unknown>>;
    const documented = Object.values(paths).flatMap((item) =>
      ['get', 'post', 'patch', 'delete'].filter((m) => m in item),
    );
    expect(routes()).toHaveLength(documented.length);
  });

  it.each(routes())('$route validates its input with Zod', ({ middleware }) => {
    expect(middleware).toContain('validateRequest');
  });

  it.each(routes())('$route requires auth unless it is public', ({ route, middleware }) => {
    expect(middleware.includes('requireAuth')).toBe(!PUBLIC_ROUTES.includes(route));
  });

  it('validates after authenticating, so unauthenticated callers learn nothing about inputs', () => {
    for (const { route, middleware } of routes()) {
      if (PUBLIC_ROUTES.includes(route)) continue;
      expect(middleware.indexOf('requireAuth'), route).toBeLessThan(
        middleware.indexOf('validateRequest'),
      );
    }
  });
});

describe('unexpected input is rejected, not ignored', () => {
  let user: TestUser;
  const id = randomUUID();

  beforeEach(async () => {
    await resetDb();
    user = await createUserAgent();
  });

  it.each([
    ['a body on logout', () => request(app).post('/api/auth/logout').send({ anything: 'goes' })],
    ['a query on /api/health', () => request(app).get('/api/health?debug=1')],
  ])('rejects %s (public route)', async (_label, send) => {
    const res = await send();
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it.each([
    ['a query on GET /api/me', (a: TestUser['agent']) => a.get('/api/me?unexpected=1')],
    ['a query on the dashboard', (a: TestUser['agent']) => a.get('/api/dashboard/summary?x=1')],
    ['a misspelled list param', (a: TestUser['agent']) => a.get('/api/jobs?pagesize=5')],
    ['a query on GET /api/jobs/:id', (a: TestUser['agent']) => a.get(`/api/jobs/${id}?x=1`)],
    ['a body on GET', (a: TestUser['agent']) => a.get(`/api/applications/${id}`).send({ x: 1 })],
    [
      'a body on DELETE',
      (a: TestUser['agent']) => a.delete(`/api/applications/${id}`).send({ x: 1 }),
    ],
    [
      'an unknown field on PATCH /api/me',
      (a: TestUser['agent']) => a.patch('/api/me').send({ name: 'A', role: 'admin' }),
    ],
  ])('rejects %s', async (_label, send) => {
    const res = await send(user.agent);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('still accepts requests with no body or an empty JSON object', async () => {
    await request(app).post('/api/auth/logout').expect(204);
    await request(app).post('/api/auth/logout').send({}).expect(204);
    await user.agent.get('/api/me').expect(200);
  });
});

describe('passwordHash', () => {
  it('is omitted from every Prisma query unless explicitly selected', async () => {
    await resetDb();
    await createUserAgent();

    const user = await prisma.user.findFirstOrThrow();
    expect(user).not.toHaveProperty('passwordHash');

    const explicit = await prisma.user.findFirstOrThrow({ select: { passwordHash: true } });
    expect(explicit.passwordHash).toMatch(/^\$argon2id\$/);
  });
});

/** Every Prisma call on a model, with its full argument text, from the service sources. */
function prismaCalls(models: string[]): { file: string; call: string }[] {
  const dir = 'src/modules';
  const files = readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.service.ts'))
    .map((f) => join(dir, f));
  const start = new RegExp(`\\b(?:prisma|tx)\\.(${models.join('|')})\\.(\\w+)\\(`, 'g');
  const calls: { file: string; call: string }[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(start)) {
      // Walk to the matching close paren to capture the whole argument object.
      let depth = 0;
      let end = m.index;
      for (let i = m.index + m[0].length - 1; i < src.length; i++) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')' && --depth === 0) {
          end = i + 1;
          break;
        }
      }
      calls.push({ file, call: src.slice(m.index, end).replace(/\s+/g, ' ') });
    }
  }
  return calls;
}

// Queries that legitimately run before there is an authenticated user to scope by.
const PRE_AUTH_FILES = new Set([
  'auth.service.ts', // register (creates the user) and login (looks up by email)
]);

describe('user scoping', () => {
  const userOwned = prismaCalls(['application', 'interview', 'statusHistory', 'user']).filter(
    (c) => !PRE_AUTH_FILES.has(c.file.split('/').pop() ?? ''),
  );

  it('finds the queries to check', () => {
    expect(userOwned.length).toBeGreaterThanOrEqual(15);
  });

  it.each(userOwned.map((c) => [c.file.split('/').pop(), c.call.slice(0, 70), c.call]))(
    '%s: %s… is scoped by userId',
    (_file, _preview, call) => {
      expect(call).toMatch(/\buserId\b/);
    },
  );

  it('returns 404 (not 500) when adding an interview to an application that was just deleted', async () => {
    await resetDb();
    const user = await createUserAgent();
    const job = await createJob();
    const created = await user.agent.post('/api/applications').send({ jobId: job.id }).expect(201);
    const appId = (created.body as { application: { id: string } }).application.id;
    await prisma.application.delete({ where: { id: appId } });

    const res = await user.agent
      .post(`/api/applications/${appId}/interviews`)
      .send({ scheduledAt: '2030-01-01T10:00:00Z', type: 'PHONE' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
  });
});

describe('HTTP hardening', () => {
  it('sets helmet security headers on every response', async () => {
    for (const res of [
      await request(app).get('/api/health'),
      await request(app).get('/api/nope'),
    ]) {
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'self'");
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/);
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['x-powered-by']).toBeUndefined();
    }
  });

  it('does not force https subresources outside production (keeps /api/docs working on http)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
  });

  it('rejects bodies over the limit with 413 PAYLOAD_TOO_LARGE', async () => {
    const small = createApp({ bodyLimit: '1kb' });

    const res = await request(small)
      .post('/api/auth/login')
      .send({ email: 'a@example.com', password: 'x'.repeat(2000) });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' },
    });
  });

  it('enforces the default 100kb limit', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', email: 'a@example.com', password: 'x'.repeat(101 * 1024) });

    expect(res.status).toBe(413);
  });

  it('rate-limits per client IP behind a trusted proxy', async () => {
    const proxied = createApp({ authRateLimit: 1, trustProxy: 1 });
    const from = (ip: string) =>
      request(proxied).post('/api/auth/logout').set('X-Forwarded-For', ip);

    expect((await from('203.0.113.1')).status).toBe(204);
    expect((await from('203.0.113.1')).status).toBe(429);
    // A different client behind the same proxy has its own limit.
    expect((await from('203.0.113.2')).status).toBe(204);
  });

  it('ignores X-Forwarded-For when no proxy is trusted (it could be spoofed)', async () => {
    const direct = createApp({ authRateLimit: 1, trustProxy: 0 });
    const from = (ip: string) =>
      request(direct).post('/api/auth/logout').set('X-Forwarded-For', ip);

    expect((await from('203.0.113.1')).status).toBe(204);
    expect((await from('203.0.113.2')).status).toBe(429); // same real client, new fake header
  });
});

describe('origin guard (CSRF)', () => {
  const FRONTEND = 'http://localhost:5173';
  const EVIL = 'https://evil.example.com';
  let user: TestUser;

  beforeEach(async () => {
    await resetDb();
    user = await createUserAgent();
  });

  it.each([
    ['POST', (a: TestUser['agent']) => a.post('/api/applications')],
    ['PATCH', (a: TestUser['agent']) => a.patch('/api/me')],
    ['DELETE', (a: TestUser['agent']) => a.delete(`/api/applications/${randomUUID()}`)],
  ])(
    'rejects a cross-site %s from an unknown origin, even with a valid cookie',
    async (_m, send) => {
      const res = await send(user.agent).set('Origin', EVIL).send({ name: 'Hacked' });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        error: { code: 'FORBIDDEN_ORIGIN', message: 'Requests from this origin are not allowed' },
      });
    },
  );

  it('rejects a forged form post to logout', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Origin', EVIL)
      .type('form')
      .send('x=1');

    expect(res.status).toBe(403);
  });

  it('allows writes from the frontend origin', async () => {
    const res = await user.agent.patch('/api/me').set('Origin', FRONTEND).send({ name: 'Renamed' });

    expect(res.status).toBe(200);
  });

  it("allows writes from the API's own origin (Swagger UI)", async () => {
    const res = await user.agent
      .patch('/api/me')
      .set('Host', 'api.example.com')
      .set('Origin', 'http://api.example.com')
      .send({ name: 'Renamed' });

    expect(res.status).toBe(200);
  });

  it('allows requests without an Origin header (curl, server-to-server)', async () => {
    await user.agent.patch('/api/me').send({ name: 'Renamed' }).expect(200);
  });

  it('leaves reads alone (CORS already keeps other sites from reading responses)', async () => {
    await user.agent.get('/api/me').set('Origin', EVIL).expect(200);
  });
});
