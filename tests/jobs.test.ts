import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import type { Job } from '../src/generated/prisma/client.js';
import { prisma, resetDb } from './helpers/db.js';
import { createJob, createUserAgent, type TestUser } from './helpers/factories.js';

interface JobBody {
  id: string;
  title: string;
  company: string;
  jobType: string;
  postedAt: string;
  applicationId: string | null;
  applicationStatus: string | null;
}
interface ListBody {
  data: JobBody[];
  page: number;
  pageSize: number;
  total: number;
}

const daysAgo = (n: number): Date => new Date(Date.now() - n * 86_400_000);

let user: TestUser;

beforeEach(async () => {
  await resetDb();
  user = await createUserAgent();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function list(query: Record<string, string | number> = {}): Promise<ListBody> {
  const res = await user.agent.get('/api/jobs').query(query).expect(200);
  return res.body as ListBody;
}

describe('auth', () => {
  it('requires auth for both endpoints', async () => {
    const job = await createJob();

    for (const path of ['/api/jobs', `/api/jobs/${job.id}`]) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    }
  });
});

describe('GET /api/jobs', () => {
  it('returns the list shape, newest first, with job fields and a null status by default', async () => {
    const older = await createJob({ title: 'Older', postedAt: daysAgo(5) });
    const newer = await createJob({ title: 'Newer', postedAt: daysAgo(1) });

    const body = await list();

    expect(body).toMatchObject({ page: 1, pageSize: 20, total: 2 });
    expect(body.data.map((j) => j.id)).toEqual([newer.id, older.id]);
    expect(body.data[0]).toEqual({
      id: newer.id,
      title: 'Newer',
      company: newer.company,
      location: newer.location,
      jobType: newer.jobType,
      description: newer.description,
      url: newer.url,
      postedAt: newer.postedAt.toISOString(),
      applicationId: null,
      applicationStatus: null,
    });
  });

  describe('pagination', () => {
    let jobs: Job[];

    beforeEach(async () => {
      // Five jobs, newest first: index 0 posted today, index 4 posted 4 days ago.
      jobs = [];
      for (let i = 0; i < 5; i++) jobs.push(await createJob({ postedAt: daysAgo(i) }));
    });

    it('pages through results without overlap', async () => {
      const page1 = await list({ page: 1, pageSize: 2 });
      const page2 = await list({ page: 2, pageSize: 2 });
      const page3 = await list({ page: 3, pageSize: 2 });

      expect(page1).toMatchObject({ page: 1, pageSize: 2, total: 5 });
      expect(page1.data.map((j) => j.id)).toEqual([jobs[0]?.id, jobs[1]?.id]);
      expect(page2.data.map((j) => j.id)).toEqual([jobs[2]?.id, jobs[3]?.id]);
      expect(page3.data.map((j) => j.id)).toEqual([jobs[4]?.id]);
    });

    it('returns an empty page past the end, with the real total', async () => {
      const body = await list({ page: 9, pageSize: 2 });

      expect(body).toEqual({ data: [], page: 9, pageSize: 2, total: 5 });
    });

    it('keeps a stable order when postedAt ties', async () => {
      await resetDb();
      user = await createUserAgent();
      const same = daysAgo(1);
      for (let i = 0; i < 6; i++) await createJob({ postedAt: same });

      const ids = [
        ...(await list({ page: 1, pageSize: 3 })).data,
        ...(await list({ page: 2, pageSize: 3 })).data,
      ].map((j) => j.id);

      expect(new Set(ids).size).toBe(6);
    });

    it('accepts pageSize 50 and rejects anything above it', async () => {
      expect((await list({ pageSize: 50 })).pageSize).toBe(50);

      const res = await user.agent.get('/api/jobs').query({ pageSize: 51 });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    });

    it.each([
      ['page=0', { page: 0 }],
      ['page=-1', { page: -1 }],
      ['page=abc', { page: 'abc' }],
      ['page=1.5', { page: 1.5 }],
      ['pageSize=0', { pageSize: 0 }],
    ])('rejects %s with 400', async (_label, query) => {
      const res = await user.agent.get('/api/jobs').query(query);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    });
  });

  describe('search (q)', () => {
    beforeEach(async () => {
      await createJob({ title: 'Software Engineering Intern', company: 'Blackbaud' });
      await createJob({ title: 'IT Support Specialist', company: 'Prisma Health' });
      await createJob({ title: 'Retail Sales Associate', company: 'Target' });
      await createJob({ title: 'Data Analyst', company: 'Software Solutions Inc' });
    });

    const titles = async (q: string): Promise<string[]> =>
      (await list({ q })).data.map((j) => j.title).sort();

    it('matches title case-insensitively', async () => {
      expect(await titles('SUPPORT')).toEqual(['IT Support Specialist']);
      expect(await titles('intern')).toEqual(['Software Engineering Intern']);
    });

    it('matches company case-insensitively', async () => {
      expect(await titles('prisma health')).toEqual(['IT Support Specialist']);
    });

    it('matches either title or company', async () => {
      expect(await titles('software')).toEqual(['Data Analyst', 'Software Engineering Intern']);
    });

    it('reports total for the filtered set', async () => {
      expect((await list({ q: 'software' })).total).toBe(2);
    });

    it('treats LIKE wildcards literally', async () => {
      expect((await list({ q: '%' })).total).toBe(0);
      expect((await list({ q: '_' })).total).toBe(0);
    });

    it('ignores a blank q', async () => {
      expect((await list({ q: '   ' })).total).toBe(4);
    });

    it('returns an empty list when nothing matches', async () => {
      expect(await list({ q: 'astronaut' })).toMatchObject({ data: [], total: 0 });
    });
  });

  describe('jobType filter', () => {
    beforeEach(async () => {
      await createJob({ title: 'SWE Intern', jobType: 'INTERNSHIP' });
      await createJob({ title: 'Data Intern', jobType: 'INTERNSHIP' });
      await createJob({ title: 'Barista', jobType: 'PART_TIME' });
      await createJob({ title: 'Web Developer', jobType: 'FULL_TIME_ENTRY' });
    });

    it('filters by jobType', async () => {
      const body = await list({ jobType: 'INTERNSHIP' });

      expect(body.total).toBe(2);
      expect(body.data.every((j) => j.jobType === 'INTERNSHIP')).toBe(true);
    });

    it('combines with q', async () => {
      const body = await list({ jobType: 'INTERNSHIP', q: 'data' });

      expect(body.data.map((j) => j.title)).toEqual(['Data Intern']);
    });

    it('rejects an unknown jobType with 400', async () => {
      const res = await user.agent.get('/api/jobs').query({ jobType: 'CONTRACT' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    });
  });

  describe('applicationStatus', () => {
    it("shows the current user's status and null for jobs they haven't tracked", async () => {
      const applied = await createJob({ title: 'Applied', postedAt: daysAgo(1) });
      await createJob({ title: 'Untracked', postedAt: daysAgo(2) });
      const application = await prisma.application.create({
        data: { userId: user.id, jobId: applied.id, status: 'INTERVIEW' },
      });

      const byTitle = Object.fromEntries((await list()).data.map((j) => [j.title, j]));

      expect(byTitle.Applied).toMatchObject({
        applicationId: application.id,
        applicationStatus: 'INTERVIEW',
      });
      expect(byTitle.Untracked).toMatchObject({ applicationId: null, applicationStatus: null });
    });

    it("never shows another user's application", async () => {
      const job = await createJob();
      const other = await createUserAgent('other@example.com');
      await prisma.application.create({
        data: { userId: other.id, jobId: job.id, status: 'OFFER' },
      });

      const [mine] = (await list()).data;
      expect(mine).toMatchObject({ id: job.id, applicationId: null, applicationStatus: null });

      const theirs = (await other.agent.get('/api/jobs').expect(200)).body as ListBody;
      expect(theirs.data[0]).toMatchObject({ applicationStatus: 'OFFER' });
    });
  });
});

describe('GET /api/jobs/:id', () => {
  it('returns the job with a null status when untracked', async () => {
    const job = await createJob({ title: 'Web Developer' });

    const res = await user.agent.get(`/api/jobs/${job.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      job: {
        id: job.id,
        title: 'Web Developer',
        company: job.company,
        location: job.location,
        jobType: job.jobType,
        description: job.description,
        url: job.url,
        postedAt: job.postedAt.toISOString(),
        applicationId: null,
        applicationStatus: null,
      },
    });
  });

  it("includes the current user's application status", async () => {
    const job = await createJob();
    await prisma.application.create({ data: { userId: user.id, jobId: job.id, status: 'SAVED' } });

    const res = await user.agent.get(`/api/jobs/${job.id}`).expect(200);

    expect(res.body).toMatchObject({ job: { applicationStatus: 'SAVED' } });
  });

  it("doesn't show another user's status", async () => {
    const job = await createJob();
    const other = await createUserAgent('other@example.com');
    await prisma.application.create({ data: { userId: other.id, jobId: job.id, status: 'OFFER' } });

    const res = await user.agent.get(`/api/jobs/${job.id}`).expect(200);

    expect(res.body).toMatchObject({ job: { applicationId: null, applicationStatus: null } });
  });

  it('returns 404 for an unknown id', async () => {
    const res = await user.agent.get(`/api/jobs/${randomUUID()}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
  });

  it('returns 400 for a malformed id', async () => {
    const res = await user.agent.get('/api/jobs/not-a-uuid');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});
