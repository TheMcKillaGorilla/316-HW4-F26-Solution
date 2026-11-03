/**
 * fakeServer.ts
 *
 * A stand-in for the Express server, installed in place of fetch, so the client
 * tests run without a server or a database. It answers the same routes with
 * the same shapes and the same error messages, and records every request, so
 * a test can check what reached the "server" as well as what is on screen.
 *
 * It keeps one account and remembers whether that account is logged in, which
 * stands in for the login cookie. Logged out, every route but /api/auth/*
 * answers 401, exactly as the real authenticate middleware does.
 *
 * The real server's behavior is proved by server/tests. What these tests prove
 * is that the client makes the right requests and copes with the answers,
 * including no answer at all (server.down = true).
 */
import { vi } from 'vitest';
import type { ListDTO, ListMetadata, UserDTO } from '@wolfie-lists/shared';
import { MIN_PASSWORD_LENGTH } from '@wolfie-lists/shared';
import { metadataOf, WOLFIE, WOLFIE_PASSWORD } from './fixtures';

export interface RecordedRequest {
    method: string;
    url: string;
    /** the parsed JSON, the FormData of an upload, or undefined */
    body: any;
}

export type FakeServer = ReturnType<typeof installFakeServer>;

const NOT_LOGGED_IN = { error: 'You need to log in first.' };
const NO_SUCH_LIST = { error: 'There is no list with that id.' };

/**
 * @param lists the logged in user's lists, in home screen order
 * @param loggedIn false to start with nobody logged in
 */
export function installFakeServer(lists: ListDTO[] = [], { loggedIn = true } = {}) {
    const server = {
        /** every list, in home screen order, as the database would hold them */
        lists: structuredClone(lists),
        /** the one account there is, and its password */
        account: { user: { ...WOLFIE } as UserDTO, password: WOLFIE_PASSWORD },
        /** whether the login cookie is set */
        loggedIn,
        /** every request made */
        requests: [] as RecordedRequest[],
        /** set to true to make every request fail as if the server were off */
        down: false,
        /** set to a promise to hold every answer back until it resolves */
        wait: null as Promise<unknown> | null,

        /** @returns one stored list */
        list: (id: string) => server.lists.find((list) => list.id === id),
        /** @returns the requests with this method, i.e. 'PUT' */
        requestsOf: (method: string) => server.requests.filter((request) => request.method === method)
    };

    let nextId = 1;

    function unusedName(desired: string) {
        const taken = new Set(server.lists.map((list) => list.name));
        let name = desired;
        for (let counter = 2; taken.has(name); counter++) name = `${desired} ${counter}`;
        return name;
    }

    /** @returns the status and body the real server would send */
    function answer(method: string, url: string, body: any): [number, unknown] {
        if (url.startsWith('/api/auth/')) return answerAuth(url, body);
        if (!server.loggedIn) return [401, NOT_LOGGED_IN];
        if (url.startsWith('/api/users/me')) return answerMe(method, url, body);
        return answerLists(method, url, body);
    }

    function answerAuth(url: string, body: any): [number, unknown] {
        const { account } = server;
        switch (url) {
            case '/api/auth/register':
                if (body.password.length < MIN_PASSWORD_LENGTH) {
                    return [400, { error: `A password must be at least ${MIN_PASSWORD_LENGTH} characters long.` }];
                }
                if (body.email.toLowerCase() === account.user.email) {
                    return [409, { error: 'There is already an account with that email address.' }];
                }
                // a fresh account, with no lists yet
                server.account = { user: { id: 'user-new', email: body.email, avatarUrl: null }, password: body.password };
                server.lists = [];
                server.loggedIn = true;
                return [201, server.account.user];
            case '/api/auth/login':
                if (body.email.toLowerCase() !== account.user.email || body.password !== account.password) {
                    return [401, { error: 'Invalid email or password.' }];
                }
                server.loggedIn = true;
                return [200, account.user];
            case '/api/auth/logout':
                server.loggedIn = false;
                return [204, null];
            default:
                return [404, { error: `There is no POST ${url}` }];
        }
    }

    function answerMe(method: string, url: string, body: any): [number, unknown] {
        const { account } = server;
        if (method === 'GET' && url === '/api/users/me') return [200, account.user];

        if (method === 'PUT' && url === '/api/users/me/password') {
            if (body.newPassword.length < MIN_PASSWORD_LENGTH) {
                return [400, { error: `A password must be at least ${MIN_PASSWORD_LENGTH} characters long.` }];
            }
            if (body.currentPassword !== account.password) {
                return [400, { error: 'The current password is not correct.' }];
            }
            account.password = body.newPassword;
            return [204, null];
        }

        if (method === 'PUT' && url === '/api/users/me/avatar') {
            if (!(body instanceof FormData) || body.get('avatar') === null) {
                return [400, { error: 'Choose an image to upload.' }];
            }
            // a new ?v= every upload, as the real server does
            account.user = { ...account.user, avatarUrl: `/api/users/me/avatar?v=${nextId++}` };
            return [200, account.user];
        }

        return [404, { error: `There is no ${method} ${url}` }];
    }

    function answerLists(method: string, url: string, body: any): [number, unknown] {
        const [, , , id, action] = url.split('/');   // '', 'api', 'lists', id, action
        const index = server.lists.findIndex((list) => list.id === id);
        const list = server.lists[index];

        if (id === undefined) {
            if (method === 'GET') return [200, server.lists.map(metadataOf)];
            const created: ListDTO = { id: `server-list-${nextId++}`, name: unusedName('Untitled List'), items: [] };
            server.lists.push(created);
            return [201, metadataOf(created)];
        }

        if (list === undefined) return [404, NO_SUCH_LIST];

        if (action === 'duplicate') {
            const copy: ListDTO = {
                id: `server-list-${nextId++}`,
                name: unusedName(`${list.name} (Copy)`).slice(0, 60),
                items: list.items.map((item) => ({ ...item, id: `${item.id}-copy-${nextId++}` }))
            };
            server.lists.splice(index + 1, 0, copy);
            return [201, metadataOf(copy)];
        }

        switch (method) {
            case 'GET':
                return [200, structuredClone(list)];
            case 'PUT':
                server.lists[index] = { id: list.id, name: body.name, items: structuredClone(body.items) };
                return [200, metadataOf(server.lists[index]) satisfies ListMetadata];
            case 'DELETE':
                server.lists.splice(index, 1);
                return [204, null];
            default:
                return [404, { error: `There is no ${method} ${url}` }];
        }
    }

    vi.stubGlobal('fetch', vi.fn(async (url: string, { method = 'GET', body }: RequestInit = {}) => {
        const parsed = (body === undefined || body instanceof FormData) ? body : JSON.parse(body as string);
        server.requests.push({ method, url, body: parsed });

        await server.wait;
        if (server.down) throw new TypeError('Failed to fetch');

        const [status, data] = answer(method, url, parsed);
        return new Response(status === 204 ? null : JSON.stringify(data), {
            status,
            headers: { 'Content-Type': 'application/json' }
        });
    }));

    return server;
}
