/**
 * Keeps docs/openapi.yaml honest. Checks, in both directions:
 *   1. routes:    every Express route is documented, and every documented operation exists
 *   2. inputs:    query params and request bodies match the Zod schemas the server validates with
 *   3. responses: real responses from every operation have a documented status and match the
 *                 documented schema, with undocumented fields treated as errors
 */
import { randomUUID } from 'node:crypto';

import { Ajv, type ValidateFunction } from 'ajv';
import addFormatsModule from 'ajv-formats';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z, type ZodType } from 'zod';

import { DEMO_EMAIL, seed } from '../prisma/seed.js';
import { apiRouters, app, createApp } from '../src/app.js';
import { AUTH_COOKIE } from '../src/lib/auth-cookie.js';
import { loadOpenApiSpec } from '../src/lib/openapi.js';
import * as applicationSchemas from '../src/modules/applications/applications.schemas.js';
import * as authSchemas from '../src/modules/auth/auth.schemas.js';
import * as jobSchemas from '../src/modules/jobs/jobs.schemas.js';
import * as userSchemas from '../src/modules/users/users.schemas.js';
import { prisma, resetDb } from './helpers/db.js';

// ajv-formats is CommonJS; its default export arrives wrapped under ESM.
const addFormats = addFormatsModule as unknown as (ajv: Ajv) => Ajv;

type Obj = Record<string, unknown>;
const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

