/**
 * database.ts
 *
 * A real PostgreSQL for the integration tests. globalSetup.ts has already
 * started one; each test file makes a database of its own on it, runs the
 * migrations, and clearDatabase runs before each test so no test sees
 * another's data.
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { inject } from 'vitest';
import type { Express } from 'express';
import { closeDatabase, connectDatabase, query } from '../../src/db';
import { runMigrations } from '../../src/migrate';
import type { Fixture } from './fixtures';

export async function startDatabase() {
    const name = `test_${randomUUID().replaceAll('-', '')}`;

    // CREATE DATABASE has to be run from a connection to some other database
    const admin = new pg.Client({ connectionString: inject('databaseUrl') });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${name} ENCODING 'UTF8'`);
    await admin.end();

    connectDatabase(inject('databaseUrl').replace(/\/[^/]*$/, `/${name}`));
    await runMigrations();
}

export async function stopDatabase() {
    await closeDatabase();
}

/** deleting the users deletes their lists, and those their items (CASCADE) */
export async function clearDatabase() {
    await query('DELETE FROM users');
}

export const TEST_PASSWORD = 'password316';

/**
 * Makes an account through the API and returns a supertest AGENT logged in
 * as it. An agent is a little browser: it keeps the cookies it is sent, so
 * every request made with it afterwards carries the login cookie.
 */
export async function logInAs(app: Express, email: string) {
    const agent = request.agent(app);
    const response = await agent.post('/api/auth/register').send({ email, password: TEST_PASSWORD });
    if (response.status !== 201) throw new Error(`could not register ${email}: ${response.text}`);
    return { agent, userId: response.body.id as string };
}

/**
 * Puts lists straight into the database, in order, owned by one user,
 * bypassing the API.
 *
 * @param firstPosition where the first one goes on the home screen
 * @returns their new ids
 */
export async function insertLists(owner: string, lists: Fixture[], firstPosition = 0): Promise<string[]> {
    const ids: string[] = [];
    for (const [index, list] of lists.entries()) {
        const [{ id }] = await query<{ id: string }>(
            'INSERT INTO lists (owner_id, name, position) VALUES ($1, $2, $3) RETURNING id',
            [owner, list.name, firstPosition + index]);
        for (const [position, item] of list.items.entries()) {
            await query(
                `INSERT INTO items (list_id, id, position, description, date_entered, priority, target_date, completed)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [id, item.id, position, item.description, item.dateEntered, item.priority,
                    item.targetDate, item.completed]);
        }
        ids.push(id);
    }
    return ids;
}

/** @returns one row of the lists table, straight from the database */
export async function findListRow(id: string) {
    const [row] = await query<{ owner_id: string; name: string; position: number }>(
        'SELECT owner_id, name, position FROM lists WHERE id = $1', [id]);
    return row;
}

/** @returns how many rows a table has */
export async function countRows(table: 'users' | 'lists' | 'items'): Promise<number> {
    const [{ count }] = await query<{ count: string }>(`SELECT count(*) FROM ${table}`);
    return Number(count);
}

/** a well formed id that no list has */
export const MISSING_ID = '00000000-0000-4000-8000-000000000000';
