/**
 * app.ts
 *
 * Builds the Express application without starting it. server.ts starts it for
 * real, and the tests hand it straight to supertest, which is why building and
 * listening are kept apart.
 *
 * CHAIN OF RESPONSIBILITY
 * -----------------------
 * Every request travels down the app.use() calls below, in order. Each link
 * either answers the request or calls next() to hand it on:
 *
 *   requestLogger    notes the request, always passes it on
 *   express.json()   turns a JSON body into req.body, or passes on an error
 *   cookieParser()   turns the Cookie header into req.cookies
 *   /api/auth        register, log in and log out, open to anybody
 *   authenticate     stops any request without a valid token with a 401
 *   /api/users       the logged in user's own account
 *   /api/lists       the logged in user's own lists
 *   notFound         reached only if nothing above answered
 *   errorHandler     reached whenever anything above passed on an error
 *
 * The order is the behavior. Everything mounted after authenticate is
 * protected simply by being after it; move /api/lists above it and every
 * user's lists are open to the world.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes';
import listRoutes from './routes/listRoutes';
import userRoutes from './routes/userRoutes';
import { authenticate } from './middleware/authenticate';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFound } from './middleware/errorHandlers';

export function createApp({ logRequests = true } = {}) {
    const app = express();

    if (logRequests) app.use(requestLogger);
    app.use(express.json());
    app.use(cookieParser());

    app.use('/api/auth', authRoutes);

    app.use('/api', authenticate);
    app.use('/api/users', userRoutes);
    app.use('/api/lists', listRoutes);

    app.use(notFound);
    app.use(errorHandler);

    return app;
}