const spec = loadOpenApiSpec();
const paths = spec.paths as Record<string, Obj>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Follows a local "#/..." $ref (repeatedly) and returns the target. */
function deref(value: unknown): Obj {
  let current = value;
  while (isObj(current) && typeof current.$ref === 'string') {
    current = current.$ref
      .replace(/^#\//, '')
      .split('/')
      .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
      .reduce<unknown>((node, key) => (isObj(node) ? node[key] : undefined), spec);
  }
  if (!isObj(current)) throw new Error(`Could not resolve ${JSON.stringify(value)}`);
  return current;
}

function operation(method: string, path: string): Obj {
  const op = paths[path]?.[method];
  if (!isObj(op)) throw new Error(`Spec has no ${method.toUpperCase()} ${path}`);
  return op;
}

/** Path-level and operation-level parameters, resolved. */
function parameters(method: string, path: string): Obj[] {
  const pathLevel = (paths[path]?.parameters ?? []) as unknown[];
  const opLevel = (operation(method, path).parameters ?? []) as unknown[];
  return [...pathLevel, ...opLevel].map(deref);
}

const sorted = (xs: Iterable<string>): string[] => [...xs].sort();

// ---------------------------------------------------------------------------
// 1. Routes
// ---------------------------------------------------------------------------

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

function expressRoutes(): string[] {
  const routes: string[] = [];
  const collect = (prefix: string, stack: RouteLayer[]): void => {
    for (const layer of stack) {
      if (!layer.route) continue;
      const path = (prefix + (layer.route.path === '/' ? '' : layer.route.path)).replace(
        /:(\w+)/g,
        '{$1}',
      );
      for (const m of Object.keys(layer.route.methods)) routes.push(`${m.toUpperCase()} ${path}`);
    }
  };
  collect('', (app as unknown as { router: { stack: RouteLayer[] } }).router.stack);
  for (const [prefix, router] of apiRouters) {
    collect(prefix, (router as unknown as { stack: RouteLayer[] }).stack);
  }
  return sorted(routes);
}

function specOperations(): string[] {
  return sorted(
    Object.entries(paths).flatMap(([path, item]) =>
      METHODS.filter((m) => m in item).map((m) => `${m.toUpperCase()} ${path}`),
    ),
  );
}

describe('routes', () => {
  it('documents exactly the routes the app serves', () => {
    expect(specOperations()).toEqual(expressRoutes());
  });

  it('declares every path parameter', () => {
    for (const op of specOperations()) {
      const [method = '', path = ''] = op.split(' ');
      const inTemplate = sorted([...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? ''));
      const declared = sorted(
        parameters(method.toLowerCase(), path)
          .filter((p) => p.in === 'path')
          .map((p) => String(p.name)),
      );
      expect(declared, op).toEqual(inTemplate);
    }
  });

  it('documents the real auth cookie name', () => {
    const scheme = (spec.components as { securitySchemes: Record<string, Obj> }).securitySchemes
      .cookieAuth;
    expect(scheme).toEqual({ type: 'apiKey', in: 'cookie', name: AUTH_COOKIE });
  });

  it('marks public operations public and everything else as cookie-authenticated', () => {
    const publicOps = [
      'GET /api/health',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/auth/logout',
    ];
    for (const op of specOperations()) {
      const [method = '', path = ''] = op.split(' ');
      const security = operation(method.toLowerCase(), path).security;
      expect(security, op).toEqual(publicOps.includes(op) ? [] : [{ cookieAuth: [] }]);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Inputs vs. Zod
// ---------------------------------------------------------------------------

/** The rules for one field, normalized so the spec and Zod's JSON Schema can be compared. */
interface FieldRules {
  type?: unknown;
  nullable?: true;
  enum?: string[];
  format?: unknown;
  minLength?: unknown;
  maxLength?: unknown;
  minimum?: unknown;
  maximum?: unknown;
  default?: unknown;
  items?: FieldRules;
}

interface Shape {
  required: string[];
  /** true if unknown fields are rejected (additionalProperties: false). */
  closed: boolean;
  fields: Record<string, FieldRules>;
}

// Spec-only hints with no validation meaning.
const IGNORED_FORMATS = new Set(['password']);

function fieldRules(raw: unknown): FieldRules {
  let prop = deref(raw);
  // `allOf: [$ref]` is how the spec attaches a default to a referenced enum.
  if (Array.isArray(prop.allOf) && prop.allOf.length === 1)
    prop = { ...deref(prop.allOf[0]), ...prop };
  let nullable = prop.nullable === true;
  // Zod writes nullable as anyOf [X, {type: null}].
  if (Array.isArray(prop.anyOf)) {
    const branches = prop.anyOf.map(deref);
    nullable ||= branches.some((b) => b.type === 'null');
    prop = { ...prop, ...(branches.find((b) => b.type !== 'null') ?? {}) };
  }
  const enumValues = Array.isArray(prop.enum) ? prop.enum : undefined;
  if (enumValues?.includes(null)) nullable = true;

  const rules: FieldRules = {
    type: prop.type,
    ...(nullable && { nullable: true as const }),
    ...(enumValues && { enum: sorted(enumValues.filter((v) => v !== null).map(String)) }),
    ...(typeof prop.format === 'string' &&
      !IGNORED_FORMATS.has(prop.format) && { format: prop.format }),
    minLength: prop.minLength,
    maxLength: prop.maxLength,
    minimum: prop.minimum,
    // Zod's int() emits MAX_SAFE_INTEGER as the maximum; that means "no limit".
    maximum: prop.maximum === Number.MAX_SAFE_INTEGER ? undefined : prop.maximum,
    default: prop.default,
    ...(prop.items !== undefined && { items: fieldRules(prop.items) }),
  };
  return Object.fromEntries(Object.entries(rules).filter(([, v]) => v !== undefined));
}

function shapeOf(schema: Obj): Shape {
  const props = (schema.properties ?? {}) as Record<string, unknown>;
  return {
    required: sorted((schema.required ?? []) as string[]),
    closed: schema.additionalProperties === false,
    fields: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, fieldRules(v)])),
  };
}

/**
 * Zod's JSON Schema for what a client may send. Input and output views are merged because a
 * pipe (e.g. trim -> email) shows its checks only on the output side, and a transform
 * (e.g. blank notes -> null) only on the input side.
 */
function zodShape(schema: ZodType): Shape {
  const input = shapeOf(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }));
  const output = shapeOf(z.toJSONSchema(schema, { io: 'output', unrepresentable: 'any' }));
  const fields: Record<string, FieldRules> = {};
  for (const [name, inRules] of Object.entries(input.fields)) {
    const outRules = output.fields[name] ?? {};
    // An unrepresentable output (a transform) is {} with no type; keep the input view then.
    const merged =
      outRules.type === undefined ? inRules : { ...outRules, ...inRules, ...pickChecks(outRules) };
    // Defaults and nullability are about what the client sends.
    delete merged.default;
    if (inRules.default !== undefined) merged.default = inRules.default;
    if (inRules.nullable) merged.nullable = true;
    else delete merged.nullable;
    fields[name] = merged;
  }
  return { required: input.required, closed: input.closed, fields };
}

function pickChecks(rules: FieldRules): FieldRules {
  const { format, minLength, maxLength, minimum, maximum } = rules;
  return Object.fromEntries(
    Object.entries({ format, minLength, maxLength, minimum, maximum }).filter(
      ([, v]) => v !== undefined,
    ),
  );
}

const bodies: [string, string, ZodType][] = [
  ['post', '/api/auth/register', authSchemas.registerSchema],
  ['post', '/api/auth/login', authSchemas.loginSchema],
  ['patch', '/api/me', userSchemas.updateMeSchema],
  ['post', '/api/applications', applicationSchemas.createApplicationSchema],
  ['patch', '/api/applications/{id}', applicationSchemas.updateApplicationSchema],
  ['post', '/api/applications/{id}/interviews', applicationSchemas.createInterviewSchema],
  [
    'patch',
    '/api/applications/{id}/interviews/{interviewId}',
    applicationSchemas.updateInterviewSchema,
  ],
];

const queries: [string, string, ZodType][] = [
  ['get', '/api/jobs', jobSchemas.listJobsQuerySchema],
  ['get', '/api/applications', applicationSchemas.listApplicationsQuerySchema],
  ['get', '/api/applications/stats/by-status', applicationSchemas.statsByStatusQuerySchema],
];

describe('inputs match the Zod schemas', () => {
  it.each(bodies)('%s %s request body', (method, path, zodSchema) => {
    const body = deref(operation(method, path).requestBody);
    const json = deref((body.content as Obj)['application/json']);
    const schema = deref(json.schema);

    expect(shapeOf(schema)).toEqual(zodShape(zodSchema));
  });

  it.each(queries)('%s %s query parameters', (method, path, zodSchema) => {
    const params = parameters(method, path).filter((p) => p.in === 'query');
    const asSchema: Obj = {
      properties: Object.fromEntries(params.map((p) => [p.name, p.schema])),
      required: params.filter((p) => p.required === true).map((p) => p.name),
      // Unknown query params are ignored, matching z.object (not strictObject).
      additionalProperties: (z.toJSONSchema(zodSchema, { io: 'input' }) as Obj)
        .additionalProperties,
    };

    expect(shapeOf(asSchema)).toEqual(zodShape(zodSchema));
  });

  it('every operation with a body or query is checked above', () => {
    const checked = new Set([...bodies, ...queries].map(([m, p]) => `${m.toUpperCase()} ${p}`));
    for (const op of specOperations()) {
      const [method = '', path = ''] = op.split(' ');
      const o = operation(method.toLowerCase(), path);
      const hasInput =
        o.requestBody !== undefined ||
        parameters(method.toLowerCase(), path).some((p) => p.in === 'query');
      if (hasInput) expect(checked.has(op), op).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Responses
// ---------------------------------------------------------------------------

/** Deep copy of the spec where response objects reject undocumented fields. */
function strictResponses(node: unknown, inResponse = false): unknown {
  if (Array.isArray(node)) return node.map((n) => strictResponses(n, inResponse));
  if (!isObj(node)) return node;
  const out: Obj = {};
  for (const [k, v] of Object.entries(node)) out[k] = strictResponses(v, inResponse);
  if (
    inResponse &&
    node.type === 'object' &&
    isObj(node.properties) &&
    !('additionalProperties' in node)
  ) {
    out.additionalProperties = false;
  }
  return out;
}

const responseSchemaNames = new Set<string>();
const ajv = new Ajv({ strict: false, allErrors: true, validateSchema: false });
addFormats(ajv);
{
  // Only schemas reachable from a response get strict treatment; request schemas keep theirs.
  const copy = structuredClone(spec);
  const components = copy.components as Obj;
  const schemas = components.schemas as Obj;
  const responseOnly = [
    'Error',
    'User',
    'UserResponse',
    'Job',
    'JobFields',
    'JobListResponse',
    'ApplicationListItem',
    'ApplicationDetail',
    'StatusHistoryEntry',
    'Interview',
    'ApplicationListResponse',
    'ApplicationDetailResponse',
    'InterviewResponse',
    'DashboardSummary',
    'ApplicationStatusCounts',
  ];
  for (const name of responseOnly) {
    responseSchemaNames.add(name);
    schemas[name] = strictResponses(schemas[name], true);
  }
  copy.paths = strictResponses(copy.paths, false);
  // Inline response schemas (e.g. health, GET /api/jobs/{id}).
  for (const item of Object.values(copy.paths as Record<string, Obj>)) {
    for (const m of METHODS) {
      const op = item[m];
      if (isObj(op) && isObj(op.responses)) op.responses = strictResponses(op.responses, true);
    }
  }
  ajv.addSchema(copy, 'spec');
}

const validators = new Map<string, ValidateFunction | null>();

/** The JSON Schema validator for a documented response, or null if it has no JSON body. */
function responseValidator(method: string, path: string, status: number): ValidateFunction | null {
  const key = `${method} ${path} ${status}`;
  if (validators.has(key)) return validators.get(key) ?? null;

  const responses = operation(method, path).responses as Obj;
  const raw = responses[String(status)];
  if (raw === undefined)
    throw new Error(`${method.toUpperCase()} ${path} returned undocumented ${status}`);

  const escape = (s: string): string => s.replace(/~/g, '~0').replace(/\//g, '~1');
  const pointer =
    isObj(raw) && typeof raw.$ref === 'string'
      ? raw.$ref.slice(1)
      : `/paths/${escape(path)}/${method}/responses/${status}`;
  const content = deref(raw).content;
  const validator =
    isObj(content) && content['application/json']
      ? ajv.compile({ $ref: `spec#${pointer}/content/application~1json/schema` })
      : null;
  validators.set(key, validator);
  return validator;
}

const exercised = new Set<string>();
/** "METHOD /path status" for every response seen. */
const seenStatuses = new Set<string>();

/** Asserts a real response matches what the spec documents for that operation and status. */
function expectDocumented(res: request.Response, method: string, path: string): void {
  const op = `${method.toUpperCase()} ${path}`;
  const validator = responseValidator(method, path, res.status);
  if (validator) {
    expect(res.headers['content-type'], `${op} ${res.status}`).toMatch(/application\/json/);
    const ok = validator(res.body);
    expect(ok ? [] : validator.errors, `${op} ${res.status} body`).toEqual([]);
  } else {
    expect(res.text, `${op} ${res.status} should have no body`).toBe('');
  }
  if (res.status < 300) exercised.add(op);
  seenStatuses.add(`${op} ${res.status}`);
}

describe('responses match the documented schemas', () => {
  let demo: ReturnType<typeof request.agent>;
  let jobId: string;
  let applicationId: string;
  let interviewId: string;

  beforeAll(async () => {
    await resetDb();
    await seed();
    demo = request.agent(app);
    await demo
      .post('/api/auth/login')
      .send({ email: DEMO_EMAIL, password: process.env.SEED_DEMO_PASSWORD })
      .expect(200);
    // A seeded job the demo user hasn't tracked yet.
    const untracked = await prisma.job.findFirstOrThrow({
      where: { applications: { none: {} } },
      orderBy: { id: 'asc' },
    });
    jobId = untracked.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('system and auth', async () => {
    expectDocumented(await request(app).get('/api/health'), 'get', '/api/health');

    const fresh = request.agent(app);
    const user = {
      name: 'Contract Test',
      email: 'contract@example.com',
      password: 'correct-horse-9',
    };
    expectDocumented(
      await fresh.post('/api/auth/register').send(user),
      'post',
      '/api/auth/register',
    );
    expectDocumented(
      await fresh.post('/api/auth/register').send(user),
      'post',
      '/api/auth/register',
    );
    expectDocumented(await fresh.post('/api/auth/register').send({}), 'post', '/api/auth/register');
    expectDocumented(
      await fresh.post('/api/auth/login').send({ email: user.email, password: user.password }),
      'post',
      '/api/auth/login',
    );
    expectDocumented(
      await fresh.post('/api/auth/login').send({ email: user.email, password: 'wrong-password' }),
      'post',
      '/api/auth/login',
    );
    expectDocumented(
      await fresh.post('/api/auth/login').send({ email: 'x' }),
      'post',
      '/api/auth/login',
    );
    expectDocumented(await fresh.post('/api/auth/logout'), 'post', '/api/auth/logout');

    for (const path of ['/api/auth/register', '/api/auth/login', '/api/auth/logout']) {
      const limited = createApp({ authRateLimit: 1 });
      await request(limited).post(path).send({});
      const res = await request(limited).post(path).send({});
      expect(res.status, path).toBe(429);
      expectDocumented(res, 'post', path);
    }
  });

  it('users', async () => {
    expectDocumented(await demo.get('/api/me'), 'get', '/api/me');
    expectDocumented(await request(app).get('/api/me'), 'get', '/api/me');
    expectDocumented(
      await demo.patch('/api/me').send({ name: 'Cayden Willey' }),
      'patch',
      '/api/me',
    );
    expectDocumented(await demo.patch('/api/me').send({ email: 'x@y.z' }), 'patch', '/api/me');
  });

  it('jobs', async () => {
    const list = '/api/jobs';
    expectDocumented(await demo.get(list), 'get', list);
    expectDocumented(
      await demo.get(list).query({ q: 'intern', jobType: 'INTERNSHIP', pageSize: 3 }),
      'get',
      list,
    );
    expectDocumented(await demo.get(list).query({ pageSize: 99 }), 'get', list);
    expectDocumented(await request(app).get(list), 'get', list);

    const one = '/api/jobs/{id}';
    expectDocumented(await demo.get(`/api/jobs/${jobId}`), 'get', one);
    const tracked = await prisma.application.findFirstOrThrow({
      where: { user: { email: DEMO_EMAIL } },
    });
    expectDocumented(await demo.get(`/api/jobs/${tracked.jobId}`), 'get', one);
    expectDocumented(await demo.get(`/api/jobs/${randomUUID()}`), 'get', one);
    expectDocumented(await demo.get('/api/jobs/nope'), 'get', one);
  });

  it('applications', async () => {
    const list = '/api/applications';
    expectDocumented(await demo.get(list), 'get', list);
    expectDocumented(
      await demo.get(`${list}?status=INTERVIEW&status=OFFER&sort=dateApplied&order=asc`),
      'get',
      list,
    );
    expectDocumented(await demo.get(list).query({ sort: 'title' }), 'get', list);

    const created = await demo.post(list).send({ jobId, notes: 'From the contract test' });
    expectDocumented(created, 'post', list);
    applicationId = (created.body as { application: { id: string } }).application.id;
    expectDocumented(await demo.post(list).send({ jobId }), 'post', list); // 409
    expectDocumented(await demo.post(list).send({ jobId: randomUUID() }), 'post', list); // 404
    expectDocumented(await demo.post(list).send({ jobId: 'nope' }), 'post', list); // 400

    const stats = '/api/applications/stats/by-status';
    expectDocumented(await demo.get(stats), 'get', stats);
    expectDocumented(await demo.get(stats).query({ q: 'intern' }), 'get', stats);
    expectDocumented(await demo.get(stats).query({ q: 'x'.repeat(101) }), 'get', stats);

    const one = '/api/applications/{id}';
    expectDocumented(await demo.get(`${list}/${applicationId}`), 'get', one);
    expectDocumented(await demo.get(`${list}/${randomUUID()}`), 'get', one);
    expectDocumented(
      await demo.patch(`${list}/${applicationId}`).send({ status: 'APPLIED' }),
      'patch',
      one,
    );
    expectDocumented(
      await demo.patch(`${list}/${applicationId}`).send({ notes: null }),
      'patch',
      one,
    );
    expectDocumented(await demo.patch(`${list}/${applicationId}`).send({}), 'patch', one);
    expectDocumented(
      await demo.patch(`${list}/${randomUUID()}`).send({ notes: 'x' }),
      'patch',
      one,
    );

    const interviews = '/api/applications/{id}/interviews';
    const interview = await demo
      .post(`${list}/${applicationId}/interviews`)
      .send({ scheduledAt: '2030-11-02T10:00:00-04:00', type: 'VIRTUAL', notes: 'Zoom' });
    expectDocumented(interview, 'post', interviews);
    interviewId = (interview.body as { interview: { id: string } }).interview.id;
    expectDocumented(
      await demo.post(`${list}/${applicationId}/interviews`).send({ type: 'PHONE' }),
      'post',
      interviews,
    );
    expectDocumented(
      await demo
        .post(`${list}/${randomUUID()}/interviews`)
        .send({ scheduledAt: '2030-11-02T10:00:00Z', type: 'PHONE' }),
      'post',
      interviews,
    );
    expectDocumented(await demo.get(`${list}/${applicationId}`), 'get', one); // detail with an interview

    const oneInterview = '/api/applications/{id}/interviews/{interviewId}';
    const url = `${list}/${applicationId}/interviews/${interviewId}`;
    expectDocumented(await demo.patch(url).send({ type: 'ONSITE' }), 'patch', oneInterview);
    expectDocumented(await demo.patch(url).send({}), 'patch', oneInterview);
    expectDocumented(
      await demo.patch(`${list}/${applicationId}/interviews/${randomUUID()}`).send({ notes: 'x' }),
      'patch',
      oneInterview,
    ); // 404
    expectDocumented(
      await demo.delete(`${list}/${applicationId}/interviews/nope`),
      'delete',
      oneInterview,
    );
    expectDocumented(await demo.delete(url), 'delete', oneInterview);
    expectDocumented(await demo.delete(url), 'delete', oneInterview); // 404

    expectDocumented(await demo.get(`${list}/nope`), 'get', one); // 400
    expectDocumented(await demo.delete(`${list}/nope`), 'delete', one); // 400
    expectDocumented(await demo.delete(`${list}/${applicationId}`), 'delete', one);
    expectDocumented(await demo.delete(`${list}/${applicationId}`), 'delete', one); // 404
  });

  it('dashboard', async () => {
    expectDocumented(await demo.get('/api/dashboard/summary'), 'get', '/api/dashboard/summary');
    expectDocumented(
      await request(app).get('/api/dashboard/summary'),
      'get',
      '/api/dashboard/summary',
    );
  });

  /** Fills path params with random UUIDs. */
  const concrete = (path: string): string => path.replace(/\{\w+\}/g, () => randomUUID());

  it('every protected operation documents the 401 it returns without a cookie', async () => {
    for (const op of specOperations()) {
      const [method = '', path = ''] = op.split(' ');
      const m = method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete';
      if ((operation(m, path).security as unknown[]).length === 0) continue;

      const res = await request(app)[m](concrete(path)).send({});
      expect(res.status, op).toBe(401);
      expectDocumented(res, m, path);
    }
  });

  it('every operation that accepts a body documents the 400 for malformed JSON', async () => {
    for (const op of specOperations()) {
      const [method = '', path = ''] = op.split(' ');
      const m = method.toLowerCase();
      if (m !== 'post' && m !== 'patch') continue;

      const res = await demo[m](concrete(path))
        .set('Content-Type', 'application/json')
        .send('{bad');
      expect(res.status, op).toBe(400);
      expect(res.body, op).toMatchObject({ error: { code: 'BAD_REQUEST' } });
      expectDocumented(res, m, path);
    }
  });

  it('every operation that accepts a body documents the 413 for an oversized body', async () => {
    const tiny = request.agent(createApp({ bodyLimit: '1kb' }));
    for (const op of specOperations()) {
      const [method = '', path = ''] = op.split(' ');
      const m = method.toLowerCase();
      if (m !== 'post' && m !== 'patch') continue;

      const res = await tiny[m](concrete(path)).send({ padding: 'x'.repeat(2048) });
      expect(res.status, op).toBe(413);
      expectDocumented(res, m, path);
    }
  });

  it('every state-changing operation documents the 403 for a foreign origin', async () => {
    for (const op of specOperations()) {
      const [method = '', path = ''] = op.split(' ');
      const m = method.toLowerCase();
      if (m !== 'post' && m !== 'patch' && m !== 'delete') continue;

      const res = await demo[m](concrete(path)).set('Origin', 'https://evil.example.com').send({});
      expect(res.status, op).toBe(403);
      expectDocumented(res, m, path);
    }
  });

  it('every operation documents the 400 for an unknown query parameter', async () => {
    for (const op of specOperations()) {
      const [method = '', path = ''] = op.split(' ');
      const m = method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete';

      const res = await demo[m](`${concrete(path)}?unexpected=1`);
      expect(res.status, op).toBe(400);
      expect(res.body, op).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expectDocumented(res, m, path);
    }
  });

  it('exercised every documented operation successfully', () => {
    expect(sorted(exercised)).toEqual(specOperations());
  });

  it('produced every documented status (nothing documented is unreachable)', () => {
    const documented = specOperations().flatMap((op) => {
      const [method = '', path = ''] = op.split(' ');
      return Object.keys(operation(method.toLowerCase(), path).responses as Obj).map(
        (status) => `${op} ${status}`,
      );
    });
    expect(documented.filter((d) => !seenStatuses.has(d))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Swagger UI
// ---------------------------------------------------------------------------

describe('Swagger UI', () => {
  it('is not served outside development', async () => {
    expect((await request(app).get('/api/docs/')).status).toBe(404);
    expect((await request(createApp({ docs: false })).get('/api/docs/openapi.json')).status).toBe(
      404,
    );
  });

  it('serves the UI and the spec when enabled', async () => {
    const withDocs = createApp({ docs: true });

    const ui = await request(withDocs).get('/api/docs/');
    expect(ui.status).toBe(200);
    expect(ui.text).toContain('swagger-ui');

    const json = await request(withDocs).get('/api/docs/openapi.json');
    expect(json.status).toBe(200);
    expect(json.body).toEqual(spec);
  });
});

// Keep the list of strict response schemas in sync with the spec.
describe('test setup', () => {
  it('treats every response-only schema strictly', () => {
    for (const name of responseSchemaNames) {
      expect(Object.keys(spec.components as Obj).length).toBeGreaterThan(0);
      expect((spec.components as { schemas: Obj }).schemas[name], name).toBeDefined();
    }
  });
});
