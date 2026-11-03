/**
 * index.ts
 *
 * THE CONTRACT between the client and the server: the exact shape of every
 * Data Transfer Object that crosses the network, and the few rules both sides
 * have to agree on. The server's DTO functions promise to return these types
 * and the client's api.ts promises to receive them, so if one side changes a
 * field, the other side stops compiling instead of quietly breaking.
 */

export type Priority = 'High' | 'Medium' | 'Low';

/** most urgent first, which is the order the item modal offers them in */
export const PRIORITIES: readonly Priority[] = ['High', 'Medium', 'Low'];

export const DEFAULT_LIST_NAME = 'Untitled List';
export const MAX_NAME_LENGTH = 60;
export const MAX_DESCRIPTION_LENGTH = 200;

export const MIN_PASSWORD_LENGTH = 8;

/** the avatar images the server accepts, and how large they may be */
export const AVATAR_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_AVATAR_BYTES = 1024 * 1024;

/** one row of a list. Dates are YYYY-MM-DD strings. */
export interface ItemDTO {
    id: string;
    description: string;
    dateEntered: string;
    priority: Priority;
    targetDate: string | null;
    completed: boolean;
}

/** a whole list, sent only when it is opened for editing */
export interface ListDTO {
    id: string;
    name: string;
    items: ItemDTO[];
}

/** all the home screen needs to draw one card, never the items themselves */
export interface ListMetadata {
    id: string;
    name: string;
    itemCount: number;
    completedCount: number;
}

/** the logged in user. avatarUrl is null until they upload one. */
export interface UserDTO {
    id: string;
    email: string;
    avatarUrl: string | null;
}

/** every error the server sends has this body */
export interface ErrorBody {
    error: string;
}
