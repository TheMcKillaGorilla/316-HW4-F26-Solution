/**
 * authController.ts
 *
 * Creating an account, logging in and logging out. These are the only routes
 * that work without a token, since their whole job is to hand one out or take
 * it away.
 */
import type { Request, Response } from 'express';
import { MIN_PASSWORD_LENGTH, type UserDTO } from '@wolfie-lists/shared';
import { query } from '../db';
import { toUserJSON, USER_COLUMNS, type UserRow } from '../dto/userDTO';
import { hashPassword, passwordMatches } from '../auth/passwords';
import { COOKIE_OPTIONS, TOKEN_COOKIE, signToken } from '../auth/tokens';
import { HttpError } from '../middleware/errorHandlers';

/** the same words for a wrong email and a wrong password, so neither gives away which */
export const LOGIN_FAILED = 'Invalid email or password.';

// deliberately loose: the real test of an email address is sending it mail
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST /api/auth/register { email, password }: makes the account and logs straight in */
export async function register(req: Request, res: Response<UserDTO>) {
    const { email, password } = readCredentials(req.body);
    if (!EMAIL.test(email)) throw new HttpError(400, 'That is not an email address.');
    if (password.length < MIN_PASSWORD_LENGTH) {
        throw new HttpError(400, `A password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
    }
    if ((await query('SELECT 1 FROM users WHERE email = $1', [email])).length > 0) {
        throw new HttpError(409, 'There is already an account with that email address.');
    }

    // RETURNING hands back the new row, so there is no second query to find it
    const [user] = await query<UserRow>(
        `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING ${USER_COLUMNS}`,
        [email, await hashPassword(password)]);
    logIn(res, user.id);
    res.status(201).json(toUserJSON(user));
}

/** POST /api/auth/login { email, password } */
export async function login(req: Request, res: Response<UserDTO>) {
    const { email, password } = readCredentials(req.body);
    const [user] = await query<UserRow & { password_hash: string }>(
        `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = $1`, [email]);

    if (user === undefined || !(await passwordMatches(password, user.password_hash))) {
        throw new HttpError(401, LOGIN_FAILED);
    }
    logIn(res, user.id);
    res.json(toUserJSON(user));
}

/**
 * POST /api/auth/logout. The token itself stays valid until it expires, since
 * the server keeps no list of them; what logging out does is make the browser
 * forget it.
 */
export function logout(_req: Request, res: Response) {
    res.clearCookie(TOKEN_COOKIE, { ...COOKIE_OPTIONS, maxAge: undefined });
    res.status(204).end();
}

function logIn(res: Response, userId: string) {
    res.cookie(TOKEN_COOKIE, signToken(userId), COOKIE_OPTIONS);
}

/** @returns the email, trimmed and in lower case as it is stored, and the password */
function readCredentials(body: unknown): { email: string; password: string } {
    const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };
    if (typeof email !== 'string' || typeof password !== 'string' || email.trim() === '') {
        throw new HttpError(400, 'An email address and a password are both required.');
    }
    return { email: email.trim().toLowerCase(), password };
}
