/**
 * usersApi.test.ts
 *
 * The logged in user's own account: who am I, change my password, and my
 * avatar, which is uploaded as multipart/form-data rather than JSON.
 */
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MAX_AVATAR_BYTES } from '@wolfie-lists/shared';
import { createApp } from '../../src/app';
import { clearDatabase, logInAs, startDatabase, stopDatabase, TEST_PASSWORD } from '../helpers/database';
import { query } from '../../src/db';

const app = createApp({ logRequests: false });

/** the first bytes of every PNG file, which is all multer and we look at */
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

let me: TestAgent;
let myId: string;

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(async () => {
    await clearDatabase();
    ({ agent: me, userId: myId } = await logInAs(app, 'wolfie@stonybrook.edu'));
});

const uploadAvatar = (data: Buffer, contentType = 'image/png', filename = 'avatar.png') =>
    me.put('/api/users/me/avatar').attach('avatar', data, { filename, contentType });

describe('GET /api/users/me', () => {
    it('answers with the logged in user', async () => {
        const response = await me.get('/api/users/me');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ id: myId, email: 'wolfie@stonybrook.edu', avatarUrl: null });
    });

    it('answers 401 once the account no longer exists, even with a good token', async () => {
        await query('DELETE FROM users');
        expect((await me.get('/api/users/me')).status).toBe(401);
    });
});

describe('PUT /api/users/me/password', () => {
    it('changes the password, so only the new one logs in', async () => {
        const response = await me.put('/api/users/me/password')
            .send({ currentPassword: TEST_PASSWORD, newPassword: 'brand-new-password' });
        expect(response.status).toBe(204);

        const logIn = (password: string) => request(app).post('/api/auth/login')
            .send({ email: 'wolfie@stonybrook.edu', password });
        expect((await logIn('brand-new-password')).status).toBe(200);
        expect((await logIn(TEST_PASSWORD)).status).toBe(401);
    });

    it('refuses with a 400 when the current password is wrong, and changes nothing', async () => {
        const response = await me.put('/api/users/me/password')
            .send({ currentPassword: 'not-the-password', newPassword: 'brand-new-password' });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/current password/i);
        const logIn = await request(app).post('/api/auth/login')
            .send({ email: 'wolfie@stonybrook.edu', password: TEST_PASSWORD });
        expect(logIn.status).toBe(200);
    });

    it('refuses a new password shorter than 8 characters', async () => {
        const response = await me.put('/api/users/me/password')
            .send({ currentPassword: TEST_PASSWORD, newPassword: 'short' });

        expect(response.status).toBe(400);
    });

    it('answers 400 when either password is missing', async () => {
        expect((await me.put('/api/users/me/password').send({ newPassword: 'brand-new-password' })).status)
            .toBe(400);
    });
});

describe('the avatar', () => {
    it('does not exist until one is uploaded', async () => {
        expect((await me.get('/api/users/me/avatar')).status).toBe(404);
    });

    it('is stored, and the user now carries a URL for it', async () => {
        const response = await uploadAvatar(PNG);

        expect(response.status).toBe(200);
        expect(response.body.avatarUrl).toMatch(/^\/api\/users\/me\/avatar\?v=\d+$/);
    });

    it('comes back byte for byte, with its own content type', async () => {
        await uploadAvatar(PNG);

        const response = await me.get('/api/users/me/avatar');

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('image/png');
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(Buffer.compare(response.body, PNG)).toBe(0);
    });

    it('gets a new URL every time it changes, so no browser shows a stale one', async () => {
        const first = (await uploadAvatar(PNG)).body.avatarUrl;
        await new Promise((resolve) => setTimeout(resolve, 5));
        const second = (await uploadAvatar(PNG, 'image/jpeg', 'avatar.jpg')).body.avatarUrl;

        expect(second).not.toBe(first);
        expect((await me.get('/api/users/me/avatar')).headers['content-type']).toBe('image/jpeg');
    });

    it('is never sent as part of the user', async () => {
        await uploadAvatar(PNG);

        const response = await me.get('/api/users/me');

        expect(Object.keys(response.body).sort()).toEqual(['avatarUrl', 'email', 'id']);
    });

    it('refuses a file that is not a PNG, JPEG or WebP image', async () => {
        const response = await uploadAvatar(Buffer.from('<script>alert(1)</script>'), 'text/html', 'evil.html');

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/PNG, JPEG or WebP/);
    });

    it('refuses a file larger than 1 MB', async () => {
        const response = await uploadAvatar(Buffer.alloc(MAX_AVATAR_BYTES + 1));

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/1 MB/);
    });

    it('refuses an upload with no file in it', async () => {
        const response = await me.put('/api/users/me/avatar').field('nothing', 'here');

        expect(response.status).toBe(400);
    });

    it("is one user's only: another user still has none", async () => {
        await uploadAvatar(PNG);
        const { agent: other } = await logInAs(app, 'other@stonybrook.edu');

        expect((await other.get('/api/users/me/avatar')).status).toBe(404);
    });
});
