# Project: Job Application Tracker — Backend (Group 4)

## What this is

Backend API for a dashboard that helps college students and recent grads track job
applications (an alternative interface concept for Indeed). Users save jobs, log
applications, update statuses, and see a summary dashboard.

There is NO integration with Indeed's real API. The app owns its own data; job
listings come from a seed script with realistic mock data.

## Stack

- Node.js 20+, TypeScript (strict mode), Express
- PostgreSQL via Prisma ORM (Docker Compose for local Postgres)
- Zod for request validation
- Auth: email/password, argon2 hashing, JWT in an httpOnly cookie
- Tests: Vitest + Supertest against a separate test database
- API contract: OpenAPI 3 spec at `docs/openapi.yaml`

## Folder layout

```
src/
  app.ts            # express app (no listen) — imported by tests
  server.ts         # starts the server
  config/env.ts     # zod-validated env vars
  middleware/       # auth, error handler, validation
  modules/
    auth/           # routes, controller, service, schemas
    users/
    jobs/
    applications/
    dashboard/
  lib/prisma.ts
prisma/
  schema.prisma
  seed.ts
tests/
docs/openapi.yaml
```

Each module: `*.routes.ts`, `*.controller.ts` (HTTP only), `*.service.ts` (business
logic + Prisma), `*.schemas.ts` (Zod).

## Domain rules

- Application status enum: SAVED, APPLIED, IN_PROGRESS, INTERVIEW, OFFER, REJECTED, WITHDRAWN
- "Saved Jobs" = applications with status SAVED (no separate table)
- Every status change writes a StatusHistory row (in the same transaction)
- A user can have at most one application per job (unique userId + jobId)
- `dateApplied` is set automatically the first time status leaves SAVED
- Dashboard cards: Total, In Progress, Interview, Offer
  (Total excludes SAVED. Whether APPLIED counts toward In Progress is set in
  `src/modules/dashboard/buckets.ts` so the team can change it in one place.)

## Security rules (non-negotiable)

- Every query on user-owned data is scoped by `userId` from the auth token.
  Accessing another user's resource returns 404, not 403.
- Never return `passwordHash` in any response.
- Validate all request bodies, params, and query strings with Zod.
- Rate-limit `/api/auth/*`.

## Conventions

- Error response shape: `{ "error": { "code": string, "message": string, "details"?: any } }`
- List responses: `{ "data": [...], "page": n, "pageSize": n, "total": n }`
- Dates are ISO 8601 strings in UTC.
- Keep `docs/openapi.yaml` updated in the same change as any route change.
- Run `npm run lint && npm test` before declaring a step done.

## Commands

- `npm run dev` — start with watch
- `npm test` — run tests
- `npm run db:migrate` / `npm run db:seed` / `npm run db:reset`
