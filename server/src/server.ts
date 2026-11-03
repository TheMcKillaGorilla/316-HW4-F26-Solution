/**
 * server.ts
 *
 * The entry point: connect to PostgreSQL, bring its tables up to date, then
 * start listening for requests. Settings come from server/.env (see config.ts).
 */
import { createApp } from './app';
import { DATABASE_URL, PORT } from './config';
import { connectDatabase, query } from './db';
import { runMigrations } from './migrate';

connectDatabase(DATABASE_URL);

try {
    // a query that cannot fail, to find out now whether the database is there
    await query('SELECT 1');
    for (const name of await runMigrations()) console.log(`Ran migration ${name}`);
    console.log('Connected to PostgreSQL');
} catch (error) {
    console.error('Could not connect to PostgreSQL. Is it running, and is DATABASE_URL in server/.env right?');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}

createApp().listen(PORT, () => {
    console.log(`Wolfie Lists API listening on http://localhost:${PORT}`);
});
