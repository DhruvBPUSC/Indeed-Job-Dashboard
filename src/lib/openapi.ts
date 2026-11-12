import { readFileSync } from 'node:fs';

import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';

// Same relative path from src/lib/ (tsx) and dist/lib/ (built).
const SPEC_URL = new URL('../../docs/openapi.yaml', import.meta.url);

export function loadOpenApiSpec(): Record<string, unknown> {
  return parse(readFileSync(SPEC_URL, 'utf8')) as Record<string, unknown>;
}

/** Swagger UI at /api/docs and the raw spec at /api/docs/openapi.json. Development only. */
export function createDocsRouter(): Router {
  const spec = loadOpenApiSpec();
  const router = Router();

  router.get('/openapi.json', (_req, res) => {
    res.json(spec);
  });
  router.use(
    '/',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'Job Tracker API',
      swaggerOptions: {
        // Same origin, so the auth cookie set by "Try it out" on /api/auth/login is sent along.
        withCredentials: true,
        persistAuthorization: true,
      },
    }),
  );
  return router;
}
