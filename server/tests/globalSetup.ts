/**
 * globalSetup.ts
 *
 * Starts ONE private PostgreSQL server before any test file runs, and stops it
 * after the last. Each test file then works in a database of its own on that
 * server (see helpers/database.ts), so files can still run in parallel.
 *
 * The first run unpacks PostgreSQL from the embedded-postgres package, which
 * takes a few seconds; after that it starts in about as long again.
 */
import type { TestProject } from 'vitest/node';
import { startEmbeddedDatabase } from '../scripts/embeddedDatabase';

declare module 'vitest' {
    export interface ProvidedContext {
        /** the address of the server's default database, to make others from */
        databaseUrl: string;
    }
}

// well away from 5432, so it never collides with your own PostgreSQL
const PORT = 54200;

export default async function setup({ provide }: TestProject) {
    const database = await startEmbeddedDatabase(PORT);
    provide('databaseUrl', database.url());
    return () => database.stop();
}
