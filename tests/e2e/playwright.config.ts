/**
 * playwright.config.ts
 *
 * The whole application in a real Chrome: Vite serving the client, the Express
 * API behind it, and a real PostgreSQL (a private, throwaway one) behind
 * that. These are the only tests where every tier runs together.
 *
 * Playwright starts both servers before the tests and stops them afterwards,
 * on ports 9100 and 4100 so they never collide with the ones you are working
 * with on 9000 and 4000.
 *
 * ONE TEST AT A TIME
 * ------------------
 * Every test shares one database, and each begins by resetting it to the
 * example accounts. Run two at once and one would reset the other's data halfway
 * through, so workers is 1.
 *
 * channel: 'chrome' drives the Chrome already installed on this machine, so
 * there is no browser to download. Run through npm (npm run test:e2e), which
 * passes --config.
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const CLIENT_PORT = 9100;
const API_PORT = 4100;   // support/app.ts uses the same port
/** the throwaway PostgreSQL that globalSetup.ts starts */
export const DATABASE_PORT = 54100;

const HERE = import.meta.dirname;
const ROOT = path.join(HERE, '..', '..');
const OUTPUT = path.join(HERE, 'output');

export default defineConfig({
    testDir: '.',
    outputDir: path.join(OUTPUT, 'test-results'),

    workers: 1,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: [
        ['list'],
        ['html', { open: 'never', outputFolder: path.join(OUTPUT, 'playwright-report') }]
    ],

    use: {
        baseURL: `http://localhost:${CLIENT_PORT}`,
        // a click on something that is not there fails after five seconds
        actionTimeout: 5_000,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure'
    },

    projects: [
        {
            name: 'chrome',
            use: { ...devices['Desktop Chrome'], channel: 'chrome' }
        }
    ],

    // the database, started before the first test and stopped after the last
    globalSetup: './globalSetup.ts',

    webServer: [
        {
            command: 'npx tsx scripts/e2e-server.ts',
            cwd: path.join(ROOT, 'server'),
            env: {
                E2E_API_PORT: String(API_PORT),
                E2E_DATABASE_URL: `postgres://postgres:postgres@localhost:${DATABASE_PORT}/postgres`
            },
            url: `http://localhost:${API_PORT}/test/ready`,
            reuseExistingServer: !process.env.CI,
            stdout: 'ignore',
            stderr: 'pipe',
            timeout: 300_000
        },
        {
            command: `npx vite --port ${CLIENT_PORT} --strictPort`,
            cwd: path.join(ROOT, 'client'),
            env: { API_URL: `http://localhost:${API_PORT}` },
            url: `http://localhost:${CLIENT_PORT}/`,
            reuseExistingServer: !process.env.CI,
            stdout: 'ignore',
            stderr: 'pipe',
            timeout: 60_000
        }
    ]
});
