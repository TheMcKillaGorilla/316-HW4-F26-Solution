/**
 * seed.ts
 *
 * npm run seed: makes sure the tables exist, wipes them, and makes the
 * example accounts. Run it once after installing PostgreSQL and creating the
 * wolfie_lists database, and again whenever you want a clean start.
 */
import { DATABASE_URL } from '../src/config';
import { closeDatabase, connectDatabase } from '../src/db';
import { runMigrations } from '../src/migrate';
import { seedAccounts } from '../src/seedAccounts';

connectDatabase(DATABASE_URL);
try {
    await runMigrations();
    for (const { email, password, lists } of await seedAccounts()) {
        console.log(`Log in as ${email} with the password ${password} (${lists.length} ${lists.length === 1 ? 'list' : 'lists'})`);
    }
} catch (error) {
    console.error(`Seeding failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
} finally {
    await closeDatabase();
}
