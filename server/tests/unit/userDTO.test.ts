/**
 * userDTO.test.ts
 *
 * What the client is told about a user, and above all what it is not told.
 */
import { describe, expect, it } from 'vitest';
import { toUserJSON, type UserRow } from '../../src/dto/userDTO';

/** a whole row of the users table, including what must never be sent */
const row = (values: Partial<UserRow> = {}) => ({
    id: '6f0c8a2e-1111-4222-8333-444455556666',
    email: 'wolfie@stonybrook.edu',
    password_hash: '$2b$10$secret',
    avatar: Buffer.from('picture'),
    avatar_updated_at: null,
    ...values
});

describe('toUserJSON', () => {
    it('has exactly the fields id, email and avatarUrl', () => {
        expect(Object.keys(toUserJSON(row())).sort()).toEqual(['avatarUrl', 'email', 'id']);
    });

    it('never includes the password hash or the avatar bytes, even when handed them', () => {
        const json = JSON.stringify(toUserJSON(row()));
        expect(json).not.toContain('secret');
        expect(json).not.toContain('picture');
    });

    it('sends a null avatarUrl until an avatar is uploaded', () => {
        expect(toUserJSON(row()).avatarUrl).toBeNull();
    });

    it('sends a URL that changes whenever the avatar does', () => {
        const first = toUserJSON(row({ avatar_updated_at: new Date(1000) })).avatarUrl;
        const second = toUserJSON(row({ avatar_updated_at: new Date(2000) })).avatarUrl;

        expect(first).toBe('/api/users/me/avatar?v=1000');
        expect(second).not.toBe(first);
    });
});
