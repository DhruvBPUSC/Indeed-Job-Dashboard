import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { app, createApp } from '../src/app.js';
import { env } from '../src/config/env.js';

const FRONTEND = 'http://localhost:5173';

describe('CORS', () => {
  it('reads the allowed origin from FRONTEND_URL', () => {
    expect(env.FRONTEND_URL).toEqual([FRONTEND]);
  });

  it('allows the frontend origin with credentials', async () => {
    const res = await request(app).get('/api/health').set('Origin', FRONTEND);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers.vary).toMatch(/Origin/);
  });

  it('answers preflight requests for credentialed JSON writes', async () => {
    const res = await request(app)
      .options('/api/applications')
      .set('Origin', FRONTEND)
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'content-type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-methods']).toBe('GET,POST,PATCH,DELETE');
    expect(res.headers['access-control-allow-headers']).toBe('Content-Type');
  });

  it('adds CORS headers to error responses too, so the frontend can read them', async () => {
    const res = await request(app).get('/api/me').set('Origin', FRONTEND);

    expect(res.status).toBe(401);
    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND);
  });

  it('exposes the request id header to the frontend', async () => {
    const res = await request(app).get('/api/health').set('Origin', FRONTEND);

    expect(res.headers['access-control-expose-headers']).toMatch(/X-Request-Id/);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each(['https://evil.example.com', 'http://localhost:5174', 'http://localhost:5173.evil.com'])(
    'gives no CORS headers to %s',
    async (origin) => {
      const res = await request(app).get('/api/health').set('Origin', origin);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    },
  );

  it('never answers with a wildcard origin (not allowed with credentials)', async () => {
    const res = await request(app).get('/api/health').set('Origin', FRONTEND);

    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('still serves requests without an Origin (curl, same-origin)', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('supports several origins', async () => {
    const multi = createApp({ corsOrigins: [FRONTEND, 'https://tracker.example.edu'] });

    for (const origin of [FRONTEND, 'https://tracker.example.edu']) {
      const res = await request(multi).get('/api/health').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
    }
  });
});
