/**
 * listDTO.test.ts
 *
 * What crosses the network. These tests are the contract the client is built
 * against: exactly these fields, and nothing of the database's own columns.
 * toMetadata has a file of its own, toMetadata.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { toListJSON, type ItemRow } from '../../src/dto/listDTO';
import { WEEKEND_LIST } from '../helpers/fixtures';

/** the sample items as rows of the items table */
const ROWS: ItemRow[] = WEEKEND_LIST.items.map((item, position) => ({
    list_id: 'a-list',
    position,
    id: item.id,
    description: item.description,
    date_entered: item.dateEntered,
    priority: item.priority,
    target_date: item.targetDate,
    completed: item.completed
}));

const LIST = { id: '6f0c8a2e-1111-4222-8333-444455556666', name: WEEKEND_LIST.name, owner_id: 'someone', position: 3 };

describe('toListJSON', () => {
    it('sends id, name and items, and none of the other columns', () => {
        const json = toListJSON(LIST, ROWS);
        expect(Object.keys(json).sort()).toEqual(['id', 'items', 'name']);
    });

    it('sends every item field in camelCase, and only those', () => {
        expect(toListJSON(LIST, ROWS).items).toEqual(WEEKEND_LIST.items);
    });

    it('sends the items in the order it was given them', () => {
        expect(toListJSON(LIST, ROWS.toReversed()).items.map((item) => item.id))
            .toEqual(WEEKEND_LIST.items.toReversed().map((item) => item.id));
    });
});
