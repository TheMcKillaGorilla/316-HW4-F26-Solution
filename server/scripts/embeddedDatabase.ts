/**
 * embeddedDatabase.ts
 *
 * A real PostgreSQL server, private to the tests. The embedded-postgres
 * package ships the actual PostgreSQL programs through npm; this uses them to
 * make a database cluster in a throwaway folder, run it on a port of its own,
 * and delete it all afterwards. Your own wolfie_lists database is never
 * touched.
 *
 * Starting and stopping go through pg_ctl, PostgreSQL's own control program,
 * rather than embedded-postgres's start() and stop(). On Windows its stop()
 * kills the main server process outright, which can leave one of its helper
 * processes behind still holding the port, so the next run cannot start.
 * pg_ctl stop asks PostgreSQL to shut everything down properly.
 *
 * Used by the server tests (tests/globalSetup.ts) and the end to end tests
 * (scripts/e2e-server.ts).
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const USER = 'postgres';
const PASSWORD = 'postgres';

/**
 * Runs pg_ctl and waits for it to finish. Its output is ignored rather than
 * collected: pg_ctl start hands its output on to the server it starts, which
 * keeps running, so waiting for that output to end would wait forever.
 */
function run(pgCtl: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        spawn(pgCtl, args, { stdio: 'ignore' })
            .on('error', reject)
            .on('exit', (code) => code === 0 ? resolve() : reject(new Error(`pg_ctl ${args[0]} failed (${code})`)));
    });
}

/** @returns the server's address, and how to stop it */
export async function startEmbeddedDatabase(port: number) {
    const databaseDir = mkdtempSync(path.join(os.tmpdir(), 'wolfie-lists-pg-'));

    // embedded-postgres runs initdb, which makes the cluster's files
    await new EmbeddedPostgres({
        databaseDir,
        port,
        user: USER,
        password: PASSWORD,
        // UTF-8, so a list can be named in any language or with an emoji. On
        // Windows PostgreSQL would otherwise pick the old WIN1252 encoding
        initdbFlags: ['--encoding=UTF8', '--locale=C'],
        onLog: () => {}
    }).initialise();

    const pgCtl = await pgCtlPath();
    // -w waits until the server accepts connections; -l is where its log goes
    await run(pgCtl, ['start', '-D', databaseDir, '-o', `-p ${port}`, '-l', path.join(databaseDir, 'server.log'), '-w']);

    return {
        /** the address of a database on it, i.e. url('test_1234') */
        url: (database = 'postgres') => `postgres://${USER}:${PASSWORD}@localhost:${port}/${database}`,
        /** shuts the server down cleanly, waits until it has, and deletes its files */
        async stop() {
            await run(pgCtl, ['stop', '-D', databaseDir, '-m', 'fast', '-w']);
            await rm(databaseDir, { recursive: true, force: true });
        }
    };
}

/**
 * embedded-postgres keeps the programs in a package per platform, i.e.
 * @embedded-postgres/windows-x64, and each one exports pg_ctl's path.
 */
async function pgCtlPath(): Promise<string> {
    const platform = os.platform() === 'win32' ? 'windows' : os.platform();
    const binaries = await import(`@embedded-postgres/${platform}-${os.arch()}`) as { pg_ctl: string };
    return binaries.pg_ctl;
}
