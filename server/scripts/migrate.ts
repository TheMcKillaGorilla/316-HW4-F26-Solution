/**
 * migrate.ts
 *
 * npm run migrate: runs any migrations the database has not had yet. The
 * server also does this every time it starts, so this is for when you want
 * to do it without starting the server.
 */
import { DATABASE_URL } from '../src/config';
import { closeDatabase, connectDatabase } from '../src/db';
import { runMigrations } from '../src/migrate';

connectDatabase(DATABASE_URL);
try {
    const ran = await runMigrations();
    console.log(ran.length === 0 ? 'Already up to date' : `Ran ${ran.join(', ')}`);
} catch (error) {
    console.error(`Migrating failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
} finally {
    await closeDatabase();
}
