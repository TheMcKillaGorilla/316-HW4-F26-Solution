/**
 * database.test.ts
 *
 * The schema itself, straight through SQL with no HTTP in the way: that the
 * migrations run once, that the database refuses bad data even when nothing
 * else does, that deleting cascades, and that a failed transaction leaves
 * nothing behind.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { query, withTransaction } from '../../src/db';
import { runMigrations } from '../../src/migrate';
import { clearDatabase, countRows, insertLists, startDatabase, stopDatabase } from '../helpers/database';
import { WEEKEND_LIST } from '../helpers/fixtures';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(clearDatabase);

async function makeUser(email = 'wolfie@stonybrook.edu'): Promise<string> {
    const [{ id }] = await query<{ id: string }>(
        "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id", [email]);
    return id;
}

describe('the migrations', () => {
    it('do nothing the second time, since each runs only once', async () => {
        expect(await runMigrations()).toEqual([]);
    });
});

describe('the database refuses', () => {
    it('an email in capitals, so one address can never be two accounts', async () => {
        await expect(makeUser('Wolfie@StonyBrook.edu')).rejects.toThrow(/check constraint/);
    });

    it('the same email twice', async () => {
        await makeUser();
        await expect(makeUser()).rejects.toThrow(/unique/);
    });

    it('a list with no owner', async () => {
        await expect(query("INSERT INTO lists (name, position) VALUES ('x', 0)")).rejects.toThrow(/owner_id/);
    });

    it('a list whose owner does not exist', async () => {
        await expect(query(
            "INSERT INTO lists (owner_id, name, position) VALUES ('00000000-0000-4000-8000-000000000000', 'x', 0)"))
            .rejects.toThrow(/foreign key/);
    });

    it('an unknown priority', async () => {
        const [list] = await insertLists(await makeUser(), [{ name: 'x', items: [] }]);
        await expect(query(
            "INSERT INTO items (list_id, id, position, description, date_entered, priority) VALUES ($1, 'a', 0, 'x', '2026-01-01', 'Urgent')",
            [list])).rejects.toThrow(/check constraint/);
    });

    it('a date that does not exist', async () => {
        const [list] = await insertLists(await makeUser(), [{ name: 'x', items: [] }]);
        await expect(query(
            "INSERT INTO items (list_id, id, position, description, date_entered) VALUES ($1, 'a', 0, 'x', '2026-02-30')",
            [list])).rejects.toThrow(/out of range/);
    });
});

describe('dates', () => {
    it('come back as the same YYYY-MM-DD strings that went in, never as Date objects', async () => {
        const [list] = await insertLists(await makeUser(), [WEEKEND_LIST]);

        const rows = await query<{ date_entered: unknown }>(
            'SELECT date_entered FROM items WHERE list_id = $1 ORDER BY position', [list]);

        expect(rows.map((row) => row.date_entered)).toEqual(WEEKEND_LIST.items.map((item) => item.dateEntered));
    });
});

describe('deleting', () => {
    it('a list deletes its items too (ON DELETE CASCADE)', async () => {
        const [list] = await insertLists(await makeUser(), [WEEKEND_LIST]);

        await query('DELETE FROM lists WHERE id = $1', [list]);

        expect(await countRows('items')).toBe(0);
    });

    it('a user deletes their lists, and those their items', async () => {
        await insertLists(await makeUser(), [WEEKEND_LIST]);

        await query('DELETE FROM users');

        expect(await countRows('lists')).toBe(0);
        expect(await countRows('items')).toBe(0);
    });
});

describe('withTransaction', () => {
    it('undoes everything it did when any part of it fails', async () => {
        const owner = await makeUser();

        await expect(withTransaction(async (client) => {
            await client.query("INSERT INTO lists (owner_id, name, position) VALUES ($1, 'Half Made', 0)", [owner]);
            await client.query('SELECT this_is_not_sql');
        })).rejects.toThrow();

        expect(await countRows('lists')).toBe(0);
    });

    it('keeps everything when it all succeeds', async () => {
        const owner = await makeUser();

        await withTransaction(async (client) => {
            await client.query("INSERT INTO lists (owner_id, name, position) VALUES ($1, 'One', 0)", [owner]);
            await client.query("INSERT INTO lists (owner_id, name, position) VALUES ($1, 'Two', 1)", [owner]);
        });

        expect(await countRows('lists')).toBe(2);
    });
});
