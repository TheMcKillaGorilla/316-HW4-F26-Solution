/**
 * useUndoRedo.ts
 *
 * Undo and redo by keeping snapshots, the Memento pattern: before every edit,
 * keep the old value. Undo does not reverse anything, it simply goes back to
 * an earlier snapshot.
 *
 *     past      [oldest, ..., newest]   what undo can go back to
 *     present   the value on screen
 *     future    [next, ..., furthest]   what redo can go forward to
 *
 * It is cheap because the model never changes a list in place. Every edit
 * makes a new list that SHARES its unchanged items with the old one, so a
 * snapshot costs one new array and whatever actually changed, not a copy of
 * everything. The LIMIT keeps a long session from growing without end.
 *
 * <T> makes this a GENERIC hook: it keeps snapshots of whatever type it is
 * given, and TypeScript checks every updater against that same type.
 */
import { useState } from 'react';

export const LIMIT = 100;

interface History<T> {
    past: T[];
    present: T;
    future: T[];
}

export function useUndoRedo<T>(initialValue: T) {
    const [history, setHistory] = useState<History<T>>({ past: [], present: initialValue, future: [] });
    const { past, present, future } = history;

    /** records a change. updater is given the present value and returns the new one */
    function set(updater: (current: T) => T) {
        setHistory(({ past, present }) => ({
            past: [...past, present].slice(-LIMIT),
            present: updater(present),
            future: []
        }));
    }

    function undo() {
        setHistory((current) => {
            const { past, present, future } = current;
            if (past.length === 0) return current;
            return { past: past.slice(0, -1), present: past[past.length - 1], future: [present, ...future] };
        });
    }

    function redo() {
        setHistory((current) => {
            const { past, present, future } = current;
            if (future.length === 0) return current;
            return { past: [...past, present], present: future[0], future: future.slice(1) };
        });
    }

    /** starts again from value, with nothing to undo or redo */
    function reset(value: T) {
        setHistory({ past: [], present: value, future: [] });
    }

    return {
        present,
        set,
        undo,
        redo,
        reset,
        canUndo: past.length > 0,
        canRedo: future.length > 0
    };
}
