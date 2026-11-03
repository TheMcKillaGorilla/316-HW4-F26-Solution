/**
 * auth.test.ts
 *
 * The three pieces of authentication on their own, with no database and no
 * HTTP: hashing passwords, signing and checking tokens, and the authenticate
 * middleware deciding whether a request may go on.
 */
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { hashPassword, passwordMatches } from '../../src/auth/passwords';
import { signToken, verifyToken } from '../../src/auth/tokens';
import { authenticate } from '../../src/middleware/authenticate';
import { HttpError } from '../../src/middleware/errorHandlers';
import { JWT_SECRET } from '../../src/config';

describe('hashPassword and passwordMatches', () => {
    it('accept the password that was hashed', async () => {
        const hash = await hashPassword('seawolves');
        expect(await passwordMatches('seawolves', hash)).toBe(true);
    });

    it('reject any other password', async () => {
        const hash = await hashPassword('seawolves');
        expect(await passwordMatches('Seawolves', hash)).toBe(false);
    });

    it('never contain the password itself', async () => {
        expect(await hashPassword('seawolves')).not.toContain('seawolves');
    });

    it('salt every hash, so the same password hashes differently each time', async () => {
        expect(await hashPassword('seawolves')).not.toBe(await hashPassword('seawolves'));
    });
});

describe('signToken and verifyToken', () => {
    it('get back the user id that was signed', () => {
        expect(verifyToken(signToken('user-42'))).toBe('user-42');
    });

    it('refuse a token whose payload was changed', () => {
        const [header, , signature] = signToken('user-42').split('.');
        const forgedPayload = Buffer.from(JSON.stringify({ sub: 'admin' })).toString('base64url');

        expect(verifyToken(`${header}.${forgedPayload}.${signature}`)).toBeNull();
    });

    it('refuse a token signed with some other secret', () => {
        expect(verifyToken(jwt.sign({ sub: 'user-42' }, 'a-guessed-secret'))).toBeNull();
    });

    it('refuse a token that has expired', () => {
        const expired = jwt.sign({ sub: 'user-42' }, JWT_SECRET, { expiresIn: -10 });
        expect(verifyToken(expired)).toBeNull();
    });

    it('refuse something that is not a token at all', () => {
        expect(verifyToken('nonsense')).toBeNull();
    });
});

describe('authenticate', () => {
    /** runs the middleware on a fake request and reports what it passed to next */
    function run(cookies: Record<string, string> | undefined) {
        const req = { cookies } as Request;
        const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
        authenticate(req, {} as Response, next);
        return { req, next };
    }

    it('lets a request with a good token through, carrying its user id', () => {
        const { req, next } = run({ token: signToken('user-42') });

        expect(next).toHaveBeenCalledWith();
        expect(req.userId).toBe('user-42');
    });

    it.each([
        ['no cookies at all', undefined],
        ['no token cookie', { other: 'x' }],
        ['a token that does not verify', { token: 'forged' }]
    ])('stops a request with %s with a 401', (_, cookies) => {
        const { req, next } = run(cookies);

        const error = next.mock.calls[0][0];
        expect(error).toBeInstanceOf(HttpError);
        expect(error.status).toBe(401);
        expect(req.userId).toBeUndefined();
    });
});
