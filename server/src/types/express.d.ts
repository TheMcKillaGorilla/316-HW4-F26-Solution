/**
 * express.d.ts
 *
 * DECLARATION MERGING: Express's own Request type knows nothing about our
 * users, so we add a field to it. Every Request in this project now has an
 * optional userId, which the authenticate middleware fills in.
 */
declare global {
    namespace Express {
        interface Request {
            /** the logged in user, set by authenticate; undefined on public routes */
            userId?: string;
        }
    }
}

export {};
