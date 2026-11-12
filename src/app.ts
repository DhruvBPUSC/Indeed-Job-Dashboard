import cookieParser from 'cookie-parser';
import express, { type Express, type Router } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';

import { env } from './config/env.js';
import { createHttpLogger } from './lib/logger.js';
import { createDocsRouter } from './lib/openapi.js';
import { createCors } from './middleware/cors.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createOriginGuard } from './middleware/origin-guard.js';
import { createAuthRateLimit } from './middleware/rate-limit.js';
import { validate } from './middleware/validate.js';
import { applicationsRouter } from './modules/applications/applications.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { jobsRouter } from './modules/jobs/jobs.routes.js';
import { usersRouter } from './modules/users/users.routes.js';

/**
 * Every API router and where it's mounted. Exported so the contract test can compare the real
 * routes against docs/openapi.yaml (Express 5 doesn't keep mount paths on the router stack).
 */
export const apiRouters: readonly (readonly [path: string, router: Router])[] = [
  ['/api/auth', authRouter],
  ['/api/me', usersRouter],
  ['/api/jobs', jobsRouter],
  ['/api/applications', applicationsRouter],
  ['/api/dashboard', dashboardRouter],
];

export interface AppOptions {
  /** Override the /api/auth/* per-IP request limit (used by tests). */
  authRateLimit?: number;
  /** Serve Swagger UI at /api/docs. Defaults to on in development only. */
  docs?: boolean;
  /** Origins allowed by CORS. Defaults to FRONTEND_URL. */
  corsOrigins?: readonly string[];
  /** Logger for request logs (tests pass one that writes to memory). */
  logger?: Logger;
  /** Max JSON body size. Defaults to BODY_LIMIT. */
  bodyLimit?: string;
  /** Reverse proxies to trust for req.ip. Defaults to TRUST_PROXY. */
  trustProxy?: number;
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();

  app.disable('x-powered-by');
  const trustProxy = options.trustProxy ?? env.TRUST_PROXY;
  if (trustProxy > 0) app.set('trust proxy', trustProxy);

  // First, so every response (errors and preflights included) gets security and CORS headers.
  app.use(
    helmet({
      contentSecurityPolicy: {
        // The dev server is plain http; upgrading subresources to https would break /api/docs.
        directives: { upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null },
      },
    }),
  );
  app.use(createCors(options.corsOrigins));
  app.use(createHttpLogger(options.logger));
  app.use(createOriginGuard(options.corsOrigins));
  app.use(express.json({ limit: options.bodyLimit ?? env.BODY_LIMIT }));
  app.use(cookieParser());

  app.get('/api/health', validate(), (_req, res) => {
    res.json({ status: 'ok' });
  });

  if (options.docs ?? env.NODE_ENV === 'development') {
    app.use('/api/docs', createDocsRouter());
  }

  app.use('/api/auth', createAuthRateLimit(options.authRateLimit));
  for (const [path, router] of apiRouters) app.use(path, router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
