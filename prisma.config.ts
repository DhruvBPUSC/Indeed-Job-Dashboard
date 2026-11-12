import { config as loadDotenv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Same rule as src/config/env.ts: NODE_ENV=test targets the test database.
loadDotenv({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env', quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
