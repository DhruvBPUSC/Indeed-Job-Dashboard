# Job Application Tracker — Frontend

React + TypeScript + Vite + Tailwind CSS frontend for the job application tracker (Group 4 HCI
course project — a concept redesign of a job-board dashboard, not affiliated with Indeed).

## Run locally

Start the backend first (see the root [README](../README.md)); it serves the API on port 3000.

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173, proxies /api to http://localhost:3000
```

Demo login: `demo@example.com` / `DemoPass123!` (from the backend seed).

## Scripts

| Script            | What it does                        |
| ----------------- | ----------------------------------- |
| `npm run dev`     | Dev server with hot reload on :5173 |
| `npm run build`   | Type-check and build to `dist/`     |
| `npm run lint`    | Lint with oxlint                    |
| `npm run preview` | Serve the production build locally  |

## Deploying to Vercel

Set the project's root directory to `frontend/`. In `vercel.json`, replace
`REPLACE-WITH-YOUR-API.onrender.com` with the deployed API's host. Vercel then forwards `/api/*`
to the API, so the auth cookie stays first-party, and serves `index.html` for every other path.
Set the API's `FRONTEND_URL` to the Vercel URL.
