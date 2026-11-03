/**
 * listItem.ts
 *
 * One row inside a Wolfie List. An item is a plain ItemDTO, the same type the
 * server sends:
 *
 *     { id, description, dateEntered, priority, targetDate, completed }
 *
 * Nothing here ever changes an item. To edit one, build a new object carrying
 * the same id, i.e. { ...item, ...newValues }.
 */
import type { ItemDTO } from '@wolfie-lists/shared';
import { IdGenerator } from '@/lib/IdGenerator';
import { DateUtil } from '@/lib/DateUtil';

/** everything about an item but its id, i.e. what the item modal edits */
export type ItemValues = Omit<ItemDTO, 'id'>;

/** @param values any of the item's fields, the rest get defaults */
export function createListItem(values: Partial<ItemValues> = {}): ItemDTO {
    return {
        id: IdGenerator.next('item'),
        description: '',
        dateEntered: DateUtil.today(),
        priority: 'Low',
        targetDate: null,
        completed: false,
        ...values
    };
}

export function itemValues(item: ItemDTO): ItemValues {
    const { id: _id, ...values } = item;
    return values;
}

/** @returns true if the two sets of values match field for field */
export function valuesAreEqual(oldValues: ItemValues, newValues: ItemValues): boolean {
    const fields = Object.keys({ ...oldValues, ...newValues }) as (keyof ItemValues)[];
    return fields.every((field) => oldValues[field] === newValues[field]);
}

/** @returns a copy of the item with an id of its own */
export function cloneItem(item: ItemDTO): ItemDTO {
    return { ...item, id: IdGenerator.next('item') };
}
