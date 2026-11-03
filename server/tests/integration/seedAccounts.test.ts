/**
 * seedAccounts.test.ts
 *
 * npm run seed. The expectations are read from the data file itself, so the
 * example accounts and lists are free to change.
 */
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { query } from '../../src/db';
import { seedAccounts, type StarterAccount } from '../../src/seedAccounts';
import {
    clearDatabase, countRows, insertLists, logInAs, startDatabase, stopDatabase
} from '../helpers/database';
import { CHORES_LIST } from '../helpers/fixtures';

const STARTER: StarterAccount[] = JSON.parse(readFileSync(
    new URL('../../data/starter_accounts.json', import.meta.url), 'utf8')).accounts;

const ALL_LISTS = STARTER.flatMap((account) => account.lists);

const app = createApp({ logRequests: false });

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(clearDatabase);

describe('seedAccounts', () => {
    it('needs at least two accounts, so the example data shows lists belonging to different users', () => {
        expect(STARTER.length).toBeGreaterThanOrEqual(2);
    });

    it('makes every account, each able to log in with its password', async () => {
        await seedAccounts();

        for (const { email, password } of STARTER) {
            const response = await request(app).post('/api/auth/login').send({ email, password });
            expect(response.status, email).toBe(200);
        }
    });

    it('gives each account its own lists, in the order the file has them', async () => {
        await seedAccounts();

        for (const account of STARTER) {
            const lists = await query<{ name: string }>(
                `SELECT lists.name FROM lists JOIN users ON users.id = lists.owner_id
                  WHERE users.email = $1 ORDER BY lists.position`, [account.email]);
            expect(lists.map((list) => list.name)).toEqual(account.lists.map((list) => list.name));
        }
    });

    it('loads every item, so the file is valid data', async () => {
        await seedAccounts();

        expect(await countRows('items')).toBe(ALL_LISTS.reduce((total, list) => total + list.items.length, 0));
    });

    it('gives every item an id of its own', async () => {
        await seedAccounts();

        const [{ count }] = await query<{ count: string }>('SELECT count(DISTINCT id) FROM items');
        expect(Number(count)).toBe(await countRows('items'));
    });

    it('replaces every account and list that was there before', async () => {
        const { userId } = await logInAs(app, 'someone@stonybrook.edu');
        await insertLists(userId, [CHORES_LIST]);

        await seedAccounts();

        expect(await countRows('users')).toBe(STARTER.length);
        expect(await countRows('lists')).toBe(ALL_LISTS.length);
        expect(await query("SELECT 1 FROM lists WHERE name = 'Chores'")).toEqual([]);
    });
});
