/**
 * userDTO.ts
 *
 * What the client is told about a user. Above all, what it is NOT told: the
 * password hash never leaves the server, and the avatar goes as a URL to fetch
 * rather than as bytes inside the JSON.
 *
 * The ?v= on the avatar URL changes every time a new avatar is uploaded. To
 * the browser that is a different URL, so it fetches the new image instead of
 * showing the one it cached.
 */
import type { UserDTO } from '@wolfie-lists/shared';

/** the columns of a user row this needs; queries never select more for it */
export interface UserRow {
    id: string;
    email: string;
    avatar_updated_at: Date | null;
}

/** the columns toUserJSON reads, for a SELECT or a RETURNING */
export const USER_COLUMNS = 'id, email, avatar_updated_at';

export function toUserJSON(row: UserRow): UserDTO {
    return {
        id: row.id,
        email: row.email,
        avatarUrl: row.avatar_updated_at
            ? `/api/users/me/avatar?v=${row.avatar_updated_at.getTime()}`
            : null
    };
}
