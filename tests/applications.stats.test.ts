import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEMO_EMAIL, seed } from '../prisma/seed.js';
import { app } from '../src/app.js';
import { ApplicationStatus } from '../src/generated/prisma/enums.js';
import { prisma, resetDb } from './helpers/db.js';
import { createJob, createUserAgent, type TestUser } from './helpers/factories.js';

interface StatsBody {
  counts: Record<ApplicationStatus, number>;
  total: number;
}

const URL = '/api/applications/stats/by-status';
const zeros = Object.fromEntries(Object.values(ApplicationStatus).map((s) => [s, 0]));

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/applications/stats/by-status', () => {
  describe('with seed data', () => {
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

    it('counts every status (zeros included) and an All total', async () => {
      const res = await demo.get(URL).expect(200);

      expect(res.body).toEqual({
        counts: { ...zeros, SAVED: 4, IN_PROGRESS: 5, INTERVIEW: 4, OFFER: 3 },
        total: 16,
      });
    });

    it('agrees with the list endpoint for every tab', async () => {
      const { counts, total } = (await demo.get(URL).expect(200)).body as StatsBody;

      expect((await demo.get('/api/applications').expect(200)).body).toMatchObject({ total });
      for (const status of Object.values(ApplicationStatus)) {
        const list = await demo.get('/api/applications').query({ status }).expect(200);
        expect(list.body, status).toMatchObject({ total: counts[status] });
      }
    });

    it('applies the same search as the list', async () => {
      const res = await demo.get(URL).query({ q: 'intern' }).expect(200);
      const list = await demo.get('/api/applications').query({ q: 'intern' }).expect(200);

      const body = res.body as StatsBody;
      expect(body.total).toBe((list.body as { total: number }).total);
      // Seed: Marketing + Data Analytics interns (In Progress), SWE + Software Developer interns
      // (Interview), Operations intern (Offer), UX Design intern (Saved).
      expect(body.counts).toEqual({ ...zeros, SAVED: 1, IN_PROGRESS: 2, INTERVIEW: 2, OFFER: 1 });
    });

    it('uses a single groupBy query', async () => {
      const groupBy = vi.spyOn(prisma.application, 'groupBy');
      const count = vi.spyOn(prisma.application, 'count');

      await demo.get(URL).expect(200);

      expect(groupBy).toHaveBeenCalledTimes(1);
      expect(count).not.toHaveBeenCalled();
      groupBy.mockRestore();
      count.mockRestore();
    });
  });

  describe('isolation and validation', () => {
    let user: TestUser;

    beforeEach(async () => {
      await resetDb();
      user = await createUserAgent('a@example.com');
    });

    it("counts only the current user's applications", async () => {
      const other = await createUserAgent('b@example.com');
      for (const status of ['APPLIED', 'OFFER'] as const) {
        const job = await createJob();
        await prisma.application.create({ data: { userId: other.id, jobId: job.id, status } });
      }
      const mine = await createJob();
      await prisma.application.create({
        data: { userId: user.id, jobId: mine.id, status: 'SAVED' },
      });

      const res = await user.agent.get(URL).expect(200);

      expect(res.body).toEqual({ counts: { ...zeros, SAVED: 1 }, total: 1 });
    });

    it('returns all zeros for a new user', async () => {
      expect((await user.agent.get(URL).expect(200)).body).toEqual({ counts: zeros, total: 0 });
    });

    it('requires auth', async () => {
      const res = await request(app).get(URL);

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    });

    it('rejects a search term over 100 characters', async () => {
      const res = await user.agent.get(URL).query({ q: 'x'.repeat(101) });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    });

    it('is not mistaken for an application id', async () => {
      // /:id is a single segment, but make sure "stats" never reaches the id route.
      const res = await user.agent.get('/api/applications/stats');

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    });
  });
});
