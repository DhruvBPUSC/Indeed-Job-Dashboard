import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { UpdateMeInput } from './users.schemas.js';

/** Fields safe to return to clients. Never includes passwordHash. */
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

// A valid token for an account that no longer exists: treat as signed out.
const sessionGone = (): AppError => AppError.unauthorized('Session is invalid or has expired');

export async function getUserById(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw sessionGone();
  return user;
}

export async function updateUser(userId: string, input: UpdateMeInput): Promise<PublicUser> {
  try {
    return await prisma.user.update({
      where: { id: userId },
      data: { name: input.name },
      select: publicUserSelect,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw sessionGone();
    }
    throw err;
  }
}
