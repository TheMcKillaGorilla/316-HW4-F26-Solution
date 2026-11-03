/**
 * seedAccounts.ts
 *
 * Wipes every account and list, then makes the accounts in
 * data/starter_accounts.json, each owning its own example lists. Used by
 * `npm run seed` and by the end to end tests. Accounts made through the
 * application start with no lists.
 *
 * The file carries no ids. PostgreSQL gives each user and list one, and each
 * item gets a fresh one here.
 */
import { readFile } from 'node:fs/promises';
import type { ItemDTO } from '@wolfie-lists/shared';
import { withTransaction } from './db';
import { newItemId } from './rules';
import { hashPassword } from './auth/passwords';

const STARTER_FILE = new URL('../data/starter_accounts.json', import.meta.url);

export interface StarterAccount {
    email: string;
    password: string;
    lists: { name: string; items: Omit<ItemDTO, 'id'>[] }[];
}

/** @returns the accounts it made, as the file has them */
export async function seedAccounts(): Promise<StarterAccount[]> {
    const { accounts } = JSON.parse(await readFile(STARTER_FILE, 'utf8')) as { accounts: StarterAccount[] };
    const passwordHashes = await Promise.all(accounts.map((account) => hashPassword(account.password)));

    await withTransaction(async (client) => {
        // deleting the users deletes their lists, and those their items (CASCADE)
        await client.query('DELETE FROM users');

        for (const [index, account] of accounts.entries()) {
            const { rows: [user] } = await client.query<{ id: string }>(
                'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
                [account.email, passwordHashes[index]]);

            for (const [position, list] of account.lists.entries()) {
                const { rows: [created] } = await client.query<{ id: string }>(
                    'INSERT INTO lists (owner_id, name, position) VALUES ($1, $2, $3) RETURNING id',
                    [user.id, list.name, position]);

                for (const [itemPosition, item] of list.items.entries()) {
                    await client.query(
                        `INSERT INTO items (list_id, id, position, description, date_entered, priority, target_date, completed)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [created.id, newItemId(), itemPosition, item.description, item.dateEntered,
                            item.priority, item.targetDate, item.completed]);
                }
            }
        }
    });
    return accounts;
}
