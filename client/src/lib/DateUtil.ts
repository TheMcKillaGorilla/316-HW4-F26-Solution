/**
 * DateUtil.ts
 *
 * Dates are stored as plain YYYY-MM-DD strings, which is exactly what an
 * <input type="date"> uses and what the server stores.
 *
 * Beware the classic bug this avoids: Date.toISOString() converts to UTC
 * first, so on the east coast anything after 8pm reports tomorrow's date. We
 * build the string from the local fields instead.
 */
export class DateUtil {
    /** @returns the date as YYYY-MM-DD in the user's own time zone */
    static toISODate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /** @returns today, as YYYY-MM-DD, in local time */
    static today(): string {
        return DateUtil.toISODate(new Date());
    }

    /**
     * @param isoDate a YYYY-MM-DD string, or null
     * @param whenEmpty what to show when there is no date at all
     * @returns the date formatted for display, i.e. 08/20/2026
     */
    static format(isoDate: string | null | undefined, whenEmpty = '—'): string {
        if (!DateUtil.isValid(isoDate)) return whenEmpty;
        const [year, month, day] = isoDate.split('-');
        return `${month}/${day}/${year}`;
    }

    /** @returns true if this is a well formed YYYY-MM-DD string */
    static isValid(value: unknown): value is string {
        return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    }
}
