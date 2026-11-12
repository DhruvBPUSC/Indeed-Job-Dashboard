# Deploying to Render

`render.yaml` is a [Render Blueprint](https://render.com/docs/blueprint-spec). It creates:

- **job-tracker-api**: a Node web service. Build: `npm ci --include=dev && npm run build`.
  Start: `npm run start:prod`, which runs `prisma migrate deploy` and then starts the server, so
  every deploy applies new migrations before taking traffic.
- **job-tracker-db**: a managed PostgreSQL 16 database, wired to the API's `DATABASE_URL`.

Both are on the free plan in the `virginia` region (they must share a region).

---

## 1. Put the code on GitHub

Render deploys from a Git repository. This folder isn't one yet:

```bash
cd ~/Desktop/HCI\ Project
git init
git add .
git status            # check .env is NOT listed (it's in .gitignore)
git commit -m "Job tracker backend"
```

Create an empty repository on GitHub (no README), then push:

```bash
git remote add origin https://github.com/<you>/<repo>.git
git branch -M main
git push -u origin main
```

`.env.test` is committed on purpose: it only holds local test-database settings. `.env` must
never be committed.

## 2. Create the Blueprint

1. Render Dashboard → **New** → **Blueprint** → connect GitHub → pick the repository.
2. Render reads `render.yaml` and lists the web service and database.
3. It asks for the one value it can't know:
   - **`FRONTEND_URL`**: the deployed frontend's origin, e.g.
     `https://job-tracker-web.onrender.com`. Use the scheme and host only, with no path. Separate
     several with commas. If the frontend isn't deployed yet, enter `http://localhost:5173` and
     change it later (step 5).
4. Click **Apply**. The database comes up first, then the API builds and starts. The first
   deploy takes a few minutes.

Everything else is set by the Blueprint. `JWT_SECRET` is generated once by Render, and changing
it later signs everyone out.

## 3. Check it's up

Your API URL is on the service page, e.g. `https://job-tracker-api.onrender.com`.

```bash
API=https://job-tracker-api.onrender.com
curl $API/api/health                       # {"status":"ok"}
```

In the service's **Logs** you should see the migration being applied, then `API listening`.

## 4. Load the demo data

The database starts empty: no jobs and no demo account. Free web services have no shell, so
seed it from your laptop:

1. Render Dashboard → **job-tracker-db** → **Connect** → copy the **External Database URL**.
2. From this project folder:

   ```bash
   DATABASE_URL='<External Database URL>' SEED_DEMO_PASSWORD='<pick a password>' \
     npm run demo:reset -- --yes
   ```

   Expected: `Done: demo@example.com has 16 applications; 40 jobs in total.`

The demo login is now `demo@example.com` with the password you picked. Without `--yes`, the
script only prints which database it would touch and exits, which is a safe way to check the
URL first.

## 5. Connect the frontend

**API calls must send cookies.** Use `fetch(url, { credentials: 'include' })`, or
`axios.create({ baseURL, withCredentials: true })`. Without this, login works but every later
request gets 401.

**`FRONTEND_URL` must match the browser's origin exactly**, e.g. `https://job-tracker-web.onrender.com`
(not `http://`, no trailing path). To change it: service → **Environment** → edit → **Save**,
which redeploys.

**Choose `COOKIE_SAMESITE` by where the frontend lives:**

| Frontend                    | API                            | `COOKIE_SAMESITE`                                  |
| --------------------------- | ------------------------------ | -------------------------------------------------- |
| `something.onrender.com`    | `job-tracker-api.onrender.com` | `none` (the Blueprint default)                     |
| `app.yourdomain.com`        | `api.yourdomain.com`           | `lax` (stricter, recommended if you have a domain) |
| Local dev, `localhost:5173` | `localhost:3000`               | `lax` (the default in `.env`)                      |

Two `*.onrender.com` subdomains count as **different sites**, because `onrender.com` is on the
Public Suffix List. That's why the Blueprint uses `none`. Cross-site requests are still
protected: writes from any origin not in `FRONTEND_URL` get `403 FORBIDDEN_ORIGIN`.

## 6. Verify end to end

```bash
API=https://job-tracker-api.onrender.com
WEB=https://job-tracker-web.onrender.com   # your FRONTEND_URL

# Login from the frontend's origin sets a Secure cookie with the expected SameSite
curl -si -c /tmp/cj -X POST $API/api/auth/login -H "Origin: $WEB" \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"<your SEED_DEMO_PASSWORD>"}' \
  | grep -iE '^HTTP|set-cookie|access-control-allow-origin'

# The cookie works, and the dashboard shows 12 / 5 / 4 / 3
curl -s -b /tmp/cj $API/api/dashboard/summary

# Writes from other sites are refused
curl -s -X POST $API/api/auth/logout -H 'Origin: https://evil.example.com'   # 403
```

Then check the **Logs**: request lines should show your real public IP in `ip`. If every request
shows the same private address (`10.x.x.x`), raise `TRUST_PROXY` by one; otherwise all users
share a single login rate limit.

---

## Before every presentation

```bash
DATABASE_URL='<External Database URL>' SEED_DEMO_PASSWORD='<same password>' \
  npm run demo:reset -- --yes
```

This restores the demo account to the scripted dashboard (12 tracked: 5 In Progress, 4
Interview, 3 Offer), with dates moved to today so the 2 interviews are upcoming again. It only
touches `demo@example.com` and the seeded jobs. Accounts that classmates created are left
alone.

**Wake the service 2–3 minutes before you present.** Free web services spin down when idle and
the first request after that can take close to a minute:

```bash
curl https://job-tracker-api.onrender.com/api/health
```

---

## Environment variables

Set by `render.yaml` unless marked _(you set)_.

| Variable                    | Value on Render    | Required         | Notes                                                                   |
| --------------------------- | ------------------ | ---------------- | ----------------------------------------------------------------------- |
| `NODE_ENV`                  | `production`       | yes              | Turns on Secure cookies and JSON logs, and turns off `/api/docs`.       |
| `NODE_VERSION`              | `24`               |                  | Node version Render installs. The app needs Node 20 or newer.           |
| `DATABASE_URL`              | from the database  | yes              | Render's internal connection string.                                    |
| `JWT_SECRET`                | generated          | yes              | 32+ characters. Rotating it signs everyone out.                         |
| `JWT_EXPIRES_IN`            | `7d`               |                  | Session length, e.g. `12h` or `7d`.                                     |
| `FRONTEND_URL`              | _(you set)_        | yes              | Frontend origin(s), comma-separated. Used by CORS and the origin check. |
| `COOKIE_SAMESITE`           | `none`             |                  | `lax`, `strict` or `none`; see step 5. `none` only works in production. |
| `TRUST_PROXY`               | `1`                |                  | Proxies in front of the app; see step 6.                                |
| `LOG_LEVEL`                 | `info`             |                  | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`.         |
| `BODY_LIMIT`                | `100kb` (default)  |                  | Max JSON body size; bigger requests get 413.                            |
| `AUTH_RATE_LIMIT_MAX`       | `20` (default)     |                  | Requests per IP per window on `/api/auth/*`.                            |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` (default) |                  | Rate-limit window: 15 minutes.                                          |
| `SHUTDOWN_TIMEOUT_MS`       | `10000` (default)  |                  | How long a deploy waits for in-flight requests.                         |
| `PORT`                      | set by Render      |                  | Don't set it yourself.                                                  |
| `SEED_DEMO_PASSWORD`        | _(laptop only)_    | for `demo:reset` | Not needed on Render; pass it when running the reset.                   |

## Deploying changes

Pushing to `main` redeploys automatically. Schema changes ship like this:

```bash
npm run db:migrate          # locally: creates prisma/migrations/<timestamp>_<name>/
git add prisma/migrations prisma/schema.prisma && git commit -m "..." && git push
```

The next deploy applies the new migration in `start:prod` before the server starts. If the
migration fails, the deploy fails and the previous version keeps serving.

## Troubleshooting

| Symptom                                                                 | Cause / fix                                                                                                                                                            |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login returns 200, then everything is 401                               | The cookie isn't being sent. Check `credentials: 'include'` in the frontend, and that `COOKIE_SAMESITE=none` if the frontend is on another `*.onrender.com` subdomain. |
| Browser console shows a CORS error                                      | `FRONTEND_URL` doesn't exactly match the page's origin (scheme, host, port).                                                                                           |
| `403 FORBIDDEN_ORIGIN`                                                  | Same as above: the write came from an origin not in `FRONTEND_URL`.                                                                                                    |
| Build fails with `tsc: not found`                                       | The build command lost `--include=dev`.                                                                                                                                |
| `Can't reach database server` / `P1001`                                 | The API and database are in different regions, or `DATABASE_URL` was overridden by hand.                                                                               |
| Everyone hits `429` on login at once                                    | `TRUST_PROXY` is too low (see step 6).                                                                                                                                 |
| Server won't start: `COOKIE_SAMESITE=none requires NODE_ENV=production` | Working as intended: `none` needs Secure cookies, which need production.                                                                                               |
| Database stopped working after some weeks                               | Free Render Postgres instances are time-limited. Check the database page for its expiry, and upgrade or recreate it, then rerun step 4.                                |

---

## Railway instead

The same app runs on Railway; it just doesn't use `render.yaml`.

1. **New Project** → **Deploy from GitHub repo**, then **+ New** → **Database** → **PostgreSQL**.
2. On the API service → **Settings**:
   - Build command: `npm ci --include=dev && npm run build`
   - Start command: `npm run start:prod`
   - Healthcheck path: `/api/health`
   - **Networking** → **Generate Domain**
3. **Variables**: set `DATABASE_URL` to `${{Postgres.DATABASE_URL}}` (a reference to the database
   service), plus everything in the table above: `NODE_ENV=production`, a `JWT_SECRET` of 32+
   random characters, `FRONTEND_URL`, `COOKIE_SAMESITE`, `TRUST_PROXY=1`, `NODE_VERSION=24`.
   Generate a secret with:
   `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
4. Seed with `demo:reset` as in step 4, using the database's public connection URL from its
   **Connect** tab.

Two `*.up.railway.app` subdomains are also separate sites, so use `COOKIE_SAMESITE=none` unless
both run on your own domain.
