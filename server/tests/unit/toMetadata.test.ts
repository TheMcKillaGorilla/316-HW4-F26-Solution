/**
 * toMetadata.test.ts
 *
 * toMetadata turns one row of the home screen query into the four fields the
 * home screen draws a card from. It is a pure function, so a test is three
 * steps: make a row, call toMetadata, check what came back. No database is
 * needed.
 */
import { describe, expect, it } from 'vitest';
import { toMetadata, type MetadataRow } from '../../src/dto/listDTO';

/** a row as pg hands it back: count() arrives as a string, since it is a bigint */
const row = (values: Partial<MetadataRow> = {}): MetadataRow => ({
    id: '6f0c8a2e-1111-4222-8333-444455556666',
    name: "Wolfie's Weekend",
    item_count: '3' as unknown as number,
    completed_count: '1' as unknown as number,
    ...values
});

describe('toMetadata', () => {
    it('has exactly the fields id, name, itemCount and completedCount', () => {
        expect(Object.keys(toMetadata(row())).sort())
            .toEqual(['completedCount', 'id', 'itemCount', 'name']);
    });

    it('renames the snake_case columns to the camelCase the client uses', () => {
        expect(toMetadata(row())).toEqual({
            id: '6f0c8a2e-1111-4222-8333-444455556666',
            name: "Wolfie's Weekend",
            itemCount: 3,
            completedCount: 1
        });
    });

    it('turns the counts into numbers, which pg sends as strings', () => {
        const { itemCount, completedCount } = toMetadata(row());
        expect(typeof itemCount).toBe('number');
        expect(typeof completedCount).toBe('number');
    });

    it('answers 0 and 0 for a list with no items', () => {
        expect(toMetadata(row({ item_count: 0, completed_count: 0 })))
            .toMatchObject({ itemCount: 0, completedCount: 0 });
    });
});
