/**
 * e2e-server.ts
 *
 * The server the end to end tests run against: the real app, but on the
 * throwaway PostgreSQL that tests/e2e/globalSetup.ts starts, at E2E_DATABASE_URL,
 * so the tests never touch your wolfie_lists data. Playwright starts and stops
 * this (see tests/e2e/playwright.config.ts).
 *
 * It adds two routes the real server does not have. POST /test/reset wipes
 * every account and puts the example accounts back, and the tests call it before
 * each one so every test starts from the same data. GET /test/ready tells
 * Playwright the server is up. They live out here, in front of the app rather
 * than inside it, so they can never be reached on the real server.
 */
import express from 'express';
import { createApp } from '../src/app';
import { connectDatabase } from '../src/db';
import { runMigrations } from '../src/migrate';
import { seedAccounts } from '../src/seedAccounts';

const PORT = Number(process.env.E2E_API_PORT) || 4100;

// Playwright may start this before the database is ready, so nothing touches
// the database until the first test asks for a reset
connectDatabase(process.env.E2E_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54100/postgres');

const server = express();
server.post('/test/reset', async (_req, res) => {
    // the tables are made the first time; after that this finds nothing to do
    await runMigrations();
    await seedAccounts();
    res.status(204).end();
});
server.get('/test/ready', (_req, res) => {
    res.status(204).end();
});
server.use(createApp({ logRequests: false }));

server.listen(PORT, () => console.log(`e2e API listening on http://localhost:${PORT}`));
