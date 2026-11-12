import { decodeJwt, jwtVerify, SignJWT } from 'jose';

import { env } from '../config/env.js';

const key = new TextEncoder().encode(env.JWT_SECRET);
const ALG = 'HS256';

export async function signAuthToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = await new SignJWT()
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(key);

  const { exp } = decodeJwt(token);
  if (exp === undefined) throw new Error('Signed token has no exp claim');
  return { token, expiresAt: new Date(exp * 1000) };
}

/** Returns the user id from a valid token, or null if the token is invalid, tampered, or expired. */
export async function verifyAuthToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: [ALG] });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
