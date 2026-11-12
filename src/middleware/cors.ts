import cors, { type CorsOptions } from 'cors';
import type { RequestHandler } from 'express';

import { env } from '../config/env.js';

/**
 * Lets the frontend (FRONTEND_URL) call the API with the auth cookie. Other origins get no
 * CORS headers, so browsers block them. Requests without an Origin (curl, server-to-server,
 * same-origin) are unaffected.
 */
export function createCors(origins: readonly string[] = env.FRONTEND_URL): RequestHandler {
  const allowed = new Set(origins);
  const options: CorsOptions = {
    origin: true, // reflect the request's origin; only reached for allowed origins
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type'],
    exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy'],
    maxAge: 600, // cache preflights for 10 minutes
  };
  // Decide per request so other origins get no CORS headers at all. (With a static config,
  // the cors package sends Access-Control-Allow-Credentials to every origin.)
  return cors((req, callback) => {
    const origin = req.headers.origin;
    callback(null, origin !== undefined && allowed.has(origin) ? options : { origin: false });
  });
}
