import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEMO_EMAIL, seed } from '../prisma/seed.js';
import { app } from '../src/app.js';
import { ApplicationStatus } from '../src/generated/prisma/enums.js';
import { countByCard, DASHBOARD_BUCKETS } from '../src/modules/dashboard/buckets.js';
import { prisma, resetDb } from './helpers/db.js';
import { createJob, createUserAgent, type TestUser } from './helpers/factories.js';

interface SummaryBody {
  greetingName: string;
  counts: { total: number; inProgress: number; interview: number; offer: number };
  recentApplications: {
    id: string;
    jobTitle: string;
    company: string;
    dateApplied: string;
    status: string;
  }[];
  upcomingInterviews: {
    id: string;
    applicationId: string;
    scheduledAt: string;
    type: string;
    jobTitle: string;
    company: string;
  }[];
}

const DAY = 86_400_000;
const daysFromNow = (n: number): Date => new Date(Date.now() + n * DAY);

async function summary(agent: TestUser['agent']): Promise<SummaryBody> {
  const res = await agent.get('/api/dashboard/summary').expect(200);
  return res.body as SummaryBody;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/dashboard/summary — seed data', () => {
  let demo: TestUser['agent'];

  beforeEach(async () => {
    await resetDb();
    await seed();
    demo = request.agent(app);
    await demo
      .post('/api/auth/login')
      .send({ email: DEMO_EMAIL, password: process.env.SEED_DEMO_PASSWORD })
      .expect(200);
  });

  it('matches the mockup: 12 total, 5 in progress, 4 interview, 3 offer', async () => {
    const body = await summary(demo);

    expect(body.counts).toEqual({ total: 12, inProgress: 5, interview: 4, offer: 3 });
  });

  it('greets the demo user by first name', async () => {
    expect((await summary(demo)).greetingName).toBe('Cayden');
  });

  it('lists the 5 most recent applications by dateApplied', async () => {
    const { recentApplications } = await summary(demo);

    expect(recentApplications.map((a) => [a.jobTitle, a.company, a.status])).toEqual([
      ['Marketing Intern', 'ScanSource', 'IN_PROGRESS'],
      ['Associate Data Analyst', 'BlueCross BlueShield of South Carolina', 'IN_PROGRESS'],
      ['Retail Sales Associate', 'Target', 'IN_PROGRESS'],
      ['Help Desk Technician', 'Lexington Medical Center', 'INTERVIEW'],
      ['Customer Support Associate', 'Zendesk', 'IN_PROGRESS'],
    ]);
    const dates = recentApplications.map((a) => Date.parse(a.dateApplied));
    expect(dates).toEqual([...dates].sort((x, y) => y - x));
    expect(Object.keys(recentApplications[0] ?? {}).sort()).toEqual(
      ['company', 'dateApplied', 'id', 'jobTitle', 'status'].sort(),
    );
  });

  it('lists the upcoming interviews soonest first', async () => {
    const { upcomingInterviews } = await summary(demo);

    expect(upcomingInterviews.map((i) => [i.jobTitle, i.company, i.type])).toEqual([
      ['Software Engineering Intern', 'Blackbaud', 'VIRTUAL'],
      ['IT Support Specialist', 'Prisma Health', 'ONSITE'],
    ]);
    for (const i of upcomingInterviews)
      expect(Date.parse(i.scheduledAt)).toBeGreaterThan(Date.now());
  });

  it('computes all counts with a single groupBy query', async () => {
    const groupBy = vi.spyOn(prisma.application, 'groupBy');
    const count = vi.spyOn(prisma.application, 'count');

    await summary(demo);

    expect(groupBy).toHaveBeenCalledTimes(1);
    expect(count).not.toHaveBeenCalled();
    groupBy.mockRestore();
    count.mockRestore();
  });
});

