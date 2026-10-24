import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup-login-shell.ts'],
    // W8: git and process spawns are several times slower on Windows runners; the 5 s default timed out there.
    ...(process.platform === 'win32' ? { testTimeout: 30000, hookTimeout: 30000 } : {}),
  },
});
