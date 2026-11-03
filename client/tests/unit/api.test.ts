/**
 * api.test.ts
 *
 * The Facade over fetch: the right method, URL and body for each call, errors
 * turned into ApiErrors, a 401 reported to whoever is listening, and requests
 * kept in order.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/lib/api';
import { ApiError } from '@/lib/api';

/** stubs fetch to answer every request with one status and body */
function answerWith(status: number, body: unknown = null) {
    const fetchSpy = vi.fn(async (_url: string, _options?: RequestInit) =>
        new Response(status === 204 ? null : JSON.stringify(body), { status }));
    vi.stubGlobal('fetch', fetchSpy);
    return fetchSpy;
}

/** stubs fetch to throw, the way it does when no answer comes back at all */
function answerWithNothing() {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
}

// the handler is module state in api.ts, so put the do-nothing one back
afterEach(() => api.setUnauthorizedHandler(() => {}));

describe('each call', () => {
    it.each([
        ['getAllMetadata', () => api.getAllMetadata(), 'GET', '/api/lists'],
        ['getList', () => api.getList('abc'), 'GET', '/api/lists/abc'],
        ['createList', () => api.createList(), 'POST', '/api/lists'],
        ['duplicateList', () => api.duplicateList('abc'), 'POST', '/api/lists/abc/duplicate'],
        ['deleteList', () => api.deleteList('abc'), 'DELETE', '/api/lists/abc'],
        ['logout', () => api.logout(), 'POST', '/api/auth/logout'],
        ['getMe', () => api.getMe(), 'GET', '/api/users/me']
    ])('%s sends %s %s', async (_name, call, method, url) => {
        const fetchSpy = answerWith(200, {});
        await call();
        expect(fetchSpy).toHaveBeenCalledWith(url, expect.objectContaining({ method }));
    });

    it('saveList PUTs the name and items as JSON, and nothing else', async () => {
        const fetchSpy = answerWith(200, {});
        // a variable rather than a literal, or TypeScript would refuse the extra field
        const listWithExtra = { id: 'abc', name: 'Chores', items: [], extra: 'no' };
        await api.saveList(listWithExtra);

        const [url, options] = fetchSpy.mock.calls[0];
        expect(url).toBe('/api/lists/abc');
        expect(options?.method).toBe('PUT');
        expect(options?.headers).toEqual({ 'Content-Type': 'application/json' });
        expect(JSON.parse(options?.body as string)).toEqual({ name: 'Chores', items: [] });
    });

    it('hands back the parsed body', async () => {
        answerWith(200, [{ id: 'a' }]);
        expect(await api.getAllMetadata()).toEqual([{ id: 'a' }]);
    });

    it('hands back null for a 204 with no body', async () => {
        answerWith(204);
        expect(await api.deleteList('abc')).toBeNull();
    });
});

describe('the account calls', () => {
    it.each([
        ['register', () => api.register('wolfie@stonybrook.edu', 'seawolves'), '/api/auth/register'],
        ['login', () => api.login('wolfie@stonybrook.edu', 'seawolves'), '/api/auth/login']
    ])('%s POSTs the email and password as JSON', async (_name, call, url) => {
        const fetchSpy = answerWith(200, {});
        await call();

        const [calledUrl, options] = fetchSpy.mock.calls[0];
        expect(calledUrl).toBe(url);
        expect(options?.method).toBe('POST');
        expect(JSON.parse(options?.body as string))
            .toEqual({ email: 'wolfie@stonybrook.edu', password: 'seawolves' });
    });

    it('changePassword PUTs both passwords', async () => {
        const fetchSpy = answerWith(204);
        await api.changePassword('seawolves', 'go seawolves');

        const [url, options] = fetchSpy.mock.calls[0];
        expect(url).toBe('/api/users/me/password');
        expect(options?.method).toBe('PUT');
        expect(JSON.parse(options?.body as string))
            .toEqual({ currentPassword: 'seawolves', newPassword: 'go seawolves' });
    });

    /**
     * A file goes as multipart form data. fetch writes that Content-Type
     * itself, boundary and all, so api.ts must not set one of its own.
     */
    it('uploadAvatar PUTs the file as form data, with no Content-Type of its own', async () => {
        const fetchSpy = answerWith(200, {});
        const file = new File(['png bytes'], 'wolfie.png', { type: 'image/png' });

        await api.uploadAvatar(file);

        const [url, options] = fetchSpy.mock.calls[0];
        expect(url).toBe('/api/users/me/avatar');
        expect(options?.method).toBe('PUT');
        expect(options?.headers).toEqual({});
        expect(options?.body).toBeInstanceOf(FormData);
        expect((options?.body as FormData).get('avatar')).toBe(file);
    });
});

describe('errors', () => {
    it('carries the server\'s own message and status', async () => {
        answerWith(404, { error: 'There is no list with that id.' });

        const error = await api.getList('abc').catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toBe('There is no list with that id.');
        expect((error as ApiError).status).toBe(404);
    });

    it('says the server could not be reached when there was no answer at all', async () => {
        answerWithNothing();

        await expect(api.getAllMetadata()).rejects.toThrow(/could not be reached/);
    });

    it('does not stop later requests from going out', async () => {
        answerWithNothing();
        await api.getAllMetadata().catch(() => {});

        answerWith(200, []);
        expect(await api.getAllMetadata()).toEqual([]);
    });
});

describe('a login that has run out', () => {
    it('calls the unauthorized handler on a 401', async () => {
        const handler = vi.fn();
        api.setUnauthorizedHandler(handler);
        answerWith(401, { error: 'You need to log in first.' });

        await expect(api.getAllMetadata()).rejects.toThrow('You need to log in first.');
        expect(handler).toHaveBeenCalledOnce();
    });

    /**
     * A 401 from the login form means a wrong password, not an expired login,
     * and the user is already on the page they would be sent to.
     */
    it('does not call it for a 401 from /api/auth/', async () => {
        const handler = vi.fn();
        api.setUnauthorizedHandler(handler);
        answerWith(401, { error: 'Invalid email or password.' });

        await expect(api.login('wolfie@stonybrook.edu', 'wrong')).rejects.toThrow('Invalid email or password.');
        expect(handler).not.toHaveBeenCalled();
    });

    it('does not call it for any other error', async () => {
        const handler = vi.fn();
        api.setUnauthorizedHandler(handler);
        answerWith(404, { error: 'There is no list with that id.' });

        await api.getList('abc').catch(() => {});
        expect(handler).not.toHaveBeenCalled();
    });
});

describe('ordering', () => {
    /**
     * Two saves in quick succession must reach the server in the order they
     * were made, or the older version of the list could be the one kept.
     */
    it('sends one request at a time, in the order they were made', async () => {
        const order: string[] = [];
        let releaseFirst = () => {};
        vi.stubGlobal('fetch', vi.fn((_url: string, { body }: RequestInit) => {
            const { name } = JSON.parse(body as string);
            order.push(`start ${name}`);
            return new Promise((resolve) => {
                const finish = () => {
                    order.push(`end ${name}`);
                    resolve(new Response('{}', { status: 200 }));
                };
                if (name === 'first') releaseFirst = finish; else finish();
            });
        }));

        const first = api.saveList({ id: 'a', name: 'first', items: [] });
        const second = api.saveList({ id: 'a', name: 'second', items: [] });

        // the second has not even started while the first is outstanding
        await vi.waitFor(() => expect(order).toEqual(['start first']));
        releaseFirst();
        await Promise.all([first, second]);

        expect(order).toEqual(['start first', 'end first', 'start second', 'end second']);
    });
});
