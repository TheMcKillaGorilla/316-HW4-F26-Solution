/**
 * useUndoRedo.test.ts
 *
 * The snapshot history on its own, through renderHook, with plain numbers
 * standing in for lists. It is a generic hook, so it keeps whatever it is given.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LIMIT, useUndoRedo } from '@/hooks/useUndoRedo';

function renderHistory<T>(initial: T) {
    return renderHook(() => useUndoRedo<T>(initial)).result;
}

type History<T> = ReturnType<typeof renderHistory<T>>;

/** records a change to value */
function setTo<T>(history: History<T>, value: T) {
    act(() => history.current.set(() => value));
}

describe('useUndoRedo', () => {
    it('starts with the initial value and nothing to undo or redo', () => {
        const history = renderHistory(7);

        expect(history.current.present).toBe(7);
        expect(history.current.canUndo).toBe(false);
        expect(history.current.canRedo).toBe(false);
    });

    it('hands the present value to the updater', () => {
        const history = renderHistory(1);
        act(() => history.current.set((value) => value + 10));
        expect(history.current.present).toBe(11);
    });

    it('goes back with undo and forward with redo', () => {
        const history = renderHistory(0);
        setTo(history, 1);
        setTo(history, 2);

        act(() => history.current.undo());
        expect(history.current.present).toBe(1);
        act(() => history.current.undo());
        expect(history.current.present).toBe(0);
        expect(history.current.canUndo).toBe(false);

        act(() => history.current.redo());
        expect(history.current.present).toBe(1);
        expect(history.current.canRedo).toBe(true);
    });

    it('gives back the very same object on undo, not a copy', () => {
        const original = { name: 'original' };
        const history = renderHistory(original);
        setTo(history, { name: 'changed' });

        act(() => history.current.undo());

        expect(history.current.present).toBe(original);
    });

    it('throws the redo branch away when a new change is made', () => {
        const history = renderHistory(0);
        setTo(history, 1);
        act(() => history.current.undo());
        expect(history.current.canRedo).toBe(true);

        setTo(history, 5);

        expect(history.current.canRedo).toBe(false);
    });

    it('does nothing when there is nothing to undo or redo', () => {
        const history = renderHistory(3);
        act(() => history.current.undo());
        act(() => history.current.redo());
        expect(history.current.present).toBe(3);
    });

    it(`keeps no more than ${LIMIT} steps of undo`, () => {
        const history = renderHistory(0);
        for (let value = 1; value <= LIMIT + 5; value++) setTo(history, value);

        for (let step = 0; step < LIMIT; step++) act(() => history.current.undo());

        expect(history.current.canUndo).toBe(false);
        expect(history.current.present).toBe(5);
    });

    it('can start again from a new value, with no history', () => {
        const history = renderHistory<number | null>(null);
        setTo(history, 1);

        act(() => history.current.reset(42));

        expect(history.current.present).toBe(42);
        expect(history.current.canUndo).toBe(false);
        expect(history.current.canRedo).toBe(false);
    });
});
