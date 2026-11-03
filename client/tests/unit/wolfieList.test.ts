/**
 * wolfieList.test.ts
 *
 * The list model on its own, with no React. Every write function is also
 * checked to leave the list it was given alone, because a list changed in
 * place is the one mistake that stops React redrawing, and the one that
 * would quietly corrupt every snapshot in the undo history.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_LIST_NAME, MAX_NAME_LENGTH, type ListDTO } from '@wolfie-lists/shared';
import {
    addItem,
    moveItem,
    normalizeListName,
    removeItemAt,
    replaceItemAt,
    withName
} from '@/model/wolfieList';
import { createListItem } from '@/model/listItem';

/** a list of items described 'a', 'b', 'c' ... */
function listOf(...descriptions: string[]): ListDTO {
    return {
        id: 'list-letters',
        name: 'Letters',
        items: descriptions.map((description) => createListItem({ description }))
    };
}

function descriptionsOf(list: ListDTO) {
    return list.items.map((item) => item.description);
}

/** runs change, then checks it produced a new list and left the old one alone */
function expectUnchanged(list: ListDTO, change: (list: ListDTO) => ListDTO) {
    const before = JSON.stringify(list);
    const itemsBefore = list.items;
    const after = change(list);

    expect(after).not.toBe(list);
    expect(list.items).toBe(itemsBefore);
    expect(JSON.stringify(list)).toBe(before);
    return after;
}

describe('normalizeListName', () => {
    it('trims surrounding whitespace', () => {
        expect(normalizeListName('  Chores  ')).toBe('Chores');
    });

    it('falls back to the default name when nothing is left', () => {
        expect(normalizeListName('   ')).toBe(DEFAULT_LIST_NAME);
    });

    it('cuts a name that is too long down to the limit', () => {
        expect(normalizeListName('x'.repeat(MAX_NAME_LENGTH + 10))).toHaveLength(MAX_NAME_LENGTH);
    });
});

describe('addItem', () => {
    it('adds at the end by default', () => {
        const list = expectUnchanged(listOf('a', 'b'), (l) => addItem(l, createListItem({ description: 'c' })));
        expect(descriptionsOf(list)).toEqual(['a', 'b', 'c']);
    });

    it('adds at a given index', () => {
        const list = addItem(listOf('a', 'c'), createListItem({ description: 'b' }), 1);
        expect(descriptionsOf(list)).toEqual(['a', 'b', 'c']);
    });

    it('keeps the list id and name', () => {
        const original = listOf('a');
        const list = addItem(original, createListItem());
        expect(list.id).toBe(original.id);
        expect(list.name).toBe(original.name);
    });
});

describe('removeItemAt', () => {
    it('removes the item at that index', () => {
        const list = expectUnchanged(listOf('a', 'b', 'c'), (l) => removeItemAt(l, 1));
        expect(descriptionsOf(list)).toEqual(['a', 'c']);
    });
});

describe('replaceItemAt', () => {
    it('swaps one item for another and leaves the rest alone', () => {
        const original = listOf('a', 'b', 'c');
        const replacement = { ...original.items[1], description: 'B' };
        const list = expectUnchanged(original, (l) => replaceItemAt(l, 1, replacement));

        expect(descriptionsOf(list)).toEqual(['a', 'B', 'c']);
        expect(list.items[0]).toBe(original.items[0]);
        expect(list.items[1].id).toBe(original.items[1].id);
    });
});

describe('moveItem', () => {
    it('moves an item forwards', () => {
        const list = expectUnchanged(listOf('a', 'b', 'c', 'd'), (l) => moveItem(l, 0, 2));
        expect(descriptionsOf(list)).toEqual(['b', 'c', 'a', 'd']);
    });

    it('moves an item backwards', () => {
        expect(descriptionsOf(moveItem(listOf('a', 'b', 'c', 'd'), 3, 1))).toEqual(['a', 'd', 'b', 'c']);
    });

    it('is its own inverse, for every pair of positions', () => {
        const original = listOf('a', 'b', 'c', 'd');
        for (let from = 0; from < 4; from++) {
            for (let to = 0; to < 4; to++) {
                const there = moveItem(original, from, to);
                expect(moveItem(there, to, from).items).toEqual(original.items);
            }
        }
    });
});

describe('withName', () => {
    it('renames the list and keeps its id and items', () => {
        const original = listOf('a');
        const list = expectUnchanged(original, (l) => withName(l, 'Renamed'));

        expect(list.name).toBe('Renamed');
        expect(list.id).toBe(original.id);
        expect(list.items).toBe(original.items);
    });
});

