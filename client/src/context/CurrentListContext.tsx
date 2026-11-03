/**
 * CurrentListContext.tsx
 *
 * The open list: fetching it, editing it, undo and redo, and saving it.
 *
 * The list's page mounts this provider, so the undo history is created when a
 * list opens and thrown away when the user navigates anywhere else.
 *
 * Every change, undo and redo included, sends the whole list to the server.
 * Undo needs no special handling on the server: to the server, restoring an
 * old snapshot is simply one more save.
 */
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { ListDTO } from '@wolfie-lists/shared';
import * as api from '@/lib/api';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useModals } from './ModalContext';

interface CurrentListContextValue {
    listId: string;
    /** null until the list has arrived from the server */
    list: ListDTO | null;
    /** the one way to change the list: updater is given it and returns the new version */
    change: (updater: (list: ListDTO) => ListDTO) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    closeList: () => void;
}

const CurrentListContext = createContext<CurrentListContextValue | null>(null);

export function useCurrentList(): CurrentListContextValue {
    const value = useContext(CurrentListContext);
    if (value === null) throw new Error('useCurrentList must be used inside a <CurrentListProvider>');
    return value;
}

export function CurrentListProvider({ listId, children }: { listId: string; children: ReactNode }) {
    const navigate = useNavigate();
    const { inform } = useModals();

    const undoRedo = useUndoRedo<ListDTO | null>(null);
    const list = undoRedo.present;

    // the version the server already has, so it is not sent back to it
    const lastSaved = useRef<ListDTO | null>(null);

    const closeList = () => navigate('/lists');

    /**
     * Fetch the list when it is opened. In development StrictMode runs this
     * effect twice; the ignore flag makes the first run's answer, which
     * arrives after its cleanup, do nothing.
     *
     * A list that is not the user's own gets the same 404 as one that does not
     * exist, so both end up back on the home screen with the same message.
     */
    useEffect(() => {
        let ignore = false;
        api.getList(listId)
            .then((loaded) => {
                if (ignore) return;
                lastSaved.current = loaded;
                undoRedo.reset(loaded);
            })
            .catch((error: Error) => {
                if (ignore) return;
                inform({ title: 'The List Could Not Be Opened', message: error.message });
                navigate('/lists', { replace: true });
            });
        return () => { ignore = true; };
    }, [listId]);

    // save whenever the list changes
    useEffect(() => {
        if (list === null || list === lastSaved.current) return;
        lastSaved.current = list;
        api.saveList(list)
            .catch((error: Error) => inform({ title: 'Changes Were Not Saved', message: error.message }));
    }, [list]);

    // a list that has loaded is never set back to null, so the updater may assume one
    const change = (updater: (list: ListDTO) => ListDTO) =>
        undoRedo.set((current) => (current === null ? current : updater(current)));

    const value: CurrentListContextValue = {
        listId,
        list,
        change,
        undo: undoRedo.undo,
        redo: undoRedo.redo,
        canUndo: undoRedo.canUndo,
        canRedo: undoRedo.canRedo,
        closeList
    };

    return <CurrentListContext.Provider value={value}>{children}</CurrentListContext.Provider>;
}
