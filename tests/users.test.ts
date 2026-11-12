import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { expectNoPasswordHash } from './helpers/assertions.js';
import { prisma, resetDb } from './helpers/db.js';

const credentials = {
  name: 'Cayden Willey',
  email: 'cayden@example.com',
  password: 'correct-horse-9',
};

let agent: ReturnType<typeof request.agent>;

beforeEach(async () => {
  await resetDb();
  agent = request.agent(app);
  await agent.post('/api/auth/register').send(credentials).expect(201);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/me', () => {
  it('returns the logged-in user', async () => {
    const res = await agent.get('/api/me');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: {
        id: expect.any(String) as string,
        name: credentials.name,
        email: credentials.email,
        createdAt: expect.any(String) as string,
        updatedAt: expect.any(String) as string,
      },
    });
  });

  it('requires auth', async () => {
    const res = await request(app).get('/api/me');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });
});

describe('PATCH /api/me', () => {
  it('updates the name (trimmed) and persists it', async () => {
    const res = await agent.patch('/api/me').send({ name: '  Cayden W. ' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ user: { name: 'Cayden W.', email: credentials.email } });

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: credentials.email } });
    expect(stored.name).toBe('Cayden W.');
    expect((await agent.get('/api/me')).body).toMatchObject({ user: { name: 'Cayden W.' } });
  });

  it('rejects an empty name', async () => {
    const res = await agent.patch('/api/me').send({ name: '   ' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('rejects fields other than name instead of silently ignoring them', async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { email: credentials.email } });

    const res = await agent
      .patch('/api/me')
      .send({ name: 'New Name', email: 'hijack@example.com', passwordHash: 'x' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: before.id } });
    expect(after).toEqual(before);
  });

  it('requires auth', async () => {
    const res = await request(app).patch('/api/me').send({ name: 'Nope' });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });
});

describe('passwordHash is never returned', () => {
  it('is absent from every user-returning response', async () => {
    const fresh = request.agent(app);
    const responses = [
      await fresh.post('/api/auth/register').send({ ...credentials, email: 'second@example.com' }),
      await fresh
        .post('/api/auth/login')
        .send({ email: 'second@example.com', password: credentials.password }),
      await agent.get('/api/me'),
      await agent.patch('/api/me').send({ name: 'Renamed' }),
    ];

    for (const res of responses) {
      expect(res.status).toBeLessThan(300);
      expect(res.body).toHaveProperty('user.id'); // sanity: the check below ran on a real user
      await expectNoPasswordHash(res);
    }
  });
});
