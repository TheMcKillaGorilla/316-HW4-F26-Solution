/**
 * listController.ts
 *
 * The C in MVC. Each function handles one kind of request: it reads what it
 * needs from req, asks PostgreSQL for data in SQL, and sends back a DTO.
 *
 * Every query is scoped to its OWNER, the user authenticate let through:
 * WHERE owner_id = $1 is on every one of them. A list belonging to somebody
 * else is not forbidden, it is simply never found, so the answer is the same
 * 404 as for a list that does not exist at all and nobody can even learn that
 * it is there.
 *
 * None of these catch errors. Anything thrown, including by the database,
 * Express 5 passes along to errorHandler.
 */
import type { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import { DEFAULT_LIST_NAME, MAX_NAME_LENGTH, type ItemDTO, type ListDTO, type ListMetadata } from '@wolfie-lists/shared';
import { query, withTransaction } from '../db';
import { toListJSON, toMetadata, type ItemRow, type MetadataRow } from '../dto/listDTO';
import { buildUnusedName, isUuid, validateList } from '../rules';
import { currentUserId } from '../middleware/authenticate';
import { HttpError } from '../middleware/errorHandlers';

const NO_SUCH_LIST = 'There is no list with that id.';

/**
 * GET /api/lists, the home screen: metadata only, never items.
 *
 * One query does it all. The LEFT JOIN pairs every list with its items (or
 * with nothing, for an empty list, which a plain JOIN would leave out), and
 * GROUP BY folds each list's rows back into one, counting as it goes.
 */
export async function getAllMetadata(req: Request, res: Response<ListMetadata[]>) {
    const rows = await query<MetadataRow>(
        `SELECT lists.id, lists.name,
                count(items.id) AS item_count,
                count(items.id) FILTER (WHERE items.completed) AS completed_count
           FROM lists
           LEFT JOIN items ON items.list_id = lists.id
          WHERE lists.owner_id = $1
          GROUP BY lists.id
          ORDER BY lists.position`,
        [currentUserId(req)]);
    res.json(rows.map(toMetadata));
}

/** GET /api/lists/:id, one whole list, for editing */
export async function getList(req: Request, res: Response<ListDTO>) {
    const list = await findMyList(req);
    const items = await query<ItemRow>(
        'SELECT * FROM items WHERE list_id = $1 ORDER BY position', [list.id]);
    res.json(toListJSON(list, items));
}

/** POST /api/lists, a new empty list at the bottom of the home screen */
export async function createList(req: Request, res: Response<ListMetadata>) {
    const owner = currentUserId(req);
    const name = buildUnusedName(await myListNames(owner), DEFAULT_LIST_NAME);

    // the subquery finds the bottom of the home screen as the row goes in
    const [list] = await query<{ id: string; name: string }>(
        `INSERT INTO lists (owner_id, name, position)
         VALUES ($1, $2, (SELECT coalesce(max(position), -1) + 1 FROM lists WHERE owner_id = $1))
         RETURNING id, name`,
        [owner, name]);
    res.status(201).json({ id: list.id, name: list.name, itemCount: 0, completedCount: 0 });
}

/**
 * PUT /api/lists/:id, replaces the list's name and items. The client sends the
 * whole list after every edit, undo and redo included. The response is the new
 * metadata, so the home screen stays up to date without asking again.
 *
 * The old items are deleted and the new ones inserted inside one transaction,
 * so the list is never seen half saved, and a failure puts everything back.
 */
export async function updateList(req: Request, res: Response<ListMetadata>) {
    const { name, items } = validateList(req.body);
    const list = await findMyList(req);

    await withTransaction(async (client) => {
        await client.query('UPDATE lists SET name = $1, updated_at = now() WHERE id = $2', [name, list.id]);
        await client.query('DELETE FROM items WHERE list_id = $1', [list.id]);
        await insertItems(client, list.id, items);
    });

    res.json({
        id: list.id,
        name,
        itemCount: items.length,
        completedCount: items.filter((item) => item.completed).length
    });
}

/** POST /api/lists/:id/duplicate, a copy directly beneath the original */
export async function duplicateList(req: Request, res: Response<ListMetadata>) {
    const original = await findMyList(req);
    const owner = currentUserId(req);
    const name = buildUnusedName(await myListNames(owner), `${original.name} (Copy)`).slice(0, MAX_NAME_LENGTH);

    const copy = await withTransaction(async (client) => {
        // make room by moving every list below the original down one place
        await client.query(
            'UPDATE lists SET position = position + 1 WHERE owner_id = $1 AND position > $2',
            [owner, original.position]);

        const { rows: [created] } = await client.query<{ id: string }>(
            'INSERT INTO lists (owner_id, name, position) VALUES ($1, $2, $3) RETURNING id',
            [owner, name, original.position + 1]);

        return copyItems(client, original.id, { id: created.id, name });
    });
    res.status(201).json(toMetadata(copy));
}

/** DELETE /api/lists/:id; the database deletes its items too (ON DELETE CASCADE) */
export async function deleteList(req: Request, res: Response) {
    const id = String(req.params.id);
    const deleted = isUuid(id)
        ? await query('DELETE FROM lists WHERE id = $1 AND owner_id = $2 RETURNING id', [id, currentUserId(req)])
        : [];
    if (deleted.length === 0) throw new HttpError(404, NO_SUCH_LIST);
    res.status(204).end();
}

/** the list named in the URL, if and only if it belongs to the user asking */
async function findMyList(req: Request) {
    const id = String(req.params.id);
    // anything that is not even shaped like a uuid cannot name a list, and
    // PostgreSQL would refuse to compare it with one
    if (!isUuid(id)) throw new HttpError(404, NO_SUCH_LIST);

    const [list] = await query<{ id: string; name: string; position: number }>(
        'SELECT id, name, position FROM lists WHERE id = $1 AND owner_id = $2', [id, currentUserId(req)]);
    if (list === undefined) throw new HttpError(404, NO_SUCH_LIST);
    return list;
}

async function myListNames(owner: string): Promise<string[]> {
    const rows = await query<{ name: string }>('SELECT name FROM lists WHERE owner_id = $1', [owner]);
    return rows.map((row) => row.name);
}

/** one INSERT per item, each told its position, all inside the caller's transaction */
async function insertItems(client: PoolClient, listId: string, items: ItemDTO[]) {
    for (const [position, item] of items.entries()) {
        await client.query(
            `INSERT INTO items (list_id, id, position, description, date_entered, priority, target_date, completed)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [listId, item.id, position, item.description, item.dateEntered,
                item.priority, item.targetDate, item.completed]);
    }
}

/**
 * For duplicateList: copies every item of one list into another, each with a
 * new id, inside the caller's transaction, and returns the copy's metadata row.
 *
 * INSERT ... SELECT copies all the rows in one statement, and WITH lets the
 * same statement count what it just inserted, so there is no second query.
 */
async function copyItems(client: PoolClient, fromListId: string, toList: { id: string; name: string }) {
    const { rows: [counts] } = await client.query<MetadataRow>(
        `WITH copied AS (
             INSERT INTO items (list_id, id, position, description, date_entered, priority, target_date, completed)
             SELECT $1, 'item-' || gen_random_uuid(), position, description, date_entered, priority, target_date, completed
               FROM items WHERE list_id = $2
             RETURNING completed
         )
         SELECT $1 AS id, $3 AS name, count(*) AS item_count,
                count(*) FILTER (WHERE completed) AS completed_count
           FROM copied`,
        [toList.id, fromListId, toList.name]);
    return counts;
}
