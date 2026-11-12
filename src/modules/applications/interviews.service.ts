import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { CreateInterviewInput, UpdateInterviewInput } from './applications.schemas.js';
import { interviewSelect } from './applications.service.js';

export type InterviewDto = Prisma.InterviewGetPayload<{ select: typeof interviewSelect }>;

const notFound = (): AppError => AppError.notFound('Interview not found');

/** Matches an interview only if it's under this application and the application is the user's. */
function ownedInterview(
  userId: string,
  applicationId: string,
  interviewId: string,
): Prisma.InterviewWhereInput {
  return { id: interviewId, applicationId, application: { userId } };
}

export async function createInterview(
  userId: string,
  applicationId: string,
  input: CreateInterviewInput,
): Promise<InterviewDto> {
  try {
    // One atomic, user-scoped write: the connect only matches the user's own application.
    return await prisma.interview.create({
      data: {
        application: { connect: { id: applicationId, userId } },
        scheduledAt: input.scheduledAt,
        type: input.type,
        notes: input.notes ?? null,
      },
      select: interviewSelect,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw AppError.notFound('Application not found');
    }
    throw err;
  }
}

export async function updateInterview(
  userId: string,
  applicationId: string,
  interviewId: string,
  input: UpdateInterviewInput,
): Promise<InterviewDto> {
  const data: Prisma.InterviewUpdateManyMutationInput = {};
  if (input.scheduledAt !== undefined) data.scheduledAt = input.scheduledAt;
  if (input.type !== undefined) data.type = input.type;
  if (input.notes !== undefined) data.notes = input.notes;

  const { count } = await prisma.interview.updateMany({
    where: ownedInterview(userId, applicationId, interviewId),
    data,
  });
  if (count === 0) throw notFound();

  const interview = await prisma.interview.findFirst({
    where: ownedInterview(userId, applicationId, interviewId),
    select: interviewSelect,
  });
  if (!interview) throw notFound(); // deleted in between
  return interview;
}

export async function deleteInterview(
  userId: string,
  applicationId: string,
  interviewId: string,
): Promise<void> {
  const { count } = await prisma.interview.deleteMany({
    where: ownedInterview(userId, applicationId, interviewId),
  });
  if (count === 0) throw notFound();
}
