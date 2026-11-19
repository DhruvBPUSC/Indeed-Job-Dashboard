import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import type { Job } from '../src/generated/prisma/client.js';
import { prisma, resetDb } from './helpers/db.js';
import { createJob, createUserAgent, type TestUser } from './helpers/factories.js';

interface HistoryBody {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedAt: string;
}
interface InterviewBody {
  id: string;
  applicationId: string;
  scheduledAt: string;
  type: string;
  notes: string | null;
}
interface ApplicationBody {
  id: string;
  jobId: string;
  status: string;
  dateApplied: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  job: Record<string, unknown>;
  statusHistory: HistoryBody[];
  interviews: InterviewBody[];
}
interface ListBody {
  data: (Omit<ApplicationBody, 'statusHistory' | 'interviews'> & {
    job: { id: string; title: string; company: string; location: string; jobType: string };
    nextInterview: { id: string; scheduledAt: string; type: string } | null;
  })[];
  page: number;
  pageSize: number;
  total: number;
}

const daysAgo = (n: number): Date => new Date(Date.now() - n * 86_400_000);

let user: TestUser;
let job: Job;

beforeEach(async () => {
  await resetDb();
  user = await createUserAgent();
  job = await createJob({ title: 'Software Engineering Intern', company: 'Blackbaud' });
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function create(body: object): Promise<ApplicationBody> {
  const res = await user.agent.post('/api/applications').send(body).expect(201);
  return (res.body as { application: ApplicationBody }).application;
}

async function patch(id: string, body: object): Promise<ApplicationBody> {
  const res = await user.agent.patch(`/api/applications/${id}`).send(body).expect(200);
  return (res.body as { application: ApplicationBody }).application;
}

async function get(id: string): Promise<ApplicationBody> {
  const res = await user.agent.get(`/api/applications/${id}`).expect(200);
  return (res.body as { application: ApplicationBody }).application;
}

/** Runs fn and returns the [before, after] window it ran in, for timestamp assertions. */
async function timed<T>(fn: () => Promise<T>): Promise<[T, number, number]> {
  const before = Date.now();
  const result = await fn();
  return [result, before, Date.now()];
}

function expectWithin(iso: string | null, before: number, after: number): void {
  expect(iso).not.toBeNull();
  const t = new Date(iso ?? '').getTime();
  expect(t).toBeGreaterThanOrEqual(before);
  expect(t).toBeLessThanOrEqual(after);
}

describe('auth', () => {
  it('requires auth on every route', async () => {
    const id = randomUUID();
    const calls = [
      request(app).get('/api/applications'),
      request(app).post('/api/applications').send({ jobId: job.id }),
      request(app).get(`/api/applications/${id}`),
      request(app).patch(`/api/applications/${id}`).send({ notes: 'x' }),
      request(app).delete(`/api/applications/${id}`),
      request(app).post(`/api/applications/${id}/interviews`).send({}),
      request(app).patch(`/api/applications/${id}/interviews/${id}`).send({}),
      request(app).delete(`/api/applications/${id}/interviews/${id}`),
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    }
  });
});

describe('POST /api/applications', () => {
  it('defaults to SAVED with no dateApplied and one null→SAVED history row', async () => {
    const application = await create({ jobId: job.id });

    expect(application).toMatchObject({
      jobId: job.id,
      status: 'SAVED',
      dateApplied: null,
      notes: null,
      job: { id: job.id, title: job.title, company: job.company, description: job.description },
      interviews: [],
    });
    expect(application.statusHistory).toEqual([
      {
        id: expect.any(String) as string,
        fromStatus: null,
        toStatus: 'SAVED',
        changedAt: application.createdAt,
      },
    ]);
  });

  it('sets dateApplied immediately when created in a non-SAVED status', async () => {
    const [application, before, after] = await timed(() =>
      create({ jobId: job.id, status: 'APPLIED', notes: '  Applied via career fair  ' }),
    );

    expect(application.status).toBe('APPLIED');
    expect(application.notes).toBe('Applied via career fair');
    expectWithin(application.dateApplied, before, after);
    expect(application.statusHistory).toMatchObject([{ fromStatus: null, toStatus: 'APPLIED' }]);
  });

  it('returns 409 with the existing id if the user already has an application for the job', async () => {
    const existing = await create({ jobId: job.id });

    const res = await user.agent
      .post('/api/applications')
      .send({ jobId: job.id, status: 'APPLIED' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: {
        code: 'APPLICATION_EXISTS',
        message: 'You already have an application for this job',
        details: { applicationId: existing.id },
      },
    });
    expect(await prisma.application.count()).toBe(1);
    expect(await prisma.statusHistory.count()).toBe(1);
  });

  it('returns 404 for a job that does not exist', async () => {
    const res = await user.agent.post('/api/applications').send({ jobId: randomUUID() });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
  });

  it.each([
    ['missing jobId', () => ({})],
    ['malformed jobId', () => ({ jobId: 'abc' })],
    ['unknown status', () => ({ jobId: job.id, status: 'GHOSTED' })],
    ['unknown field', () => ({ jobId: job.id, userId: randomUUID() })],
    ['notes too long', () => ({ jobId: job.id, notes: 'x'.repeat(5001) })],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await user.agent.post('/api/applications').send(body());

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});

describe('PATCH /api/applications/:id', () => {
  describe('status history', () => {
    it('records each change with from/to in order, newest first in GET', async () => {
      const { id } = await create({ jobId: job.id });

      await patch(id, { status: 'APPLIED' });
      await patch(id, { status: 'INTERVIEW' });
      const updated = await patch(id, { status: 'OFFER' });

      expect(updated.status).toBe('OFFER');
      const transitions = (await get(id)).statusHistory.map((h) => [h.fromStatus, h.toStatus]);
      expect(transitions).toEqual([
        ['INTERVIEW', 'OFFER'],
        ['APPLIED', 'INTERVIEW'],
        ['SAVED', 'APPLIED'],
        [null, 'SAVED'],
      ]);
      expect(await prisma.statusHistory.count({ where: { applicationId: id } })).toBe(4);
    });

    it('timestamps the history row at the moment of the change', async () => {
      const { id } = await create({ jobId: job.id });

      const [updated, before, after] = await timed(() => patch(id, { status: 'APPLIED' }));

      expectWithin(updated.statusHistory[0]?.changedAt ?? null, before, after);
    });

    it('writes no history when the status is unchanged', async () => {
      const { id } = await create({ jobId: job.id, status: 'APPLIED' });

      const updated = await patch(id, { status: 'APPLIED' });

      expect(updated.statusHistory).toHaveLength(1);
    });

    it('writes no history for a notes-only update', async () => {
      const { id } = await create({ jobId: job.id });

      const updated = await patch(id, { notes: 'Recruiter: Jordan' });

      expect(updated).toMatchObject({ status: 'SAVED', notes: 'Recruiter: Jordan' });
      expect(updated.statusHistory).toHaveLength(1);
    });

    it('keeps the history chain consistent under concurrent status changes', async () => {
      const { id } = await create({ jobId: job.id });
      const targets = ['APPLIED', 'IN_PROGRESS', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'];

      const results = await Promise.all(
        targets.map((status) => user.agent.patch(`/api/applications/${id}`).send({ status })),
      );
      expect(results.map((r) => r.status)).toEqual(targets.map(() => 200));

      // Every change must start from the status the previous change ended on.
      const rows = await prisma.statusHistory.findMany({ where: { applicationId: id } });
      expect(rows).toHaveLength(targets.length + 1);
      const fromCounts = new Map<string | null, number>();
      for (const r of rows) fromCounts.set(r.fromStatus, (fromCounts.get(r.fromStatus) ?? 0) + 1);
      expect([...fromCounts.values()].every((n) => n === 1)).toBe(true);

      let current: string | null = null;
      for (let i = 0; i < rows.length; i++) {
        const next = rows.find((r) => r.fromStatus === current);
        expect(next).toBeDefined();
        current = next?.toStatus ?? null;
      }
      const final = await prisma.application.findUniqueOrThrow({ where: { id } });
      expect(final.status).toBe(current);
    });
  });

  describe('dateApplied', () => {
    it('is set the first time status leaves SAVED', async () => {
      const { id } = await create({ jobId: job.id });

      const [updated, before, after] = await timed(() => patch(id, { status: 'APPLIED' }));

      expectWithin(updated.dateApplied, before, after);
      expect(updated.dateApplied).toBe(updated.statusHistory[0]?.changedAt);
    });

    it('is set even when SAVED jumps straight to a later status', async () => {
      const { id } = await create({ jobId: job.id });

      const updated = await patch(id, { status: 'INTERVIEW' });

      expect(updated.dateApplied).not.toBeNull();
    });

    it('does not change on later status changes', async () => {
      const { id } = await create({ jobId: job.id });
      const { dateApplied } = await patch(id, { status: 'APPLIED' });

      await patch(id, { status: 'INTERVIEW' });
      const final = await patch(id, { status: 'OFFER' });

      expect(final.dateApplied).toBe(dateApplied);
    });

    it('is kept if the application goes back to SAVED and leaves it again', async () => {
      const { id } = await create({ jobId: job.id });
      const { dateApplied } = await patch(id, { status: 'APPLIED' });

      const backToSaved = await patch(id, { status: 'SAVED' });
      expect(backToSaved.dateApplied).toBe(dateApplied);

      const again = await patch(id, { status: 'APPLIED' });
      expect(again.dateApplied).toBe(dateApplied);
    });

    it('is kept from creation when created as APPLIED', async () => {
      const created = await create({ jobId: job.id, status: 'APPLIED' });

      const updated = await patch(created.id, { status: 'IN_PROGRESS' });

      expect(updated.dateApplied).toBe(created.dateApplied);
    });

    it('stays null for notes-only updates on a SAVED application', async () => {
      const { id } = await create({ jobId: job.id });

      expect((await patch(id, { notes: 'later' })).dateApplied).toBeNull();
    });
  });

  it('clears notes with null and with a blank string', async () => {
    const { id } = await create({ jobId: job.id, notes: 'first' });

    expect((await patch(id, { notes: null })).notes).toBeNull();
    await patch(id, { notes: 'second' });
    expect((await patch(id, { notes: '   ' })).notes).toBeNull();
  });

  it.each([
    ['an empty body', {}],
    ['an unknown status', { status: 'GHOSTED' }],
    ['a field that cannot be changed', { jobId: randomUUID() }],
    ['dateApplied (server-managed)', { dateApplied: new Date().toISOString() }],
  ])('rejects %s with 400', async (_label, body) => {
    const { id } = await create({ jobId: job.id });

    const res = await user.agent.patch(`/api/applications/${id}`).send(body);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('returns 404 for an unknown id and 400 for a malformed one', async () => {
    expect(
      (await user.agent.patch(`/api/applications/${randomUUID()}`).send({ notes: 'x' })).status,
    ).toBe(404);
    expect((await user.agent.patch('/api/applications/nope').send({ notes: 'x' })).status).toBe(
      400,
    );
  });
});

describe('GET /api/applications/:id', () => {
  it('includes the full job, history newest first, and interviews soonest first', async () => {
    const { id } = await create({ jobId: job.id });
    await patch(id, { status: 'APPLIED' });
    const later = await prisma.interview.create({
      data: { applicationId: id, scheduledAt: new Date('2030-01-10T15:00:00Z'), type: 'ONSITE' },
    });
    const sooner = await prisma.interview.create({
      data: { applicationId: id, scheduledAt: new Date('2030-01-03T15:00:00Z'), type: 'PHONE' },
    });

    const application = await get(id);

    expect(application.job).toEqual({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      jobType: job.jobType,
      description: job.description,
      url: job.url,
      postedAt: job.postedAt.toISOString(),
    });
    expect(application.statusHistory.map((h) => h.toStatus)).toEqual(['APPLIED', 'SAVED']);
    expect(application.interviews.map((i) => i.id)).toEqual([sooner.id, later.id]);
    expect(application).not.toHaveProperty('userId');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await user.agent.get(`/api/applications/${randomUUID()}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
  });
});

describe('DELETE /api/applications/:id', () => {
  it('deletes the application with its history and interviews', async () => {
    const { id } = await create({ jobId: job.id, status: 'APPLIED' });
    await prisma.interview.create({
      data: { applicationId: id, scheduledAt: new Date(), type: 'PHONE' },
    });

    await user.agent.delete(`/api/applications/${id}`).expect(204);

    expect(await prisma.application.count({ where: { id } })).toBe(0);
    expect(await prisma.statusHistory.count({ where: { applicationId: id } })).toBe(0);
    expect(await prisma.interview.count({ where: { applicationId: id } })).toBe(0);
    await user.agent.get(`/api/applications/${id}`).expect(404);
    await user.agent.delete(`/api/applications/${id}`).expect(404);
  });

  it('lets the user track the same job again afterwards', async () => {
    const { id } = await create({ jobId: job.id });
    await user.agent.delete(`/api/applications/${id}`).expect(204);

    await create({ jobId: job.id });
  });
});

describe('GET /api/applications', () => {
  /** Creates applications directly so dates can be controlled. */
  async function seedApplications(): Promise<Record<string, string>> {
    const specs = [
      { company: 'Acme', title: 'Web Developer', status: 'APPLIED', applied: 10, updated: 3 },
      {
        company: 'Zeta Corp',
        title: 'IT Support Specialist',
        status: 'INTERVIEW',
        applied: 20,
        updated: 1,
      },
      {
        company: 'Blue Co',
        title: 'Retail Sales Associate',
        status: 'OFFER',
        applied: 5,
        updated: 2,
      },
      { company: 'Mango', title: 'Data Analyst', status: 'SAVED', applied: null, updated: 4 },
    ] as const;
    const ids: Record<string, string> = {};
    for (const s of specs) {
      const j = await createJob({ title: s.title, company: s.company });
      const a = await prisma.application.create({
        data: {
          userId: user.id,
          jobId: j.id,
          status: s.status,
          dateApplied: s.applied === null ? null : daysAgo(s.applied),
          createdAt: daysAgo(30),
          updatedAt: daysAgo(s.updated),
        },
      });
      ids[s.company] = a.id;
    }
    return ids;
  }

  async function list(query: Record<string, string | number | string[]> = {}): Promise<ListBody> {
    const res = await user.agent.get('/api/applications').query(query).expect(200);
    return res.body as ListBody;
  }
  const companies = (body: ListBody): string[] => body.data.map((a) => a.job.company);

  it('returns the list shape with job title, company, location, and type, most recently updated first', async () => {
    await seedApplications();

    const body = await list();

    expect(body).toMatchObject({ page: 1, pageSize: 20, total: 4 });
    expect(companies(body)).toEqual(['Zeta Corp', 'Blue Co', 'Acme', 'Mango']);
    expect(body.data[0]?.job).toEqual({
      id: expect.any(String) as string,
      title: 'IT Support Specialist',
      company: 'Zeta Corp',
      location: 'Columbia, SC',
      jobType: 'FULL_TIME_ENTRY',
    });
    expect(body.data[0]?.nextInterview).toBeNull();
    expect(body.data[0]).not.toHaveProperty('statusHistory');
    expect(body.data[0]).not.toHaveProperty('userId');
  });

  it('includes only the soonest upcoming interview as nextInterview', async () => {
    const ids = await seedApplications();
    const applicationId = ids['Zeta Corp'] ?? '';
    const inDays = (n: number): Date => new Date(Date.now() + n * 86_400_000);
    await prisma.interview.createMany({
      data: [
        { applicationId, scheduledAt: daysAgo(2), type: 'PHONE' }, // past: ignored
        { applicationId, scheduledAt: inDays(9), type: 'ONSITE' },
        { applicationId, scheduledAt: inDays(3), type: 'VIRTUAL' },
      ],
    });

    const body = await list();
    const zeta = body.data.find((a) => a.job.company === 'Zeta Corp');
    const acme = body.data.find((a) => a.job.company === 'Acme');

    expect(zeta?.nextInterview).toEqual({
      id: expect.any(String) as string,
      scheduledAt: expect.any(String) as string,
      type: 'VIRTUAL',
    });
    expect(new Date(zeta?.nextInterview?.scheduledAt ?? '').getTime()).toBeGreaterThan(Date.now());
    expect(acme?.nextInterview).toBeNull();
    expect(zeta).not.toHaveProperty('interviews');
  });

  describe('status filter', () => {
    it('filters by a single status', async () => {
      await seedApplications();

      const body = await list({ status: 'SAVED' });

      expect(body.total).toBe(1);
      expect(companies(body)).toEqual(['Mango']);
    });

    it('accepts repeated status params', async () => {
      await seedApplications();

      const res = await user.agent.get('/api/applications?status=APPLIED&status=OFFER').expect(200);

      expect(companies(res.body as ListBody).sort()).toEqual(['Acme', 'Blue Co']);
    });

    it('accepts comma-separated statuses', async () => {
      await seedApplications();

      const body = await list({ status: 'INTERVIEW,OFFER' });

      expect(companies(body).sort()).toEqual(['Blue Co', 'Zeta Corp']);
    });

    it('rejects an unknown status with 400', async () => {
      const res = await user.agent.get('/api/applications?status=APPLIED&status=GHOSTED');

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    });
  });

  describe('search (q)', () => {
    it('matches job title or company, case-insensitively', async () => {
      await seedApplications();

      expect(companies(await list({ q: 'support' }))).toEqual(['Zeta Corp']);
      expect(companies(await list({ q: 'BLUE' }))).toEqual(['Blue Co']);
    });

    it('combines with the status filter and treats wildcards literally', async () => {
      await seedApplications();

      expect((await list({ q: 'a', status: 'SAVED' })).total).toBe(1);
      expect((await list({ q: '%' })).total).toBe(0);
    });
  });

  describe('sort', () => {
    it('sorts by dateApplied, keeping SAVED (null) last in both directions', async () => {
      await seedApplications();

      expect(companies(await list({ sort: 'dateApplied', order: 'desc' }))).toEqual([
        'Blue Co',
        'Acme',
        'Zeta Corp',
        'Mango',
      ]);
      expect(companies(await list({ sort: 'dateApplied', order: 'asc' }))).toEqual([
        'Zeta Corp',
        'Acme',
        'Blue Co',
        'Mango',
      ]);
    });

    it('sorts by company', async () => {
      await seedApplications();

      expect(companies(await list({ sort: 'company', order: 'asc' }))).toEqual([
        'Acme',
        'Blue Co',
        'Mango',
        'Zeta Corp',
      ]);
      expect(companies(await list({ sort: 'company', order: 'desc' }))).toEqual([
        'Zeta Corp',
        'Mango',
        'Blue Co',
        'Acme',
      ]);
    });

    it('sorts by updatedAt ascending', async () => {
      await seedApplications();

      expect(companies(await list({ sort: 'updatedAt', order: 'asc' }))).toEqual([
        'Mango',
        'Acme',
        'Blue Co',
        'Zeta Corp',
      ]);
    });

    it.each([{ sort: 'title' }, { order: 'sideways' }])('rejects %o with 400', async (query) => {
      const res = await user.agent.get('/api/applications').query(query);

      expect(res.status).toBe(400);
    });
  });

  it('paginates', async () => {
    await seedApplications();

    const page1 = await list({ pageSize: 3, sort: 'company', order: 'asc' });
    const page2 = await list({ pageSize: 3, page: 2, sort: 'company', order: 'asc' });

    expect(page1).toMatchObject({ page: 1, pageSize: 3, total: 4 });
    expect(companies(page1)).toEqual(['Acme', 'Blue Co', 'Mango']);
    expect(companies(page2)).toEqual(['Zeta Corp']);
    expect((await user.agent.get('/api/applications').query({ pageSize: 51 })).status).toBe(400);
  });
});

describe('interviews', () => {
  let applicationId: string;

  beforeEach(async () => {
    applicationId = (await create({ jobId: job.id, status: 'INTERVIEW' })).id;
  });

  const base = (): string => `/api/applications/${applicationId}/interviews`;

  it('creates an interview (UTC) and shows it on the application', async () => {
    const res = await user.agent.post(base()).send({
      scheduledAt: '2030-11-02T10:00:00-04:00',
      type: 'VIRTUAL',
      notes: 'Zoom link in email',
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      interview: {
        id: expect.any(String) as string,
        applicationId,
        scheduledAt: '2030-11-02T14:00:00.000Z',
        type: 'VIRTUAL',
        notes: 'Zoom link in email',
      },
    });
    expect((await get(applicationId)).interviews).toHaveLength(1);
  });

  it.each([
    ['missing scheduledAt', { type: 'PHONE' }],
    ['a date without a time zone', { scheduledAt: '2030-11-02T10:00:00', type: 'PHONE' }],
    ['a non-date', { scheduledAt: 'next tuesday', type: 'PHONE' }],
    ['an unknown type', { scheduledAt: '2030-11-02T10:00:00Z', type: 'CARRIER_PIGEON' }],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await user.agent.post(base()).send(body);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('updates and deletes an interview', async () => {
    const created = (
      await user.agent
        .post(base())
        .send({ scheduledAt: '2030-11-02T14:00:00Z', type: 'PHONE' })
        .expect(201)
    ).body as { interview: InterviewBody };
    const url = `${base()}/${created.interview.id}`;

    const updated = await user.agent
      .patch(url)
      .send({ type: 'ONSITE', scheduledAt: '2030-11-05T15:30:00Z' })
      .expect(200);
    expect(updated.body).toMatchObject({
      interview: { type: 'ONSITE', scheduledAt: '2030-11-05T15:30:00.000Z', notes: null },
    });

    await user.agent.patch(url).send({}).expect(400);

    await user.agent.delete(url).expect(204);
    await user.agent.delete(url).expect(404);
    expect((await get(applicationId)).interviews).toEqual([]);
  });

  it('returns 404 when the interview belongs to a different application of the same user', async () => {
    const otherJob = await createJob();
    const otherApp = await create({ jobId: otherJob.id });
    const interview = await prisma.interview.create({
      data: { applicationId: otherApp.id, scheduledAt: new Date(), type: 'PHONE' },
    });

    const wrongPath = `${base()}/${interview.id}`;
    await user.agent.patch(wrongPath).send({ notes: 'x' }).expect(404);
    await user.agent.delete(wrongPath).expect(404);
    expect(await prisma.interview.count({ where: { id: interview.id } })).toBe(1);
  });

  it('returns 404 for an unknown application', async () => {
    const res = await user.agent
      .post(`/api/applications/${randomUUID()}/interviews`)
      .send({ scheduledAt: '2030-11-02T14:00:00Z', type: 'PHONE' });

    expect(res.status).toBe(404);
  });
});
