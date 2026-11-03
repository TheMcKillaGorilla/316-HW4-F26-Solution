/**
 * authenticate.ts
 *
 * The gatekeeper, and the newest link in the CHAIN OF RESPONSIBILITY. Every
 * route that belongs to a user is mounted behind it (see app.ts), so a request
 * reaches those controllers only if it carries a valid token. Otherwise the
 * chain stops right here with a 401, and the controller never runs.
 *
 * A request that gets through carries req.userId, and that, never anything the
 * client sends in a body or URL, is who the controllers act for.
 */
import type { NextFunction, Request, Response } from 'express';
import { TOKEN_COOKIE, verifyToken } from '../auth/tokens';
import { HttpError } from './errorHandlers';

export function authenticate(req: Request, _res: Response, next: NextFunction) {
    const token: unknown = req.cookies?.[TOKEN_COOKIE];
    const userId = typeof token === 'string' ? verifyToken(token) : null;

    if (userId === null) {
        next(new HttpError(401, 'You need to log in first.'));
        return;
    }
    req.userId = userId;
    next();
}

/**
 * For the controllers behind authenticate: the logged in user's id. It throws
 * only if a route was mounted without authenticate, which is a bug in app.ts.
 */
export function currentUserId(req: Request): string {
    if (req.userId === undefined) throw new HttpError(401, 'You need to log in first.');
    return req.userId;
}
