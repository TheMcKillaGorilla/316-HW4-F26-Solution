/**
 * vitest.config.ts
 *
 * The client's tests. The folders say how much is involved:
 *
 *   tests/unit          one module or one component on its own
 *   tests/integration   containers, contexts and hooks together, driven the way
 *                       a user drives them, against a fake server
 *   ../tests/e2e        the whole application in a real browser (Playwright),
 *                       against the real server and a real database
 *
 * Every client test runs in jsdom, a document without a browser, since nearly
 * all of them draw something. The router is the real React Router, keeping
 * its URL in memory instead of an address bar (see helpers/harness.tsx).
 *
 * Run through npm (npm test), which passes --config. A bare npx vitest would
 * not find this file.
 */
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// the client folder, one level up from this file
const ROOT = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
    root: ROOT,

    resolve: {
        // the same @/ as tsconfig.json, so a test imports exactly what the app does
        alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) }
    },

    // JSX with the automatic runtime (no import React needed), as in the app.
    // No React plugin: Vite's own compiler does this, and the plugin's extra,
    // Fast Refresh, is for the dev server, not for tests.
    oxc: {
        jsx: { runtime: 'automatic' }
    },

    test: {
        environment: 'jsdom',

        // the DOM matchers, and cleanup after every test
        setupFiles: ['./tests/setup.ts'],

        include: [
            'tests/unit/**/*.test.{ts,tsx}',
            'tests/integration/**/*.test.{ts,tsx}'
        ],

        // pinned, so the evening time zone test means the same thing anywhere
        env: {
            TZ: 'America/New_York'
        },

        // between tests: forget every call a mock recorded and any implementation
        // a test gave it, undo every vi.spyOn, and take the fake server away again
        mockReset: true,
        restoreMocks: true,
        unstubGlobals: true,

        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            reportsDirectory: 'tests/output/coverage',
            include: ['src/**/*.{ts,tsx}'],
            // the entry point, which only puts <App /> into index.html
            exclude: ['src/main.tsx']
        }
    }
});
