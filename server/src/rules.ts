/**
 * rules.ts
 *
 * What makes a list valid, checked before anything is written. In HW3 the
 * Mongoose schema did this. PostgreSQL's CHECK constraints (see migrations/)
 * enforce the same rules, but their error messages are written for database
 * administrators, so the server checks first and says what is wrong in words
 * a user can act on.
 */
import { randomUUID } from 'node:crypto';
import {
    DEFAULT_LIST_NAME, MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH, PRIORITIES, type ItemDTO, type Priority
} from '@wolfie-lists/shared';
import { HttpError } from './middleware/errorHandlers';

export { DEFAULT_LIST_NAME };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** what a list may be saved as: a name and its items, in order */
export interface ListChanges {
    name: string;
    items: ItemDTO[];
}

/**
 * Only the fields a client is allowed to change, each one checked. Anything
 * else in the body, like a position, an id or an owner, is never read.
 *
 * @throws HttpError 400 naming the first thing that is wrong
 */
export function validateList(body: unknown): ListChanges {
    const { name, items } = (body ?? {}) as { name?: unknown; items?: unknown };
    if (typeof name !== 'string' || !Array.isArray(items)) {
        throw new HttpError(400, 'A list needs a name and an array of items.');
    }
    const trimmed = name.trim();
    if (trimmed === '' || trimmed.length > MAX_NAME_LENGTH) {
        throw new HttpError(400, `A list name must be 1 to ${MAX_NAME_LENGTH} characters long.`);
    }
    const checked = items.map((item, index) => validateItem(item, index));
    if (new Set(checked.map((item) => item.id)).size !== checked.length) {
        throw new HttpError(400, 'Two items in a list cannot have the same id.');
    }
    return { name: trimmed, items: checked };
}

function validateItem(value: unknown, index: number): ItemDTO {
    const item = (value ?? {}) as Record<string, unknown>;
    const problem = (field: string, rule: string) =>
        new HttpError(400, `Item ${index + 1}: ${field} ${rule}.`);

    if (typeof item.id !== 'string' || item.id === '') throw problem('id', 'is required');
    const description = typeof item.description === 'string' ? item.description.trim() : '';
    if (description === '' || description.length > MAX_DESCRIPTION_LENGTH) {
        throw problem('description', `must be 1 to ${MAX_DESCRIPTION_LENGTH} characters long`);
    }
    if (typeof item.dateEntered !== 'string' || !ISO_DATE.test(item.dateEntered)) {
        throw problem('dateEntered', 'must be a date written YYYY-MM-DD');
    }
    const priority = item.priority ?? 'Low';
    if (!PRIORITIES.includes(priority as Priority)) {
        throw problem('priority', `must be one of ${PRIORITIES.join(', ')}`);
    }
    const targetDate = item.targetDate ?? null;
    if (targetDate !== null && (typeof targetDate !== 'string' || !ISO_DATE.test(targetDate))) {
        throw problem('targetDate', 'must be a date written YYYY-MM-DD, or null');
    }

    return {
        id: item.id,
        description,
        dateEntered: item.dateEntered,
        priority: priority as Priority,
        targetDate,
        completed: item.completed === true
    };
}

/** @returns a new item id, in the same form the client makes them */
export function newItemId(): string {
    return `item-${randomUUID()}`;
}

/**
 * @returns desiredName if it is not taken, otherwise the first of
 * "desiredName 2", "desiredName 3" and so on that is free
 */
export function buildUnusedName(takenNames: string[], desiredName: string): string {
    const taken = new Set(takenNames);
    let name = desiredName;
    for (let counter = 2; taken.has(name); counter++) {
        name = `${desiredName} ${counter}`;
    }
    return name;
}

/** a well formed UUID; anything else in a URL cannot name a list */
export function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
