/**
 * listsApi.test.ts
 *
 * Every list route, through real HTTP requests to the real app, backed by a
 * real PostgreSQL. Nothing is mocked. Each test is logged in as a
 * fresh user (see logInAs), so these are about one user's own lists; what
 * happens between two users is in privacy.test.ts, and the duplicate route
 * has a file of its own, duplicateList.test.ts.
 */
import type TestAgent from 'supertest/lib/agent';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ListMetadata } from '@wolfie-lists/shared';
import { createApp } from '../../src/app';
import {
    clearDatabase, findListRow, insertLists, logInAs, MISSING_ID, startDatabase, stopDatabase
} from '../helpers/database';
import { CHORES_LIST, EMPTY_LIST, WEEKEND_LIST } from '../helpers/fixtures';

const app = createApp({ logRequests: false });

let api: TestAgent;
let me: string;

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(async () => {
    await clearDatabase();
    ({ agent: api, userId: me } = await logInAs(app, 'wolfie@stonybrook.edu'));
});

/** @returns the list names in home screen order */
async function namesInOrder(): Promise<string[]> {
    return (await api.get('/api/lists')).body.map((list: ListMetadata) => list.name);
}

describe('GET /api/lists', () => {
    it('sends metadata only, never items', async () => {
        await insertLists(me, [WEEKEND_LIST]);

        const response = await api.get('/api/lists');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(Object.keys(response.body[0]).sort())
            .toEqual(['completedCount', 'id', 'itemCount', 'name']);
    });

    it('counts the items and the completed items', async () => {
        await insertLists(me, [WEEKEND_LIST, EMPTY_LIST]);

        const [weekend, empty] = (await api.get('/api/lists')).body;

        expect(weekend).toMatchObject({ itemCount: 3, completedCount: 1 });
        expect(empty).toMatchObject({ itemCount: 0, completedCount: 0 });
    });

    it('sends the lists in position order', async () => {
        await insertLists(me, [CHORES_LIST], 5);
        await insertLists(me, [WEEKEND_LIST], 1);

        expect(await namesInOrder()).toEqual(["Wolfie's Weekend", 'Chores']);
    });

    it('sends an empty array to a user with no lists', async () => {
        const response = await api.get('/api/lists');
        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });
});

describe('GET /api/lists/:id', () => {
    it('sends the whole list', async () => {
        const [id] = await insertLists(me, [WEEKEND_LIST]);

        const response = await api.get(`/api/lists/${id}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ id, ...WEEKEND_LIST });
    });

    it('answers 404 for an id no list has', async () => {
        const response = await api.get(`/api/lists/${MISSING_ID}`);
        expect(response.status).toBe(404);
        expect(response.body.error).toMatch(/no list/i);
    });

    it('answers 404 for something that is not an id at all', async () => {
        expect((await api.get('/api/lists/not-an-id')).status).toBe(404);
    });
});

describe('POST /api/lists', () => {
    it('makes an empty list called Untitled List, owned by the user, and sends its metadata', async () => {
        const response = await api.post('/api/lists');

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ name: 'Untitled List', itemCount: 0, completedCount: 0 });
        expect((await findListRow(response.body.id))?.owner_id).toBe(me);
    });

    it('does not reuse a name that is taken', async () => {
        await api.post('/api/lists');
        const second = await api.post('/api/lists');

        expect(second.body.name).toBe('Untitled List 2');
    });

    it('puts the new list at the bottom of the home screen', async () => {
        await insertLists(me, [WEEKEND_LIST, CHORES_LIST]);
        await api.post('/api/lists');

        expect(await namesInOrder()).toEqual(["Wolfie's Weekend", 'Chores', 'Untitled List']);
    });
});

describe('PUT /api/lists/:id', () => {
    it('replaces the name and the items, and sends back the new metadata', async () => {
        const [id] = await insertLists(me, [WEEKEND_LIST]);
        const items = WEEKEND_LIST.items.map((item) => ({ ...item, completed: true }));

        const response = await api.put(`/api/lists/${id}`).send({ name: 'Done', items });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ id, name: 'Done', itemCount: 3, completedCount: 3 });
        expect((await api.get(`/api/lists/${id}`)).body).toEqual({ id, name: 'Done', items });
    });

    it('keeps the item order it was sent', async () => {
        const [id] = await insertLists(me, [WEEKEND_LIST]);
        const reversed = WEEKEND_LIST.items.toReversed();

        await api.put(`/api/lists/${id}`).send({ name: WEEKEND_LIST.name, items: reversed });

        expect((await api.get(`/api/lists/${id}`)).body.items).toEqual(reversed);
    });

    it('does not let a client move a list by sending a position', async () => {
        const [first] = await insertLists(me, [WEEKEND_LIST, CHORES_LIST]);

        await api.put(`/api/lists/${first}`).send({ ...WEEKEND_LIST, position: 99 });

        expect(await namesInOrder()).toEqual(["Wolfie's Weekend", 'Chores']);
    });

    it('does not let a client give a list away by sending an owner', async () => {
        const [id] = await insertLists(me, [WEEKEND_LIST]);
        const { userId: someoneElse } = await logInAs(app, 'someone@stonybrook.edu');

        await api.put(`/api/lists/${id}`).send({ ...WEEKEND_LIST, owner: someoneElse });

        expect((await findListRow(id))?.owner_id).toBe(me);
    });

    it('answers 400 when the name or items are missing', async () => {
        const [id] = await insertLists(me, [WEEKEND_LIST]);

        expect((await api.put(`/api/lists/${id}`).send({ name: 'x' })).status).toBe(400);
        expect((await api.put(`/api/lists/${id}`).send({ items: [] })).status).toBe(400);
    });

    it('answers 400 when an item is invalid, and changes nothing', async () => {
        const [id] = await insertLists(me, [WEEKEND_LIST]);
        const items = [{ ...WEEKEND_LIST.items[0], priority: 'Urgent' }];

        const response = await api.put(`/api/lists/${id}`).send({ name: 'x', items });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/priority/);
        expect((await api.get(`/api/lists/${id}`)).body.name).toBe(WEEKEND_LIST.name);
    });

    it('answers 400 for a date that does not exist, and keeps the list exactly as it was', async () => {
        // 2026-02-30 is shaped like a date, so only PostgreSQL catches it, after
        // the old items were already deleted. The transaction puts them back.
        const [id] = await insertLists(me, [WEEKEND_LIST]);
        const items = [{ ...WEEKEND_LIST.items[0], dateEntered: '2026-02-30' }];

        const response = await api.put(`/api/lists/${id}`).send({ name: 'Changed', items });

        expect(response.status).toBe(400);
        expect((await api.get(`/api/lists/${id}`)).body).toEqual({ id, ...WEEKEND_LIST });
    });

    it('answers 404 for an id no list has', async () => {
        const response = await api.put(`/api/lists/${MISSING_ID}`).send(WEEKEND_LIST);
        expect(response.status).toBe(404);
    });
});

describe('DELETE /api/lists/:id', () => {
    it('deletes the list and answers 204', async () => {
        const [weekend] = await insertLists(me, [WEEKEND_LIST, CHORES_LIST]);

        const response = await api.delete(`/api/lists/${weekend}`);

        expect(response.status).toBe(204);
        expect(await namesInOrder()).toEqual(['Chores']);
    });

    it('answers 404 for an id no list has', async () => {
        expect((await api.delete(`/api/lists/${MISSING_ID}`)).status).toBe(404);
    });
});
