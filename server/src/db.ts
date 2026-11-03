/**
 * db.ts
 *
 * The one connection to PostgreSQL, shared by the whole server.
 *
 * A POOL keeps a handful of open connections and lends one to each query, so
 * a request never waits for a new connection to be made, and two requests at
 * once never share one.
 *
 * Every query in this server is PARAMETERIZED: the SQL has $1, $2 where values
 * go, and the values travel separately. Never build SQL by pasting user input
 * into a string. A list named  '); DROP TABLE lists; --  would do exactly
 * what it says. With parameters it is just an odd name.
 */
import pg, { type PoolClient, type QueryResultRow } from 'pg';

// A DATE column comes back as a JavaScript Date by default, at midnight in
// the server's time zone, which is exactly the off-by-one-day bug DateUtil
// warns about. 1082 is PostgreSQL's code for the date type: keep it as the
// YYYY-MM-DD string it already is.
pg.types.setTypeParser(1082, (value) => value);

let pool: pg.Pool | null = null;

export function connectDatabase(connectionString: string) {
    pool = new pg.Pool({ connectionString });
    // a connection that dies while sitting idle in the pool would otherwise
    // be an unhandled error that stops the whole server; the pool replaces it
    pool.on('error', (error) => console.error('PostgreSQL connection lost:', error.message));
}

export async function closeDatabase() {
    await pool?.end();
    pool = null;
}

function currentPool(): pg.Pool {
    if (pool === null) throw new Error('connectDatabase() has not been called');
    return pool;
}

/**
 * Runs one SQL statement. <Row> says what each row will look like, which
 * TypeScript takes on trust: it cannot see inside the SQL.
 */
export async function query<Row extends QueryResultRow>(sql: string, values: unknown[] = []): Promise<Row[]> {
    const result = await currentPool().query<Row>(sql, values);
    return result.rows;
}

/**
 * Runs work as one TRANSACTION: every statement in it happens, or none does.
 * Saving a list deletes its items and inserts the new ones; without a
 * transaction, a failure halfway would leave the list with no items at all.
 *
 * work is given its own client, and must use it rather than query(), because
 * a transaction belongs to one connection.
 */
export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await currentPool().connect();
    try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
