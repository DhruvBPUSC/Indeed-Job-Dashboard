import request from 'supertest';

import { app } from '../../src/app.js';
import type { Job, Prisma } from '../../src/generated/prisma/client.js';
import { prisma } from './db.js';

let jobCounter = 0;

export function createJob(overrides: Partial<Prisma.JobCreateInput> = {}): Promise<Job> {
  jobCounter += 1;
  return prisma.job.create({
    data: {
      title: `Test Job ${jobCounter}`,
      company: `Test Co ${jobCounter}`,
      location: 'Columbia, SC',
      jobType: 'FULL_TIME_ENTRY',
      description: 'A test job.',
      url: `https://jobs.example.com/test-${jobCounter}`,
      postedAt: new Date(),
      ...overrides,
    },
  });
}

export interface TestUser {
  id: string;
  agent: ReturnType<typeof request.agent>;
}

/** Registers a user and returns a supertest agent that carries their auth cookie. */
export async function createUserAgent(email = 'user@example.com'): Promise<TestUser> {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: 'Test User', email, password: 'correct-horse-9' })
    .expect(201);
  return { id: (res.body as { user: { id: string } }).user.id, agent };
}
