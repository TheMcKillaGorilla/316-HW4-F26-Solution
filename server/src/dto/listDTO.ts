/**
 * listDTO.ts
 *
 * DATA TRANSFER OBJECTS: the exact shapes that cross the network, and nothing
 * else. A row from the database carries owner_id, position and timestamps,
 * in snake_case, none of which the client should see or depend on. These
 * functions decide what goes out. (What comes in is checked by rules.ts.)
 *
 * The shapes themselves are declared once, in the shared workspace, so the
 * client is compiled against the very same types these functions return.
 */
import type { ItemDTO, ListDTO, ListMetadata, Priority } from '@wolfie-lists/shared';

/** one row of the home screen query in listController.getAllMetadata */
export interface MetadataRow {
    id: string;
    name: string;
    item_count: number;
    completed_count: number;
}

/** one row of the items table */
export interface ItemRow {
    id: string;
    description: string;
    date_entered: string;
    priority: string;
    target_date: string | null;
    completed: boolean;
}

/** what the home screen needs to draw one card */
export function toMetadata(row: MetadataRow): ListMetadata {
    return {
        id: row.id,
        name: row.name,
        // count() is a bigint in PostgreSQL, which pg hands over as a string
        itemCount: Number(row.item_count),
        completedCount: Number(row.completed_count)
    };
}

/** the whole list, for editing */
export function toListJSON(list: { id: string; name: string }, items: ItemRow[]): ListDTO {
    return { id: list.id, name: list.name, items: items.map(toItemJSON) };
}

export function toItemJSON(row: ItemRow): ItemDTO {
    return {
        id: row.id,
        description: row.description,
        dateEntered: row.date_entered,
        priority: row.priority as Priority,
        targetDate: row.target_date,
        completed: row.completed
    };
}
