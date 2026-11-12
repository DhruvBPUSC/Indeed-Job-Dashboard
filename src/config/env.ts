import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Tests read .env.test so they never touch the dev database.
loadDotenv({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env', quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+(s|m|h|d|w)$/, 'JWT_EXPIRES_IN must look like 30m, 12h, or 7d')
    .default('7d'),
  /**
   * Frontend origin(s) allowed to call the API with credentials (CORS). Comma-separated for
   * more than one. Normalized to bare origins, so a trailing slash or path is harmless.
   */
  FRONTEND_URL: z
    .string()
    .default('http://localhost:5173')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url({ protocol: /^https?$/ })).min(1, 'FRONTEND_URL needs at least one URL'))
    .transform((urls) => urls.map((u) => new URL(u).origin)),
  /**
   * SameSite for the auth cookie. `lax` works when the frontend and API are the same site
   * (e.g. app.example.com + api.example.com, or localhost:5173 + localhost:3000). Use `none`
   * when they're on different sites, e.g. two *.onrender.com subdomains (onrender.com is a
   * public suffix, so its subdomains are separate sites). `none` requires production (Secure).
   */
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  /** Max JSON request body, e.g. 100kb or 1mb. Larger bodies get 413 PAYLOAD_TOO_LARGE. */
  BODY_LIMIT: z
    .string()
    .regex(/^\d+(b|kb|mb)$/, 'BODY_LIMIT must look like 100kb or 1mb')
    .default('100kb'),
  /**
   * Number of reverse proxies in front of the app (0 = none). Needed behind a proxy or load
   * balancer so req.ip is the client, not the proxy; otherwise every user shares one rate limit.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  /** How long shutdown waits for in-flight requests before forcing connections closed. */
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
});

export type Env = Omit<z.infer<typeof envSchema>, 'LOG_LEVEL'> & {
  LOG_LEVEL: NonNullable<z.infer<typeof envSchema>['LOG_LEVEL']>;
};

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // The logger depends on env, so this one message goes to the console directly.
    console.error('Invalid environment variables:\n' + z.prettifyError(result.error));
    process.exit(1);
  }
  const data = result.data;
  if (data.COOKIE_SAMESITE === 'none' && data.NODE_ENV !== 'production') {
    // Browsers reject SameSite=None cookies that aren't Secure, and Secure needs https.
    console.error(
      'Invalid environment variables:\nCOOKIE_SAMESITE=none requires NODE_ENV=production',
    );
    process.exit(1);
  }
  // Quiet by default in tests; info everywhere else.
  return { ...data, LOG_LEVEL: data.LOG_LEVEL ?? (data.NODE_ENV === 'test' ? 'silent' : 'info') };
}

export const env = parseEnv();
