/**
 * avatarFile.test.ts
 *
 * The browser's copy of the server's avatar rules: an image of the right type,
 * under 1 MB.
 */
import { describe, expect, it } from 'vitest';
import { MAX_AVATAR_BYTES } from '@wolfie-lists/shared';
import { avatarFileProblem } from '@/lib/avatarFile';

/** a file of this type and size; only its size and type are ever looked at */
function fileOf(type: string, size = 1000) {
    return new File([new Uint8Array(size)], 'avatar', { type });
}

describe('avatarFileProblem', () => {
    it.each(['image/png', 'image/jpeg', 'image/webp'])('accepts a small %s', (type) => {
        expect(avatarFileProblem(fileOf(type))).toBeNull();
    });

    it.each(['image/gif', 'image/svg+xml', 'application/pdf', ''])('refuses a file of type "%s"', (type) => {
        expect(avatarFileProblem(fileOf(type))).toBe('An avatar must be a PNG, JPEG or WebP image.');
    });

    it('accepts an image of exactly the largest size allowed', () => {
        expect(avatarFileProblem(fileOf('image/png', MAX_AVATAR_BYTES))).toBeNull();
    });

    it('refuses an image one byte too large', () => {
        expect(avatarFileProblem(fileOf('image/png', MAX_AVATAR_BYTES + 1)))
            .toBe('An avatar must be smaller than 1 MB.');
    });
});
