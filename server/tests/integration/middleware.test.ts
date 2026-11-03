/**
 * middleware.test.ts
 *
 * The parts of the chain that do not need a database: logging, the order of
 * the links, malformed JSON, and what the error handler turns each kind of
 * error into.
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { errorHandler, HttpError } from '../../src/middleware/errorHandlers';

describe('the request logger', () => {
    it('logs the method, url and status once the response is finished', async () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});

        await request(createApp()).get('/nowhere');

        expect(log).toHaveBeenCalledWith(expect.stringMatching(/^GET \/nowhere 404 \d+ms$/));
    });

    it('can be switched off', async () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});

        await request(createApp({ logRequests: false })).get('/api/nowhere');

        expect(log).not.toHaveBeenCalled();
    });
});

describe('the end of the chain', () => {
    const app = createApp({ logRequests: false });

    it('answers a URL outside the API with a 404 and a JSON error', async () => {
        const response = await request(app).get('/nowhere');

        expect(response.status).toBe(404);
        expect(response.body.error).toMatch(/GET \/nowhere/);
    });

    it('stops anything after authenticate, even an unknown route, with a 401 first', async () => {
        // authenticate comes before notFound in the chain, so without a login
        // nobody can even find out which routes exist
        expect((await request(app).get('/api/nowhere')).status).toBe(401);
    });

    it('answers malformed JSON with a 400', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .set('Content-Type', 'application/json')
            .send('{ not json');

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/JSON/);
    });
});

describe('the error handler', () => {
    /** a tiny app whose one route throws whatever it is given */
    function appThatThrows(error: unknown) {
        const app = express();
        app.get('/', () => { throw error; });
        app.use(errorHandler);
        return app;
    }

    it('uses the status an HttpError carries', async () => {
        const response = await request(appThatThrows(new HttpError(409, 'Taken'))).get('/');
        expect(response.status).toBe(409);
        expect(response.body).toEqual({ error: 'Taken' });
    });

    it('hides the details of an unexpected error', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const response = await request(appThatThrows(new Error('secret stack details'))).get('/');

        expect(response.status).toBe(500);
        expect(response.body.error).not.toMatch(/secret/);
    });

    it('logs an unexpected error on the server', async () => {
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
        await request(appThatThrows(new Error('boom'))).get('/');
        expect(logged).toHaveBeenCalled();
    });

    it('catches errors thrown by async handlers too, which Express 5 passes on', async () => {
        const app = express();
        app.get('/', async () => { throw new HttpError(418, 'Short and stout'); });
        app.use(errorHandler);

        expect((await request(app).get('/')).status).toBe(418);
    });
});
