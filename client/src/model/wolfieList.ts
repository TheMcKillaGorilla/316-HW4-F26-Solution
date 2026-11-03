/**
 * wolfieList.ts
 *
 * A single named to-do list, as the client edits it: a plain ListDTO,
 * { id, name, items }.
 *
 * Every function here returns a NEW list rather than changing the one it was
 * given, because React only redraws when it is handed a different object, and
 * because the undo history (useUndoRedo) keeps the old ones as snapshots.
 */
import { DEFAULT_LIST_NAME, MAX_NAME_LENGTH, type ItemDTO, type ListDTO } from '@wolfie-lists/shared';

/** @returns what the user typed, trimmed, shortened and never empty */
export function normalizeListName(name: string): string {
    const trimmed = name.trim();
    return trimmed === '' ? DEFAULT_LIST_NAME : trimmed.slice(0, MAX_NAME_LENGTH);
}

export function addItem(list: ListDTO, item: ItemDTO, index = list.items.length): ListDTO {
    return { ...list, items: list.items.toSpliced(index, 0, item) };
}

export function removeItemAt(list: ListDTO, index: number): ListDTO {
    return { ...list, items: list.items.toSpliced(index, 1) };
}

export function replaceItemAt(list: ListDTO, index: number, item: ItemDTO): ListDTO {
    return { ...list, items: list.items.with(index, item) };
}

export function moveItem(list: ListDTO, fromIndex: number, toIndex: number): ListDTO {
    const moved = list.items[fromIndex];
    return { ...list, items: list.items.toSpliced(fromIndex, 1).toSpliced(toIndex, 0, moved) };
}

export function withName(list: ListDTO, name: string): ListDTO {
    return { ...list, name };
}
