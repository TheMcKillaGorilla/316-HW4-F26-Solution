/**
 * DateUtil.test.ts
 *
 * THE LOAD BEARING TEST IN THIS FILE is the time zone one at the bottom. It
 * asserts directly that toISOString() would report tomorrow at 11:30pm while
 * DateUtil does not. The zone is pinned to America/New_York in vitest.config.ts
 * so that it proves the same thing on a grader's machine anywhere in the world.
 *
 * That bug is worth understanding rather than merely guarding against. A student
 * who reaches for toISOString().slice(0, 10) — which is the obvious thing to
 * reach for — writes an application that files an evening's work under
 * tomorrow's date, and only ever notices it after 8pm.
 */
import { describe, expect, it } from 'vitest';
import { DateUtil } from '@/lib/DateUtil';

describe('toISODate', () => {
    it('formats a date as YYYY-MM-DD', () => {
        expect(DateUtil.toISODate(new Date(2026, 8, 5))).toBe('2026-09-05');
    });

    it('pads a single digit month and day', () => {
        expect(DateUtil.toISODate(new Date(2026, 0, 1))).toBe('2026-01-01');
    });

    it('handles the last day of a year', () => {
        expect(DateUtil.toISODate(new Date(2026, 11, 31))).toBe('2026-12-31');
    });

    it('handles a leap day', () => {
        expect(DateUtil.toISODate(new Date(2028, 1, 29))).toBe('2028-02-29');
    });
});

describe('today', () => {
    it('agrees with toISODate for the current moment', () => {
        expect(DateUtil.today()).toBe(DateUtil.toISODate(new Date()));
    });

    it('is a well formed date', () => {
        expect(DateUtil.isValid(DateUtil.today())).toBe(true);
    });
});

describe('isValid', () => {
    it.each(['2026-09-05', '2026-01-01', '1999-12-31'])('accepts %s', (value) => {
        expect(DateUtil.isValid(value)).toBe(true);
    });

    it.each([
        ['an American format', '09/05/2026'],
        ['a month with one digit', '2026-9-5'],
        ['prose', 'next tuesday'],
        ['an empty string', ''],
        ['null', null],
        ['undefined', undefined],
        ['a number', 20260905],
        ['a Date object', new Date()]
    ])('rejects %s', (_label, value) => {
        expect(DateUtil.isValid(value)).toBe(false);
    });
});

describe('format', () => {
    it('shows a date the way an American reader expects', () => {
        expect(DateUtil.format('2026-09-05')).toBe('09/05/2026');
    });

    it('shows an em dash when there is no date', () => {
        expect(DateUtil.format(null)).toBe('—');
        expect(DateUtil.format('')).toBe('—');
    });

    it('can be told what to show instead', () => {
        expect(DateUtil.format(null, 'none')).toBe('none');
    });

    it('does not try to reformat something malformed', () => {
        expect(DateUtil.format('09/05/2026')).toBe('—');
    });
});

describe('the time zone bug this class exists to avoid', () => {
    /**
     * 11:30pm on the 5th, in a zone behind UTC, is already the 6th in UTC.
     * toISOString converts before formatting; DateUtil reads the local fields.
     */
    it('reports the local date in the evening, where toISOString would not', () => {
        const lateEvening = new Date(2026, 8, 5, 23, 30, 0);

        expect(DateUtil.toISODate(lateEvening)).toBe('2026-09-05');
        // and here is the bug, asserted directly, so that this test explains
        // itself when it fails
        expect(lateEvening.toISOString().slice(0, 10)).toBe('2026-09-06');
    });

    it('agrees with toISOString at midday, when the two cannot differ', () => {
        const midday = new Date(2026, 8, 5, 12, 0, 0);
        expect(DateUtil.toISODate(midday)).toBe(midday.toISOString().slice(0, 10));
    });
});
