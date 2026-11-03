/**
 * priority.test.ts
 *
 * The priorities now come from the shared workspace, which the client and
 * the server both import, so this also proves the client can reach it.
 */
import { describe, expect, it } from 'vitest';
import { PRIORITIES } from '@wolfie-lists/shared';

describe('PRIORITIES', () => {
    it('lists the three priorities, most urgent first', () => {
        expect(PRIORITIES).toEqual(['High', 'Medium', 'Low']);
    });
});
