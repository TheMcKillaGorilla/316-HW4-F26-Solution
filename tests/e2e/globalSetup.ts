/**
 * globalSetup.ts
 *
 * The database the end to end tests run against: a private, throwaway
 * PostgreSQL (see server/scripts/embeddedDatabase.ts). Playwright runs this
 * once before any test, and the function it returns once they have all
 * finished.
 *
 * It runs here, inside Playwright, rather than inside the e2e server, so that
 * it is always shut down properly. Playwright stops a webServer by killing it
 * outright, which on Windows would leave PostgreSQL running, still holding
 * its port.
 */
import { startEmbeddedDatabase } from '../../server/scripts/embeddedDatabase';
import { DATABASE_PORT } from './playwright.config';

export default async function globalSetup() {
    const database = await startEmbeddedDatabase(DATABASE_PORT);
    return () => database.stop();
}
