/**
 * config.ts
 *
 * Every setting the server reads from its environment, in one place. They come
 * from server/.env (copy .env.example to make one).
 */
import 'dotenv/config';

export const PORT = Number(process.env.PORT) || 4000;

/** postgres://user:password@host:port/database */
export const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/wolfie_lists';

/**
 * The key every token is signed with. Anyone who knows it can make a token for
 * any user, so the real one lives only in .env and is never committed. The
 * fallback is for the tests, which must not need a .env.
 */
export const JWT_SECRET = process.env.JWT_SECRET ?? 'development-only-secret-do-not-deploy';

/** how long a login lasts */
export const TOKEN_LIFETIME_SECONDS = 24 * 60 * 60;

/** bcrypt's cost: each step up doubles the time it takes to hash, or to guess */
export const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;
