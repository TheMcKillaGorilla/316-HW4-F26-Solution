/**
 * useUndoRedoShortcuts.ts
 *
 * Ctrl+Z undoes and Ctrl+Y (or Ctrl+Shift+Z) redoes, except while a modal is
 * open or the caret is in a form field, where those keys belong to the browser.
 *
 * The list editor calls this, so the listener only exists while a list is open.
 */
import { useEffect } from 'react';
import { useModals } from '@/context/ModalContext';

export function useUndoRedoShortcuts(undo: () => void, redo: () => void) {
    const { isAnyModalOpen } = useModals();

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (!(event.ctrlKey || event.metaKey) || isAnyModalOpen) return;
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '')) return;

            const key = event.key.toLowerCase();
            if (key === 'z' && !event.shiftKey) {
                event.preventDefault();
                undo();
            } else if (key === 'y' || key === 'z') {
                event.preventDefault();
                redo();
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, isAnyModalOpen]);
}
