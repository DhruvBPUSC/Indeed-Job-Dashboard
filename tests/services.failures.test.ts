/**
 * Failure paths in the services: a session whose account no longer exists, and unexpected
 * database errors (which must surface as a generic 500, not a crash or a leaked message).
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma, resetDb } from './helpers/db.js';
import { createJob, createUserAgent, type TestUser } from './helpers/factories.js';

let user: TestUser;

beforeEach(async () => {
  await resetDb();
  user = await createUserAgent();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const signedOut = {
  error: { code: 'UNAUTHORIZED', message: 'Session is invalid or has expired' },
};

describe('a valid token for an account that was deleted', () => {
  beforeEach(async () => {
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('GET /api/me returns 401', async () => {
    const res = await user.agent.get('/api/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual(signedOut);
  });

  it('PATCH /api/me returns 401 and creates nothing', async () => {
    const res = await user.agent.patch('/api/me').send({ name: 'Ghost' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual(signedOut);
    expect(await prisma.user.count()).toBe(0);
  });

  it('GET /api/dashboard/summary returns 401', async () => {
    const res = await user.agent.get('/api/dashboard/summary');

    expect(res.status).toBe(401);
    expect(res.body).toEqual(signedOut);
  });
});

describe('unexpected database errors become a generic 500', () => {
  const dbDown = (): Error => new Error('connection terminated unexpectedly');
  const internal = { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } };

  it('when registering', async () => {
    vi.spyOn(prisma.user, 'create').mockRejectedValueOnce(dbDown());

    const res = await user.agent
      .post('/api/auth/register')
      .send({ name: 'New', email: 'new@example.com', password: 'correct-horse-9' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual(internal);
  });

  it('when updating the profile', async () => {
    vi.spyOn(prisma.user, 'update').mockRejectedValueOnce(dbDown());

    const res = await user.agent.patch('/api/me').send({ name: 'New Name' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual(internal);
  });

  it('when creating an application', async () => {
    const job = await createJob();
    vi.spyOn(prisma.application, 'create').mockRejectedValueOnce(dbDown());

    const res = await user.agent.post('/api/applications').send({ jobId: job.id });

    expect(res.status).toBe(500);
    expect(res.body).toEqual(internal);
  });

  it('when adding an interview', async () => {
    const job = await createJob();
    const created = await user.agent.post('/api/applications').send({ jobId: job.id }).expect(201);
    const appId = (created.body as { application: { id: string } }).application.id;
    vi.spyOn(prisma.interview, 'create').mockRejectedValueOnce(dbDown());

    const res = await user.agent
      .post(`/api/applications/${appId}/interviews`)
      .send({ scheduledAt: '2030-01-01T10:00:00Z', type: 'PHONE' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual(internal);
    expect(res.text).not.toContain('connection terminated');
  });
});

describe('interview deleted between update and re-read', () => {
  it('returns 404', async () => {
    const job = await createJob();
    const created = await user.agent.post('/api/applications').send({ jobId: job.id }).expect(201);
    const appId = (created.body as { application: { id: string } }).application.id;
    const interview = await prisma.interview.create({
      data: { applicationId: appId, scheduledAt: new Date(), type: 'PHONE' },
    });
    // The update succeeds, then the row vanishes before it's read back.
    vi.spyOn(prisma.interview, 'findFirst').mockResolvedValueOnce(null);

    const res = await user.agent
      .patch(`/api/applications/${appId}/interviews/${interview.id}`)
      .send({ notes: 'x' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Interview not found' } });
  });
});
