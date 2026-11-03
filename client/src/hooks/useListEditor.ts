/**
 * useListEditor.ts
 *
 * Everything the list screen can do, as one hook. A component calls
 * duplicateItem(index) and never has to know about the contexts, the history
 * or the model behind it.
 *
 * Each edit is just a call to change() with the new version of the list. Undo
 * comes for free, because useUndoRedo kept the old one.
 */
import { useCurrentList } from '@/context/CurrentListContext';
import { useModals } from '@/context/ModalContext';
import { cloneItem, createListItem, itemValues, valuesAreEqual, type ItemValues } from '@/model/listItem';
import * as model from '@/model/wolfieList';

/** what OK, Previous and Next in the item modal hand over */
export interface ItemModalCommit {
    mode: 'create' | 'edit';
    index: number;
    values: ItemValues;
    then?: 'close' | 'next' | 'previous';
}

export function useListEditor() {
    const { list, change, undo, redo, canUndo, canRedo, closeList } = useCurrentList();
    const { openItemModal, closeItemModal, askConfirm, inform } = useModals();
    const items = list?.items ?? [];

    /** the + button: the item is only created once the user presses Add */
    function requestAddItem() {
        openItemModal({ mode: 'create', index: -1, itemCount: 0, values: itemValues(createListItem()) });
    }

    function requestEditItem(index: number) {
        openItemModal({ mode: 'edit', index, itemCount: items.length, values: itemValues(items[index]) });
    }

    /** Adds the item, records the edit, or does nothing if nothing changed. */
    function commitItemModal({ mode, index, values, then = 'close' }: ItemModalCommit) {
        // the alert opens on top of the item modal, so what was typed is kept
        if (values.description === '') {
            inform({ title: 'A Description Is Required', message: 'Every item needs a description.' });
            return;
        }

        if (mode === 'create') {
            const item = createListItem(values);
            change((current) => model.addItem(current, item));
            closeItemModal();
            return;
        }

        if (!valuesAreEqual(itemValues(items[index]), values)) {
            // keeps the item's id, so it is still the same item
            change((current) => model.replaceItemAt(current, index, { ...current.items[index], ...values }));
        }

        if (then === 'next') {
            requestEditItem(index + 1);
        } else if (then === 'previous') {
            requestEditItem(index - 1);
        } else {
            closeItemModal();
        }
    }

    /** the copy goes directly beneath the original */
    function duplicateItem(index: number) {
        const copy = cloneItem(items[index]);
        change((current) => model.addItem(current, copy, index + 1));
    }

    function requestDeleteItem(index: number) {
        askConfirm({
            title: 'Delete This Item?',
            message: `The item "${items[index].description}" will be removed from this list. You can undo this afterwards.`,
            acceptLabel: 'Delete Item',
            onAccept: () => change((current) => model.removeItemAt(current, index))
        });
    }

    function moveItem(fromIndex: number, toIndex: number) {
        if (fromIndex === toIndex) return;
        change((current) => model.moveItem(current, fromIndex, toIndex));
    }

    function renameList(requestedName: string) {
        const newName = model.normalizeListName(requestedName);
        if (list === null || newName === list.name) return;
        change((current) => model.withName(current, newName));
    }

    return {
        list,
        items,
        canUndo,
        canRedo,
        undo,
        redo,
        closeList,
        requestAddItem,
        requestEditItem,
        commitItemModal,
        duplicateItem,
        requestDeleteItem,
        moveItem,
        renameList
    };
}

export type ListEditor = ReturnType<typeof useListEditor>;
