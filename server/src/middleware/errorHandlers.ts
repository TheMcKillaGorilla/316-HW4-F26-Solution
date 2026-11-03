/**
 * errorHandlers.ts
 *
 * The last two links in the middleware chain (see app.ts).
 *
 * Every controller is free to simply throw. Express 5 catches the error, even
 * from an async function, skips every remaining ordinary middleware, and hands
 * it to the first middleware that takes four parameters. That is errorHandler,
 * which is the one place an error becomes an HTTP response.
 */
import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import type { ErrorBody } from '@wolfie-lists/shared';

/** an error that already knows which status code it means */
export class HttpError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

/** reached only when no route matched */
export function notFound(req: Request, res: Response, next: NextFunction) {
    next(new HttpError(404, `There is no ${req.method} ${req.originalUrl}`));
}

/**
 * Express recognizes an error handler by its four parameters, so next has to
 * stay in the list even though it is never called.
 */
export function errorHandler(error: unknown, req: Request, res: Response<ErrorBody>, _next: NextFunction) {
    let status = 500;
    let message = error instanceof Error ? error.message : String(error);

    if (error instanceof HttpError) {
        status = error.status;
    } else if (error instanceof MulterError) {
        // the upload was too large, or not where the form said it would be
        status = 400;
        if (error.code === 'LIMIT_FILE_SIZE') message = 'An avatar must be smaller than 1 MB.';
    } else if (isDatabaseError(error, CHECK_VIOLATION) || isDatabaseError(error, BAD_VALUE)) {
        // a value got past rules.ts that PostgreSQL itself refused
        status = 400;
    } else if (isDatabaseError(error, UNIQUE_VIOLATION)) {
        // two requests raced to make the same account
        status = 409;
        message = 'That already exists.';
    } else if (isBadJson(error)) {
        status = 400;
        message = 'The request body is not valid JSON.';
    }

    if (status >= 500) {
        // log the details here, and do not show them to the client
        console.error(error);
        message = 'Something went wrong on the server.';
    }

    res.status(status).json({ error: message });
}

// PostgreSQL names every kind of error with a five character code, and the
// first two say what class of error it is
const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';
const BAD_VALUE = '22';   // the whole class, i.e. February 30th

function isDatabaseError(error: unknown, code: string): boolean {
    const actual = (error as { code?: unknown })?.code;
    return typeof actual === 'string' && actual.startsWith(code);
}

/** express.json() marks a body it could not parse with a status of 400 */
function isBadJson(error: unknown): boolean {
    return error instanceof SyntaxError && (error as { status?: number }).status === 400;
}
