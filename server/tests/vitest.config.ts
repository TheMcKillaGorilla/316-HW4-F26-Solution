/**
 * vitest.config.ts
 *
 * The server's tests, in two tiers like the client's:
 *
 *   tests/unit          one module on its own, no database
 *   tests/integration   real HTTP requests (supertest) against the real app and
 *                       a real PostgreSQL
 *
 * globalSetup.ts starts one private PostgreSQL server for the whole run, and
 * each test file gets a throwaway database on it, so the tests never touch
 * your wolfie_lists data.
 */
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    root: fileURLToPath(new URL('..', import.meta.url)),
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        globalSetup: ['tests/globalSetup.ts'],
        restoreMocks: true,
        env: {
            // the cheapest bcrypt allows. Real hashing is slow on purpose, which
            // is exactly what a test suite that makes dozens of accounts can't afford
            BCRYPT_ROUNDS: '4'
        }
    }
});
