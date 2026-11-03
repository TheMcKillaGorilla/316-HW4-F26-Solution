/**
 * IdGenerator.ts
 *
 * Makes ids for new items. They have to be unique before the server has seen
 * them, and not collide with ids made in another tab.
 */
export class IdGenerator {
    /**
     * @param prefix a short tag so that ids stay readable while debugging
     * @returns a brand new unique id
     */
    static next(prefix = 'id'): string {
        if (globalThis.crypto?.randomUUID) {
            return `${prefix}-${globalThis.crypto.randomUUID()}`;
        }
        // fallback for the rare browser without crypto.randomUUID
        const random = Math.random().toString(36).slice(2, 10);
        return `${prefix}-${Date.now().toString(36)}-${random}`;
    }
}
