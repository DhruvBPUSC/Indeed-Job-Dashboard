# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Backend API (Group 4 course project) for a dashboard that helps college students and recent
grads track job applications — an alternative interface concept for Indeed. Users save jobs, log
applications, update statuses, schedule interviews, and see a summary dashboard.

There is NO integration with Indeed's real API. The app owns its own data; job listings come from
`prisma/seed.ts` (mock data). README.md, CONTRIBUTING.md, and DEPLOY.md cover setup, env vars,
and deployment (Render, `render.yaml`) in detail.

## Stack

Node.js 20+, TypeScript strict, ESM (`"type": "module"` — relative imports use `.js` suffixes),
Express 5, PostgreSQL 16 via Prisma 7 (with the `@prisma/adapter-pg` driver adapter), Zod 4,
argon2 + JWT (jose) in an httpOnly `token` cookie, pino logging, Vitest + Supertest.

The Prisma client is generated into `src/generated/` (gitignored, created by `npm install` /
`npm run db:generate`). Import enums/types from `src/generated/prisma/{client,enums}.js`, not
`@prisma/client`.

## Commands

```bash
docker compose up -d            # dev DB on :5432, test DB (tmpfs, wiped on restart) on :5433
npm run dev                     # tsx watch on :3000; Swagger UI at /api/docs (development only)
npm run lint                    # ESLint + tsc --noEmit
npm test                        # full suite (global setup runs `prisma migrate deploy` on test DB)
npx vitest run tests/jobs.test.ts            # one file
npx vitest run tests/jobs.test.ts -t "name"  # one test by name
npm run test:coverage           # fails if any src/modules/**/*.service.ts < 80% (per file)
npm run format                  # Prettier
npm run db:migrate              # after editing prisma/schema.prisma; commit the new migration
npm run db:seed                 # idempotent; demo login demo@example.com / DemoPass123!
npm run db:reset                # drop + migrate + seed dev DB
npm run demo:reset -- --yes     # restore demo account only (dry run without --yes)
```

Run `npm run lint && npm test` before declaring a step done.

`NODE_ENV=test` makes both `src/config/env.ts` and `prisma.config.ts` load `.env.test` (test DB on 5433) instead of `.env`. Vitest sets it automatically. Note `npm run db:test:migrate` uses POSIX
`NODE_ENV=test` syntax, which doesn't work from cmd/PowerShell on Windows.

## Architecture

- `src/app.ts` exports `createApp(options)` (no `listen`) plus a default `app`. Tests build their
  own app via options (rate limit, CORS origins, logger, body limit, trust proxy). `apiRouters`
  lists every router + mount path; the contract and security tests walk it, so a new router must
  be added there.
- Middleware order: helmet → CORS → request logger → origin guard (CSRF: rejects non-GET requests
  from foreign `Origin`s) → JSON body → cookies → routes → `notFoundHandler` → `errorHandler`.
- Each module (`src/modules/<name>/`): `*.routes.ts` wires `requireAuth` then `validate(...)` then
  a controller; `*.controller.ts` is HTTP only (reads parsed `req.*`, gets user via
  `currentUserId(req)`, calls service); `*.service.ts` holds business logic + Prisma;
  `*.schemas.ts` holds Zod schemas and inferred types. Interviews live in the applications module
  (`interviews.service.ts`), nested under `/api/applications/:id/interviews`.
- `validate()` (`src/middleware/validate.ts`) fails closed: any of body/params/query without a
  schema must be empty, and it replaces `req.*` with parsed values. Use strict Zod objects so
  unknown fields are rejected.
- Errors: throw `AppError` (`src/lib/errors.ts`); `AppError.notFound()` is also the answer for
  another user's resource. ZodErrors become 400 `VALIDATION_ERROR` in the error handler.
- `src/lib/prisma.ts` sets `omit: { user: { passwordHash: true } }` globally; only login selects it
  explicitly.
- Pagination rules and the list response type live in `src/lib/pagination.ts`; LIKE-wildcard
  escaping for search in `src/lib/search.ts`.

### Tests that enforce the rules (they will fail if you skip a step)

- `tests/security.test.ts` introspects the router stacks: every route must include
  `validateRequest` and (unless in `PUBLIC_ROUTES`) `requireAuth` before it. It also statically
  scans source for Prisma calls on `application`/`interview`/`statusHistory`/`user` and requires
  each call's text to contain `userId` (`auth.service.ts` is exempt).
- `tests/openapi.contract.test.ts` checks `docs/openapi.yaml` against real routes, Zod inputs, and
  live responses in both directions — including documented 401/400/413 responses.
- Test files share one DB and run serially (`fileParallelism: false`); `tests/helpers/db.ts`
  `resetDb()` truncates between tests. Use `tests/helpers/factories.ts` to create users/jobs.

## Frontend (`frontend/`)

React 19 + TypeScript (strict) + Vite + Tailwind v4, built from the team's dashboard mockup. It
has its own `package.json`, linter (oxlint) and `.gitignore`; the root ESLint ignores it.

```bash
cd frontend && npm run dev    # :5173 (strictPort); proxies /api -> localhost:3000
npm run build                 # tsc -b + vite build
npm run lint                  # oxlint
```

- Styling is Tailwind utility classes only. `src/index.css` holds just the Tailwind import and the
  font token; don't add custom CSS. Icons are lucide-react SVGs, never emoji.
- The browser always calls same-origin `/api/*` (`src/lib/api.ts`): Vite's proxy in dev and the
  `vercel.json` rewrite in production keep the auth cookie first-party. Don't call the API's
  absolute URL from the browser.
- Server state goes through TanStack Query; `src/auth/auth.ts` owns the `['me']` query, and any
  401 from a query sets it to null, which makes `RequireAuth` redirect to `/login`.
- `src/lib/types.ts` mirrors `docs/openapi.yaml` by hand; update it when a response shape changes.
- Product name lives in `src/config/brand.ts` (a concept redesign, not Indeed branding).

## Domain rules

- Application status enum: SAVED, APPLIED, IN_PROGRESS, INTERVIEW, OFFER, REJECTED, WITHDRAWN
- "Saved Jobs" = applications with status SAVED (no separate table)
- Every status change writes a StatusHistory row in the same transaction (creation writes one with
  `fromStatus = null`)
- A user can have at most one application per job (unique userId + jobId)
- `dateApplied` is set automatically the first time status leaves SAVED
- Dashboard cards: Total, In Progress, Interview, Offer. Total excludes SAVED. Status→card mapping
  (including whether APPLIED counts as In Progress) lives only in
  `src/modules/dashboard/buckets.ts`.

## Security rules (non-negotiable)

- Every query on user-owned data is scoped by `userId` from the auth token. Accessing another
  user's resource returns 404, not 403.
- Never return `passwordHash` in any response.
- Validate all request bodies, params, and query strings with Zod.
- Rate-limit `/api/auth/*`.

## Conventions

- Error response shape: `{ "error": { "code": string, "message": string, "details"?: any } }`
- List responses: `{ "data": [...], "page": n, "pageSize": n, "total": n }` (pageSize default 20,
  max 50)
- Dates are ISO 8601 strings in UTC.
- Keep `docs/openapi.yaml` updated in the same change as any route change.
- Schema changes need a committed migration; env var changes need `.env.example`, README, and
  DEPLOY.md updates.
- Branches `<type>/<desc>` (feat/fix/docs/test/chore); Conventional Commit messages, e.g.
  `feat(applications): add CSV export`.
