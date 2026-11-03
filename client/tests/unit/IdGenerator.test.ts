/**
 * IdGenerator.test.ts
 *
 * Ids have to be unique, readable while debugging, and produced even on a
 * browser without crypto.randomUUID.
 *
 * An id is also a React key, and two items sharing one produces a warning and,
 * worse, a card that keeps the wrong state when the list is reordered.
 */
import { describe, expect, it, vi } from 'vitest';
import { IdGenerator } from '@/lib/IdGenerator';

describe('next', () => {
    it('starts with the prefix it was given', () => {
        expect(IdGenerator.next('item')).toMatch(/^item-/);
        expect(IdGenerator.next('list')).toMatch(/^list-/);
    });

    it('uses a generic prefix when not given one', () => {
        expect(IdGenerator.next()).toMatch(/^id-/);
    });

    it('never produces the same id twice', () => {
        const ids = new Set<string>();
        for (let index = 0; index < 2000; index++) {
            ids.add(IdGenerator.next('item'));
        }
        expect(ids.size).toBe(2000);
    });

    it('uses crypto.randomUUID when the browser has it', () => {
        const randomUUID = vi.fn(() => '11111111-2222-3333-4444-555555555555');
        vi.stubGlobal('crypto', { randomUUID });

        expect(IdGenerator.next('item')).toBe('item-11111111-2222-3333-4444-555555555555');
        expect(randomUUID).toHaveBeenCalled();
    });

    describe('on a browser without crypto.randomUUID', () => {
        it('still produces an id', () => {
            vi.stubGlobal('crypto', undefined);
            expect(IdGenerator.next('item')).toMatch(/^item-[a-z0-9]+-[a-z0-9]+$/);
        });

        it('still never produces the same id twice', () => {
            vi.stubGlobal('crypto', {});

            const ids = new Set<string>();
            for (let index = 0; index < 2000; index++) {
                ids.add(IdGenerator.next('item'));
            }
            expect(ids.size).toBe(2000);
        });
    });
});
