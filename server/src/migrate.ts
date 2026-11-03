/**
 * migrate.ts
 *
 * Brings the database's tables up to date by running every file in
 * migrations/ that has not been run on it yet, in file name order. The table
 * schema_migrations remembers which have, so running this again does nothing.
 *
 * This is how a schema changes over a project's life: never by editing the
 * tables by hand, always by adding a numbered file that everybody's database,
 * and the tests' throwaway ones, will run the same way.
 */
import { readdir, readFile } from 'node:fs/promises';
import { query, withTransaction } from './db';

const MIGRATIONS = new URL('../migrations/', import.meta.url);

/** @returns the names of the files that were run just now */
export async function runMigrations(): Promise<string[]> {
    await query(`CREATE TABLE IF NOT EXISTS schema_migrations (
                     name   text        PRIMARY KEY,
                     run_at timestamptz NOT NULL DEFAULT now()
                 )`);
    const done = new Set((await query<{ name: string }>('SELECT name FROM schema_migrations'))
        .map((row) => row.name));

    const files = (await readdir(MIGRATIONS)).filter((name) => name.endsWith('.sql')).sort();
    const ran: string[] = [];
    for (const name of files.filter((file) => !done.has(file))) {
        const sql = await readFile(new URL(name, MIGRATIONS), 'utf8');
        // a migration and the note that it ran succeed or fail together
        await withTransaction(async (client) => {
            await client.query(sql);
            await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        });
        ran.push(name);
    }
    return ran;
}
