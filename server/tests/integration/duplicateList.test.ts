/**
 * duplicateList.test.ts
 *
 * POST /api/lists/:id/duplicate, through real HTTP requests (supertest) to the
 * real app, backed by a real PostgreSQL of its own. Nothing is mocked.
 *
 * Every test follows the same three steps:
 *
 *   1. put lists in the database          insertLists(me, [...])
 *   2. send a request                     await api.post(`/api/lists/${id}/duplicate`)
 *   3. check the response and what the database now holds
 *
 * listsApi.test.ts tests every other route the same way, and is the place to
 * look for examples.
 */
import type TestAgent from 'supertest/lib/agent';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ItemDTO, ListMetadata } from '@wolfie-lists/shared';
import { createApp } from '../../src/app';
import { clearDatabase, insertLists, logInAs, MISSING_ID, startDatabase, stopDatabase } from '../helpers/database';
import { CHORES_LIST, WEEKEND_LIST } from '../helpers/fixtures';

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

/** an item without its id, to compare contents only */
const withoutId = ({ id: _id, ...rest }: ItemDTO) => rest;

describe('POST /api/lists/:id/duplicate', () => {
    it('answers 201 with the metadata of the copy', async () => {
        const [id] = await insertLists(me, [WEEKEND_LIST]);

        const response = await api.post(`/api/lists/${id}/duplicate`);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
            name: "Wolfie's Weekend (Copy)", itemCount: 3, completedCount: 1
        });
        expect(response.body.id).not.toBe(id);
    });

    it('files the copy directly beneath the original', async () => {
        const [weekend] = await insertLists(me, [WEEKEND_LIST, CHORES_LIST]);

        await api.post(`/api/lists/${weekend}/duplicate`);

        expect(await namesInOrder())
            .toEqual(["Wolfie's Weekend", "Wolfie's Weekend (Copy)", 'Chores']);
    });

    it('copies every item, each with an id of its own', async () => {
        const [id] = await insertLists(me, [WEEKEND_LIST]);

        const copyId = (await api.post(`/api/lists/${id}/duplicate`)).body.id;
        const copy = (await api.get(`/api/lists/${copyId}`)).body;

        expect(copy.items.map(withoutId)).toEqual(WEEKEND_LIST.items.map(withoutId));
        for (const [index, item] of (copy.items as ItemDTO[]).entries()) {
            expect(item.id).not.toBe(WEEKEND_LIST.items[index].id);
        }
    });

    it('leaves the original list as it was', async () => {
        const [id] = await insertLists(me, [WEEKEND_LIST]);

        await api.post(`/api/lists/${id}/duplicate`);

        expect((await api.get(`/api/lists/${id}`)).body).toEqual({ id, ...WEEKEND_LIST });
    });

    it('does not reuse a copy name that is taken', async () => {
        const [id] = await insertLists(me, [WEEKEND_LIST]);

        await api.post(`/api/lists/${id}/duplicate`);
        const second = await api.post(`/api/lists/${id}/duplicate`);

        expect(second.body.name).toBe("Wolfie's Weekend (Copy) 2");
    });

    it('keeps a copy of a long name within 60 characters', async () => {
        const [id] = await insertLists(me, [{ name: 'x'.repeat(60), items: [] }]);

        const response = await api.post(`/api/lists/${id}/duplicate`);

        expect(response.status).toBe(201);
        expect(response.body.name).toHaveLength(60);
    });

    it('answers 404 for an id no list has', async () => {
        expect((await api.post(`/api/lists/${MISSING_ID}/duplicate`)).status).toBe(404);
    });
});
