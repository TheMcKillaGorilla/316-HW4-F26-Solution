/**
 * passwords.ts
 *
 * Passwords are never stored, and never stored encrypted either, because
 * whatever can be decrypted can be stolen. bcrypt turns a password into a
 * one-way HASH, and the only thing anyone can do with a hash is check whether
 * a password matches it.
 *
 * Two things make bcrypt right for passwords where a fast hash like SHA-256 is
 * not. It is SALTED: a random salt is mixed in and stored inside the hash, so
 * two users with the same password get different hashes. And it is SLOW on
 * purpose (BCRYPT_ROUNDS), so guessing billions of passwords takes years.
 */
import bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from '../config';

export function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** bcrypt reads the salt back out of the hash and hashes the attempt the same way */
export function passwordMatches(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}