describe('buckets.ts', () => {
  it('excludes SAVED from every card', () => {
    for (const statuses of Object.values(DASHBOARD_BUCKETS)) {
      expect(statuses).not.toContain(ApplicationStatus.SAVED);
    }
    expect(countByCard({ SAVED: 7 })).toEqual({ total: 0, inProgress: 0, interview: 0, offer: 0 });
  });

  it('counts every non-SAVED status toward Total', () => {
    const tracked = Object.values(ApplicationStatus).filter((s) => s !== 'SAVED');
    expect([...DASHBOARD_BUCKETS.total].sort()).toEqual(tracked.sort());
  });

  it('maps statuses to cards', () => {
    expect(
      countByCard({
        SAVED: 4,
        APPLIED: 2,
        IN_PROGRESS: 5,
        INTERVIEW: 4,
        OFFER: 3,
        REJECTED: 6,
        WITHDRAWN: 1,
      }),
    ).toEqual({
      total: 21,
      // Follows DASHBOARD_BUCKETS so the test still holds if the team changes the APPLIED rule.
      inProgress: DASHBOARD_BUCKETS.inProgress.includes(ApplicationStatus.APPLIED) ? 7 : 5,
      interview: 4,
      offer: 3,
    });
  });
});

describe('GET /api/dashboard/summary — edge cases', () => {
  let user: TestUser;

  beforeEach(async () => {
    await resetDb();
    user = await createUserAgent('new@example.com');
  });

  async function track(
    owner: TestUser,
    status: ApplicationStatus,
    opts: { dateApplied?: Date | null; interviewsAt?: Date[] } = {},
  ): Promise<string> {
    const job = await createJob();
    const app = await prisma.application.create({
      data: {
        userId: owner.id,
        jobId: job.id,
        status,
        dateApplied: opts.dateApplied === undefined ? new Date() : opts.dateApplied,
        interviews: {
          create: (opts.interviewsAt ?? []).map((scheduledAt) => ({ scheduledAt, type: 'PHONE' })),
        },
      },
    });
    return app.id;
  }

  it('requires auth', async () => {
    const res = await request(app).get('/api/dashboard/summary');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('returns zeros and empty lists for a new user', async () => {
    expect(await summary(user.agent)).toEqual({
      greetingName: 'Test',
      counts: { total: 0, inProgress: 0, interview: 0, offer: 0 },
      recentApplications: [],
      upcomingInterviews: [],
    });
  });

  it("ignores other users' applications and interviews", async () => {
    const other = await createUserAgent('other@example.com');
    await track(other, 'OFFER', { interviewsAt: [daysFromNow(1)] });

    const body = await summary(user.agent);

    expect(body.counts.total).toBe(0);
    expect(body.recentApplications).toEqual([]);
    expect(body.upcomingInterviews).toEqual([]);
  });

  it('counts REJECTED and WITHDRAWN toward Total only', async () => {
    await track(user, 'REJECTED');
    await track(user, 'WITHDRAWN');

    expect((await summary(user.agent)).counts).toEqual({
      total: 2,
      inProgress: 0,
      interview: 0,
      offer: 0,
    });
  });

  it('caps recent applications at 5 and leaves out SAVED (no dateApplied)', async () => {
    await track(user, 'SAVED', { dateApplied: null });
    for (let i = 1; i <= 7; i++) await track(user, 'APPLIED', { dateApplied: daysFromNow(-i) });

    const { recentApplications } = await summary(user.agent);

    expect(recentApplications).toHaveLength(5);
    expect(recentApplications.every((a) => a.status === 'APPLIED')).toBe(true);
    expect(Date.parse(recentApplications[0]?.dateApplied ?? '')).toBeGreaterThan(
      Date.parse(recentApplications[4]?.dateApplied ?? ''),
    );
  });

  it('returns only the next 3 future interviews, soonest first', async () => {
    const [in2, in5, in9, in14] = [2, 5, 9, 14].map(daysFromNow);
    const past = daysFromNow(-1);
    const applicationId = await track(user, 'INTERVIEW', {
      interviewsAt: [in9, past, in2, in14, in5].filter((d) => d !== undefined),
    });

    const { upcomingInterviews } = await summary(user.agent);

    expect(upcomingInterviews.map((i) => i.scheduledAt)).toEqual(
      [in2, in5, in9].map((d) => d?.toISOString()),
    );
    expect(upcomingInterviews.every((i) => i.applicationId === applicationId)).toBe(true);
  });
});
