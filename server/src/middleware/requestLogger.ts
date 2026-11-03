/**
 * requestLogger.ts
 *
 * Prints one line per request, i.e. "PUT /api/lists/66f0... 200 12ms".
 *
 * Two patterns in a few lines. As middleware it is a link in the chain: it
 * does its part and calls next() to pass the request along. And it cannot know
 * the status code yet, because no response exists at that moment, so it
 * subscribes to the response's 'finish' event instead (res is a Node
 * EventEmitter). That is the Observer pattern.
 */
import type { NextFunction, Request, Response } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
    const start = performance.now();
    res.on('finish', () => {
        const ms = Math.round(performance.now() - start);
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
    });
    next();
}
