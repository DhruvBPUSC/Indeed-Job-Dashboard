# Contributing

Thanks for helping out. Setup is in the [README](README.md#getting-started).

## Branches

Branch from `main` and name the branch `<type>/<short-description>`:

| Type     | For                           | Example                    |
| -------- | ----------------------------- | -------------------------- |
| `feat/`  | New features                  | `feat/application-export`  |
| `fix/`   | Bug fixes                     | `fix/dashboard-null-date`  |
| `docs/`  | Documentation only            | `docs/deploy-railway`      |
| `test/`  | Tests only                    | `test/interview-isolation` |
| `chore/` | Tooling, dependencies, config | `chore/bump-prisma`        |

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), e.g.
`feat(applications): add CSV export`.

## Before you push

```bash
npm run lint            # ESLint + TypeScript type check
npm test                # full test suite (needs the test database; see the README)
npm run test:coverage   # optional locally; fails if any service drops below 80% coverage
```

If you changed `prisma/schema.prisma`, create a migration with `npm run db:migrate` and commit
the new folder in `prisma/migrations/`.

## Pull request checklist

- [ ] `npm run lint` and `npm test` pass.
- [ ] New or changed behavior has tests.
- [ ] Any route change is reflected in `docs/openapi.yaml` (the contract test fails if not).
- [ ] Request bodies, params, and query strings are validated with Zod via `validate()`.
- [ ] Queries on user-owned data are scoped by `userId`; another user's resource returns 404.
- [ ] No `passwordHash`, secrets, or `.env` files in code, responses, logs, or the diff.
- [ ] Schema changes include a migration.
- [ ] README, `.env.example`, and `DEPLOY.md` are updated if setup or env vars changed.
