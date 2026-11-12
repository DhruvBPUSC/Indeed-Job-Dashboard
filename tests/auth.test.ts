import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { app, createApp } from '../src/app.js';
import { AUTH_COOKIE } from '../src/lib/auth-cookie.js';
import { prisma, resetDb } from './helpers/db.js';

const newUser = { name: 'Cayden Willey', email: 'cayden@example.com', password: 'correct-horse-9' };

/** The auth Set-Cookie header from a response, if any. */
function authCookie(res: request.Response): string | undefined {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  return cookies.find((c) => c.startsWith(`${AUTH_COOKIE}=`));
}

function register(body: object = newUser): request.Test {
  return request(app).post('/api/auth/register').send(body);
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('creates the user, sets an httpOnly SameSite=Lax cookie, and never returns passwordHash', async () => {
    const res = await register({ ...newUser, email: '  Cayden@Example.COM ' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user: {
        id: expect.any(String) as string,
        name: newUser.name,
        email: 'cayden@example.com',
        createdAt: expect.any(String) as string,
        updatedAt: expect.any(String) as string,
      },
    });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    const cookie = authCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toMatch(/Secure/i); // only set in production

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: 'cayden@example.com' },
      select: { passwordHash: true },
    });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored.passwordHash).not.toContain(newUser.password);
  });

  it('rejects a duplicate email (case-insensitive) with 409', async () => {
    await register().expect(201);

    const res = await register({ ...newUser, name: 'Someone Else', email: 'CAYDEN@example.com' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists' },
    });
    expect(authCookie(res)).toBeUndefined();
    expect(await prisma.user.count()).toBe(1);
  });

  it('rejects an invalid body with 400 VALIDATION_ERROR', async () => {
    const res = await register({ name: '', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(JSON.stringify(res.body)).not.toContain('short'); // password value isn't echoed back
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await register().expect(201);
  });

  it('logs in with correct credentials and the cookie grants access to a protected route', async () => {
    const agent = request.agent(app);

    const res = await agent
      .post('/api/auth/login')
      .send({ email: newUser.email, password: newUser.password });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ user: { name: newUser.name, email: newUser.email } });
    expect(res.body).not.toHaveProperty('user.passwordHash');
    expect(authCookie(res)).toMatch(/HttpOnly/i);

    const me = await agent.get('/api/me');
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ user: { email: newUser.email } });
    expect(me.body).not.toHaveProperty('user.passwordHash');
  });

  it('returns a generic 401 for a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: newUser.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    });
    expect(authCookie(res)).toBeUndefined();
  });

  it('returns the same 401 for an unknown email as for a wrong password', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: newUser.email, password: 'wrong-password' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password' });

    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });
});

describe('protected routes (requireAuth)', () => {
  it('rejects a request with no auth cookie', async () => {
    const res = await request(app).get('/api/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  });

  it('rejects a tampered token', async () => {
    const cookie = authCookie(await register());
    expect(cookie).toBeDefined();
    const token = (cookie ?? '').split(';')[0]?.split('=')[1] ?? '';
    const tampered = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');

    const res = await request(app).get('/api/me').set('Cookie', `${AUTH_COOKIE}=${tampered}`);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('rejects requests after logout', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(newUser).expect(201);
    await agent.get('/api/me').expect(200);

    const res = await agent.post('/api/auth/logout');
    expect(res.status).toBe(204);
    expect(authCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);

    await agent.get('/api/me').expect(401);
  });
});

describe('rate limiting on /api/auth/*', () => {
  it('returns 429 RATE_LIMITED once the per-IP limit is exceeded', async () => {
    const limited = createApp({ authRateLimit: 2 });
    const attempt = () =>
      request(limited).post('/api/auth/login').send({ email: newUser.email, password: 'x' });

    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    const res = await attempt();

    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });
});

describe('unknown fields', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it.each([
    ['register', '/api/auth/register', { ...newUser, isAdmin: true }],
    ['login', '/api/auth/login', { email: newUser.email, password: newUser.password, remember: 1 }],
  ])('%s rejects them with 400 instead of ignoring them', async (_label, path, body) => {
    const res = await request(app).post(path).send(body);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});
