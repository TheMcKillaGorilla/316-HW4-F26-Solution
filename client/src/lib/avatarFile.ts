/**
 * avatarFile.ts
 *
 * The same rules the server enforces (see shared/), checked in the browser
 * first so a user hears about a 5 MB photo before waiting for it to upload.
 * The server still checks, since anybody can send it anything.
 */
import { AVATAR_TYPES, MAX_AVATAR_BYTES } from '@wolfie-lists/shared';

/** @returns what is wrong with the file, or null if it will do */
export function avatarFileProblem(file: File): string | null {
    if (!AVATAR_TYPES.includes(file.type)) return 'An avatar must be a PNG, JPEG or WebP image.';
    if (file.size > MAX_AVATAR_BYTES) return 'An avatar must be smaller than 1 MB.';
    return null;
}
