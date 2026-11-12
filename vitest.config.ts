import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: { NODE_ENV: 'test' },
    globalSetup: ['tests/global-setup.ts'],
    // Test files share one database and reset it between tests, so they must not run in parallel.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**', 'src/types/**', 'src/server.ts'],
      reporter: ['text', 'html'],
      thresholds: {
        // Business logic: every service must stay at 80%+ on all four measures. perFile makes
        // each file meet it on its own; without it the files are averaged together.
        'src/modules/**/*.service.ts': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
          perFile: true,
        },
      },
    },
  },
});
