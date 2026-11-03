/**
 * tokens.ts
 *
 * A JSON Web Token is the server's signed note saying "this is user 66f0...".
 * It is three base64 parts, header.payload.signature, and anyone can read the
 * first two. What nobody can do without JWT_SECRET is make a signature that
 * matches, so a token that verifies is one this server made, unaltered.
 *
 * The token travels in an httpOnly cookie. The browser sends it with every
 * request by itself, and no script on the page can read it, so a cross-site
 * scripting bug cannot steal it.
 */
import jwt from 'jsonwebtoken';
import type { CookieOptions } from 'express';
import { JWT_SECRET, TOKEN_LIFETIME_SECONDS } from '../config';

export const TOKEN_COOKIE = 'token';

/** what we put inside a token. sub (subject) is the standard name for "who" */
interface TokenPayload {
    sub: string;
}

export function signToken(userId: string): string {
    const payload: TokenPayload = { sub: userId };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_LIFETIME_SECONDS });
}

/** @returns the user id inside the token, or null if it is forged, damaged or expired */
export function verifyToken(token: string): string | null {
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
        return null;
    }
}

export const COOKIE_OPTIONS: CookieOptions = {
    httpOnly: true,
    // the cookie is not sent with requests that other sites start
    sameSite: 'lax',
    // https only, once deployed; localhost is plain http
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TOKEN_LIFETIME_SECONDS * 1000
};
