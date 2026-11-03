/**
 * rules.test.ts
 *
 * What makes a list valid, and the naming helpers. These run before anything
 * is written, so none of this needs a database.
 */
import { describe, expect, it } from 'vitest';
import { buildUnusedName, isUuid, newItemId, validateList } from '../../src/rules';
import { HttpError } from '../../src/middleware/errorHandlers';
import { WEEKEND_LIST } from '../helpers/fixtures';

/** @returns the message validateList refuses with, or null if it accepts */
function refusal(body: unknown): string | null {
    try {
        validateList(body);
        return null;
    } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).status).toBe(400);
        return (error as HttpError).message;
    }
}

describe('validateList accepts', () => {
    it('a valid list, unchanged', () => {
        expect(validateList(WEEKEND_LIST)).toEqual(WEEKEND_LIST);
    });

    it('a list with no items', () => {
        expect(validateList({ name: 'Empty', items: [] })).toEqual({ name: 'Empty', items: [] });
    });

    it('an item with only the required fields, filling in the rest', () => {
        const { items } = validateList({
            name: 'Defaults',
            items: [{ id: 'item-a', description: 'Something', dateEntered: '2026-09-01' }]
        });
        expect(items[0]).toMatchObject({ priority: 'Low', targetDate: null, completed: false });
    });

    it('and trims the name and descriptions', () => {
        const { name, items } = validateList({ name: '  Spaced  ', items: [{ ...WEEKEND_LIST.items[0], description: ' x ' }] });
        expect(name).toBe('Spaced');
        expect(items[0].description).toBe('x');
    });
});

describe('validateList drops', () => {
    it('anything a client is not allowed to set', () => {
        const changes = validateList({ ...WEEKEND_LIST, id: 'x', owner_id: 'x', position: 99 });
        expect(Object.keys(changes).sort()).toEqual(['items', 'name']);
    });

    it('unknown fields on items too', () => {
        const items = [{ ...WEEKEND_LIST.items[0], color: 'blue' }];
        expect(validateList({ name: 'x', items }).items[0]).not.toHaveProperty('color');
    });
});

describe('validateList refuses', () => {
    it.each([
        ['no body', undefined],
        ['no name', { items: [] }],
        ['no items', { name: 'x' }],
        ['items that are not an array', { name: 'x', items: 'lots' }]
    ])('%s', (_, body) => {
        expect(refusal(body)).toMatch(/name and an array of items/);
    });

    it('a blank name', () => {
        expect(refusal({ name: '   ', items: [] })).toMatch(/name/);
    });

    it('a name longer than 60 characters', () => {
        expect(refusal({ name: 'x'.repeat(61), items: [] })).toMatch(/60/);
    });

    it.each([
        ['an item with no description', { description: '  ' }, /description/],
        ['an unknown priority', { priority: 'Urgent' }, /priority/],
        ['a malformed date entered', { dateEntered: '09/01/2026' }, /dateEntered/],
        ['a malformed target date', { targetDate: 'tomorrow' }, /targetDate/],
        ['an item with no id', { id: undefined }, /id/]
    ])('%s, saying which item and which field', (_, change, field) => {
        const message = refusal({ name: 'Bad', items: [{ ...WEEKEND_LIST.items[0], ...change }] });
        expect(message).toMatch(/^Item 1/);
        expect(message).toMatch(field);
    });

    it('two items with the same id', () => {
        const item = WEEKEND_LIST.items[0];
        expect(refusal({ name: 'Twins', items: [item, item] })).toMatch(/same id/);
    });
});

describe('buildUnusedName', () => {
    it('keeps the name when nobody has it', () => {
        expect(buildUnusedName(['Chores'], 'Untitled List')).toBe('Untitled List');
    });

    it('counts up from 2 until it finds a free name', () => {
        expect(buildUnusedName(['Untitled List', 'Untitled List 2'], 'Untitled List'))
            .toBe('Untitled List 3');
    });
});

describe('newItemId', () => {
    it('makes a different id every time, in the form the client uses', () => {
        const first = newItemId();
        expect(first).toMatch(/^item-/);
        expect(newItemId()).not.toBe(first);
    });
});

describe('isUuid', () => {
    it('knows a uuid from anything else', () => {
        expect(isUuid('6f0c8a2e-1111-4222-8333-444455556666')).toBe(true);
        expect(isUuid('not-an-id')).toBe(false);
        expect(isUuid("1'; DROP TABLE lists; --")).toBe(false);
    });
});
