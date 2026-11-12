/**
 * User A must not be able to see or change anything belonging to user B. Every attempt returns
 * 404 (never 403, so ids can't be probed) and B's data is left exactly as it was.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma, resetDb } from './helpers/db.js';
import { createJob, createUserAgent, type TestUser } from './helpers/factories.js';

let a: TestUser;
let b: TestUser;
let bApplicationId: string;
let bInterviewId: string;
let bJobId: string;

const notFound = { error: { code: 'NOT_FOUND', message: 'Application not found' } };

/** Everything stored for B's application, to compare before/after. */
async function snapshotB(): Promise<unknown> {
  return prisma.application.findUnique({
    where: { id: bApplicationId },
    include: { statusHistory: { orderBy: { changedAt: 'asc' } }, interviews: true },
  });
}

beforeEach(async () => {
  await resetDb();
  a = await createUserAgent('a@example.com');
  b = await createUserAgent('b@example.com');

  bJobId = (await createJob({ title: 'Web Developer', company: 'Benefitfocus' })).id;
  const created = await b.agent
    .post('/api/applications')
    .send({ jobId: bJobId, status: 'APPLIED', notes: "B's private notes" })
    .expect(201);
  bApplicationId = (created.body as { application: { id: string } }).application.id;

  const interview = await b.agent
    .post(`/api/applications/${bApplicationId}/interviews`)
    .send({ scheduledAt: '2030-11-02T14:00:00Z', type: 'ONSITE' })
    .expect(201);
  bInterviewId = (interview.body as { interview: { id: string } }).interview.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("user A cannot access user B's application", () => {
  it('cannot read it', async () => {
    const res = await a.agent.get(`/api/applications/${bApplicationId}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(notFound);
  });

  it('cannot update its status or notes', async () => {
    const before = await snapshotB();

    for (const body of [
      { status: 'REJECTED' },
      { notes: 'hacked' },
      { status: 'OFFER', notes: 'x' },
    ]) {
      const res = await a.agent.patch(`/api/applications/${bApplicationId}`).send(body);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(notFound);
    }

    expect(await snapshotB()).toEqual(before);
  });

  it('cannot delete it', async () => {
    const before = await snapshotB();

    const res = await a.agent.delete(`/api/applications/${bApplicationId}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(notFound);
    expect(await snapshotB()).toEqual(before);
  });

  it('does not see it in their list, even when searching for it', async () => {
    for (const query of [{}, { q: 'Benefitfocus' }, { status: 'APPLIED' }]) {
      const res = await a.agent.get('/api/applications').query(query).expect(200);
      expect(res.body).toMatchObject({ data: [], total: 0 });
    }
  });

  it('cannot add, update, or delete its interviews', async () => {
    const before = await snapshotB();
    const base = `/api/applications/${bApplicationId}/interviews`;

    const add = await a.agent
      .post(base)
      .send({ scheduledAt: '2030-12-01T14:00:00Z', type: 'PHONE' });
    const update = await a.agent.patch(`${base}/${bInterviewId}`).send({ notes: 'hacked' });
    const remove = await a.agent.delete(`${base}/${bInterviewId}`);

    expect([add.status, update.status, remove.status]).toEqual([404, 404, 404]);
    expect(await snapshotB()).toEqual(before);
  });

  it("cannot reach B's interview through A's own application", async () => {
    const aJob = await createJob();
    const aApp = await a.agent.post('/api/applications').send({ jobId: aJob.id }).expect(201);
    const aAppId = (aApp.body as { application: { id: string } }).application.id;
    const before = await snapshotB();

    const path = `/api/applications/${aAppId}/interviews/${bInterviewId}`;
    expect((await a.agent.patch(path).send({ notes: 'hacked' })).status).toBe(404);
    expect((await a.agent.delete(path)).status).toBe(404);

    expect(await snapshotB()).toEqual(before);
  });

  it("does not learn B's application id from a duplicate check", async () => {
    // A tracking the same job is allowed (one application per user per job, not per job).
    const res = await a.agent.post('/api/applications').send({ jobId: bJobId });

    expect(res.status).toBe(201);
    expect((res.body as { application: { id: string } }).application.id).not.toBe(bApplicationId);
  });

  it('still lets B do everything', async () => {
    await b.agent.get(`/api/applications/${bApplicationId}`).expect(200);
    await b.agent
      .patch(`/api/applications/${bApplicationId}`)
      .send({ status: 'INTERVIEW' })
      .expect(200);
    await b.agent
      .patch(`/api/applications/${bApplicationId}/interviews/${bInterviewId}`)
      .send({ notes: 'Bring portfolio' })
      .expect(200);
    await b.agent.delete(`/api/applications/${bApplicationId}`).expect(204);
  });
});
