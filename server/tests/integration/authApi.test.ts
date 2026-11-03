/**
 * authApi.test.ts
 *
 * Registering, logging in and logging out, through real HTTP requests. The
 * cookie the server sets is what these tests are mostly about: that it is set,
 * that it is httpOnly, and that it is what gets a user in afterwards.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { query } from '../../src/db';
import { verifyToken } from '../../src/auth/tokens';
import { LOGIN_FAILED } from '../../src/controllers/authController';
import { clearDatabase, countRows, logInAs, startDatabase, stopDatabase, TEST_PASSWORD } from '../helpers/database';

const app = createApp({ logRequests: false });
const api = () => request(app);

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(clearDatabase);

/** @returns the Set-Cookie header for the login cookie, or undefined */
function tokenCookie(response: request.Response): string | undefined {
    const cookies = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
    return cookies.find((cookie) => cookie.startsWith('token='));
}

function tokenIn(cookie: string): string {
    return cookie.split(';')[0].slice('token='.length);
}

describe('POST /api/auth/register', () => {
    it('makes the account, answers 201 with the user, and logs them in', async () => {
        const response = await api().post('/api/auth/register')
            .send({ email: 'new@stonybrook.edu', password: TEST_PASSWORD });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({ id: expect.any(String), email: 'new@stonybrook.edu', avatarUrl: null });
        expect(verifyToken(tokenIn(tokenCookie(response)!))).toBe(response.body.id);
    });

    it('sets the cookie httpOnly, so scripts on the page cannot read it', async () => {
        const response = await api().post('/api/auth/register')
            .send({ email: 'new@stonybrook.edu', password: TEST_PASSWORD });

        expect(tokenCookie(response)).toMatch(/HttpOnly/i);
        expect(tokenCookie(response)).toMatch(/SameSite=Lax/i);
    });

    it('stores a bcrypt hash, never the password itself', async () => {
        await api().post('/api/auth/register').send({ email: 'new@stonybrook.edu', password: TEST_PASSWORD });

        const [user] = await query<{ password_hash: string }>(
            'SELECT password_hash FROM users WHERE email = $1', ['new@stonybrook.edu']);
        expect(user.password_hash).not.toContain(TEST_PASSWORD);
        expect(user.password_hash).toMatch(/^\$2[aby]\$/);
    });

    it('never sends the hash back', async () => {
        const response = await api().post('/api/auth/register')
            .send({ email: 'new@stonybrook.edu', password: TEST_PASSWORD });

        expect(JSON.stringify(response.body)).not.toMatch(/\$2[aby]\$/);
    });

    it('stores the email in lower case', async () => {
        const response = await api().post('/api/auth/register')
            .send({ email: '  Wolfie@StonyBrook.EDU ', password: TEST_PASSWORD });

        expect(response.body.email).toBe('wolfie@stonybrook.edu');
    });

    it('refuses an email that already has an account, whatever its case, with a 409', async () => {
        await logInAs(app, 'wolfie@stonybrook.edu');

        const response = await api().post('/api/auth/register')
            .send({ email: 'WOLFIE@stonybrook.edu', password: TEST_PASSWORD });

        expect(response.status).toBe(409);
        expect(await countRows('users')).toBe(1);
    });

    it('refuses a password shorter than 8 characters', async () => {
        const response = await api().post('/api/auth/register')
            .send({ email: 'new@stonybrook.edu', password: 'short' });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/8 characters/);
    });

    it.each([
        ['no email', { password: TEST_PASSWORD }],
        ['no password', { email: 'new@stonybrook.edu' }],
        ['a blank email', { email: '  ', password: TEST_PASSWORD }],
        ['no body at all', undefined]
    ])('answers 400 for %s', async (_, body) => {
        expect((await api().post('/api/auth/register').send(body)).status).toBe(400);
    });

    it('answers 400 for something that is not an email address', async () => {
        const response = await api().post('/api/auth/register')
            .send({ email: 'not-an-email', password: TEST_PASSWORD });

        expect(response.status).toBe(400);
    });
});

describe('POST /api/auth/login', () => {
    beforeEach(async () => {
        await logInAs(app, 'wolfie@stonybrook.edu');
    });

    it('answers with the user and sets the login cookie', async () => {
        const response = await api().post('/api/auth/login')
            .send({ email: 'wolfie@stonybrook.edu', password: TEST_PASSWORD });

        expect(response.status).toBe(200);
        expect(response.body.email).toBe('wolfie@stonybrook.edu');
        expect(verifyToken(tokenIn(tokenCookie(response)!))).toBe(response.body.id);
    });

    it('does not care about the case of the email', async () => {
        const response = await api().post('/api/auth/login')
            .send({ email: 'Wolfie@StonyBrook.edu', password: TEST_PASSWORD });

        expect(response.status).toBe(200);
    });

    it('gives the same 401 for a wrong password as for an unknown email', async () => {
        const wrongPassword = await api().post('/api/auth/login')
            .send({ email: 'wolfie@stonybrook.edu', password: 'not-the-password' });
        const unknownEmail = await api().post('/api/auth/login')
            .send({ email: 'nobody@stonybrook.edu', password: TEST_PASSWORD });

        expect(wrongPassword.status).toBe(401);
        expect(unknownEmail.status).toBe(401);
        expect(wrongPassword.body).toEqual({ error: LOGIN_FAILED });
        expect(unknownEmail.body).toEqual(wrongPassword.body);
    });

    it('sets no cookie when it fails', async () => {
        const response = await api().post('/api/auth/login')
            .send({ email: 'wolfie@stonybrook.edu', password: 'not-the-password' });

        expect(tokenCookie(response)).toBeUndefined();
    });

    it('lets the agent in afterwards', async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/login').send({ email: 'wolfie@stonybrook.edu', password: TEST_PASSWORD });

        expect((await agent.get('/api/users/me')).status).toBe(200);
    });
});

describe('POST /api/auth/logout', () => {
    it('clears the cookie, so the agent is no longer let in', async () => {
        const { agent } = await logInAs(app, 'wolfie@stonybrook.edu');

        const response = await agent.post('/api/auth/logout');

        expect(response.status).toBe(204);
        expect(tokenCookie(response)).toMatch(/^token=;/);
        expect((await agent.get('/api/users/me')).status).toBe(401);
    });

    it('works even for somebody who was not logged in', async () => {
        expect((await api().post('/api/auth/logout')).status).toBe(204);
    });
});
