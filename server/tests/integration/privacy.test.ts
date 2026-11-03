/**
 * privacy.test.ts
 *
 * THE LOAD BEARING TESTS of this assignment: one user can never find, see,
 * change or delete another user's lists, and nobody who is not logged in can
 * reach any list at all.
 *
 * A list that belongs to somebody else must look exactly like a list that
 * does not exist, a 404, so that a stranger cannot even learn that it is there.
 */
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ListMetadata } from '@wolfie-lists/shared';
import { createApp } from '../../src/app';
import {
    clearDatabase, countRows, findListRow, insertLists, logInAs, MISSING_ID, startDatabase, stopDatabase
} from '../helpers/database';
import { CHORES_LIST, WEEKEND_LIST } from '../helpers/fixtures';

const app = createApp({ logRequests: false });

let alice: TestAgent;
let bob: TestAgent;
let aliceId: string;
let alicesList: string;

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(async () => {
    await clearDatabase();
    ({ agent: alice, userId: aliceId } = await logInAs(app, 'alice@stonybrook.edu'));
    ({ agent: bob } = await logInAs(app, 'bob@stonybrook.edu'));
    [alicesList] = await insertLists(aliceId, [WEEKEND_LIST]);
});

describe("another user's lists", () => {
    it('are not on the home screen', async () => {
        const response = await bob.get('/api/lists');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it('cannot be opened, and look exactly like lists that do not exist', async () => {
        const theirs = await bob.get(`/api/lists/${alicesList}`);
        const nobodys = await bob.get(`/api/lists/${MISSING_ID}`);

        expect(theirs.status).toBe(404);
        expect(theirs.body).toEqual(nobodys.body);
    });

    it('cannot be changed', async () => {
        const response = await bob.put(`/api/lists/${alicesList}`).send({ name: 'Mine Now', items: [] });

        expect(response.status).toBe(404);
        expect((await findListRow(alicesList))?.name).toBe(WEEKEND_LIST.name);
    });

    it('cannot be deleted', async () => {
        expect((await bob.delete(`/api/lists/${alicesList}`)).status).toBe(404);
        expect(await findListRow(alicesList)).toBeDefined();
    });

    it('cannot be duplicated into your own', async () => {
        expect((await bob.post(`/api/lists/${alicesList}/duplicate`)).status).toBe(404);
        expect(await countRows('lists')).toBe(1);
    });

    it('do not count when naming a new list', async () => {
        await insertLists(aliceId, [{ name: 'Untitled List', items: [] }]);

        const response = await bob.post('/api/lists');

        expect(response.body.name).toBe('Untitled List');
    });
});

describe('two users side by side', () => {
    it('each see only their own lists, in their own order', async () => {
        await bob.post('/api/lists');
        await insertLists(aliceId, [CHORES_LIST], 1);

        const names = async (agent: TestAgent) =>
            (await agent.get('/api/lists')).body.map((list: ListMetadata) => list.name);

        expect(await names(alice)).toEqual([WEEKEND_LIST.name, CHORES_LIST.name]);
        expect(await names(bob)).toEqual(['Untitled List']);
    });

    it("do not disturb each other's positions when duplicating", async () => {
        const [bobsFirst] = await insertLists(String((await bob.get('/api/users/me')).body.id), [CHORES_LIST]);

        await bob.post(`/api/lists/${bobsFirst}/duplicate`);

        expect((await findListRow(alicesList))?.position).toBe(0);
    });
});

describe('a visitor who is not logged in', () => {
    const visitor = () => request(app);

    it.each([
        ['GET', '/api/lists'],
        ['POST', '/api/lists'],
        ['GET', '/api/lists/LIST'],
        ['PUT', '/api/lists/LIST'],
        ['DELETE', '/api/lists/LIST'],
        ['POST', '/api/lists/LIST/duplicate'],
        ['GET', '/api/users/me'],
        ['PUT', '/api/users/me/password'],
        ['GET', '/api/users/me/avatar'],
        ['PUT', '/api/users/me/avatar']
    ])('is refused %s %s with a 401', async (method, path) => {
        const url = path.replace('LIST', alicesList);
        const response = await visitor()[method.toLowerCase() as 'get'](url);

        expect(response.status).toBe(401);
        expect(response.body.error).toMatch(/log in/i);
    });

    it('cannot get in with a forged token', async () => {
        const response = await visitor().get('/api/lists').set('Cookie', 'token=not.a.real-token');
        expect(response.status).toBe(401);
    });
});
