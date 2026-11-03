/**
 * ListEditorView.tsx
 *
 * The screen for editing one list: a toolbar with undo, redo, the list's name
 * and close, and beneath it the item cards, which can be reordered by dragging.
 *
 * PRESENTATIONAL: the list and every action arrive as props from
 * ListEditorContainer. The state it does keep is purely about the screen,
 * such as what is being dragged right now, which no other part of the
 * application needs to know.
 */
import { useEffect, useRef, useState, type DragEvent, type FocusEvent, type KeyboardEvent } from 'react';
import type { ListEditor } from '@/hooks/useListEditor';
import Fab from './Fab';
import ItemCard, { type DropEdge } from './ItemCard';

interface ListEditorViewProps extends ListEditor {
    /** true for a brand new list, whose name arrives selected, ready to be typed over */
    selectNameOnLoad: boolean;
}

export default function ListEditorView({
    list, items, canUndo, canRedo, undo, redo, closeList,
    requestAddItem, requestEditItem, duplicateItem, requestDeleteItem, moveItem, renameList,
    selectNameOnLoad
}: ListEditorViewProps) {
    // what is being dragged, and where it would land. -1 means nothing.
    const [dragFromIndex, setDragFromIndex] = useState(-1);
    const [dropTargetIndex, setDropTargetIndex] = useState(-1);
    // which edge of which card the red drop line is drawn on
    const [dropIndicator, setDropIndicator] = useState<{ index: number; edge: DropEdge }>({ index: -1, edge: null });

    const containerRef = useRef<HTMLOListElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    // set by Escape so the blur it causes abandons the rename instead of committing it
    const escapeWasPressed = useRef(false);
    const nameWasSelected = useRef(false);

    const isLoaded = list !== null;

    // a brand new list arrives with its name selected, once, when it has loaded
    useEffect(() => {
        if (!isLoaded || !selectNameOnLoad || nameWasSelected.current) return;
        nameWasSelected.current = true;
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
    }, [isLoaded, selectNameOnLoad]);

    // -------------------------------------------------------------------------
    // the list's name
    // -------------------------------------------------------------------------

    /**
     * The rename is committed on blur, not onChange. React's onChange fires on
     * every keystroke, which would make every letter its own undo step. Enter
     * simply blurs the field.
     */
    function handleNameBlur(event: FocusEvent<HTMLInputElement>) {
        if (escapeWasPressed.current) {
            escapeWasPressed.current = false;
            event.target.value = list?.name ?? '';
            return;
        }
        renameList(event.target.value);
    }

    function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
        } else if (event.key === 'Escape') {
            escapeWasPressed.current = true;
            event.currentTarget.blur();
        }
    }

    // -------------------------------------------------------------------------
    // drag and drop
    // -------------------------------------------------------------------------

    function handleDragStart(index: number, event: DragEvent) {
        setDragFromIndex(index);
        event.dataTransfer.effectAllowed = 'move';
        // Firefox will not start a drag unless something is on the clipboard
        event.dataTransfer.setData('text/plain', String(index));
    }

    /**
     * Works out where the dragged card would land. Say card 1 is dropped below
     * card 4: the insertion point is 5, but the card is removed first, which
     * shifts everything after it up by one, so the destination is 4.
     */
    function computeDropTarget(event: DragEvent) {
        const cards = [...(containerRef.current?.querySelectorAll('.item-card') ?? [])];
        if (cards.length === 0) return { destination: -1, indicator: { index: -1, edge: null } };

        const cardUnderCursor = (event.target as Element).closest?.<HTMLElement>('.item-card') ?? null;
        let insertionPoint: number;
        let indicator: { index: number; edge: DropEdge };

        if (cardUnderCursor === null) {
            // the cursor is in the empty space below the last card
            insertionPoint = cards.length;
            indicator = { index: cards.length - 1, edge: 'after' };
        } else {
            const bounds = cardUnderCursor.getBoundingClientRect();
            const isBelowMidline = (event.clientY - bounds.top) > (bounds.height / 2);
            const cardIndex = Number(cardUnderCursor.dataset.index);

            insertionPoint = isBelowMidline ? cardIndex + 1 : cardIndex;
            indicator = { index: cardIndex, edge: isBelowMidline ? 'after' : 'before' };
        }

        const destination = (dragFromIndex < insertionPoint) ? insertionPoint - 1 : insertionPoint;
        return { destination, indicator };
    }

    function handleDragOver(event: DragEvent) {
        if (dragFromIndex < 0) return;

        // without this the browser does not allow a drop at all
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';

        const { destination, indicator } = computeDropTarget(event);
        setDropTargetIndex(destination);
        setDropIndicator(indicator);
    }

    function handleDrop(event: DragEvent) {
        if (dragFromIndex < 0) return;
        event.preventDefault();

        const fromIndex = dragFromIndex;
        const toIndex = dropTargetIndex;
        endDrag();

        if (toIndex >= 0 && toIndex !== fromIndex) {
            moveItem(fromIndex, toIndex);
        }
    }

    /** dragend fires however the drag ended, so the cleanup lives here */
    function endDrag() {
        setDragFromIndex(-1);
        setDropTargetIndex(-1);
        setDropIndicator({ index: -1, edge: null });
    }

    const isEmpty = items.length === 0;

    return (
        <section className="flex min-h-0 flex-1 flex-col" aria-label="List editor">
            <div className="flex items-center gap-3 bg-grey-900 px-4 py-2 text-sbu-white shadow-bar">
                <div className="flex gap-1.5">
                    {/* the Wolfie does exactly what the close button does */}
                    <button
                        id="home-button" type="button" onClick={closeList}
                        title="Close this list and return to the home screen"
                        aria-label="Close this list and return to the home screen"
                        className={`${TOOLBAR_BUTTON} flex items-center justify-center p-0`}>
                        <img className="h-6 w-auto drop-shadow-[0_0.0625rem_0.125rem_rgba(0,0,0,0.35)]"
                             src="/images/wolfie-logo.png" alt="" width="1464" height="1054" />
                    </button>
                    <button
                        id="undo-button" type="button" onClick={undo} disabled={!canUndo}
                        title="Undo (Ctrl+Z)" aria-label="Undo"
                        className={TOOLBAR_BUTTON}>
                        ↶
                    </button>
                    <button
                        id="redo-button" type="button" onClick={redo} disabled={!canRedo}
                        title="Redo (Ctrl+Y)" aria-label="Redo"
                        className={TOOLBAR_BUTTON}>
                        ↷
                    </button>
                </div>

                <div className="flex min-w-0 flex-1 justify-center">
                    {/*
                        Uncontrolled, so it holds its own text while being typed in
                        (see handleNameBlur). The key puts a new name into it from
                        outside: when undo changes the name, React rebuilds the
                        input with the new defaultValue.
                    */}
                    {list !== null && (
                        <input
                            id="list-name-input"
                            key={list.name}
                            ref={nameInputRef}
                            type="text"
                            defaultValue={list.name}
                            maxLength={60}
                            spellCheck={false}
                            autoComplete="off"
                            aria-label="The name of this list"
                            onBlur={handleNameBlur}
                            onKeyDown={handleNameKeyDown}
                            className="w-full max-w-[32rem] truncate rounded-control border
                                       border-transparent bg-transparent px-3 py-1.5 text-center
                                       text-[1.25rem] font-bold text-sbu-white
                                       hover:border-white/45
                                       focus:border-sbu-white focus:bg-sbu-white
                                       focus:text-grey-900 focus:outline-none" />
                    )}
                </div>

                <div className="ml-auto flex gap-1.5">
                    <button
                        id="close-button" type="button" onClick={closeList}
                        title="Close this list" aria-label="Close this list"
                        className={TOOLBAR_BUTTON}>
                        ✕
                    </button>
                </div>
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col px-6 pt-5 max-[46rem]:px-3.5 max-[46rem]:pt-4">
                {list !== null && !isEmpty && (
                    /*
                       The same grid as an item card, which keeps the columns lined
                       up. The transparent border and extra padding stand in for a
                       card's accent stripe and the scroll container's insets.
                    */
                    <div className="item-column-headers item-grid gap-3 border-l-[0.3125rem]
                                    border-l-transparent pr-[1.375rem] pb-2 pl-[1rem]
                                    text-[0.6875rem] font-bold tracking-[0.09em] uppercase
                                    text-grey-500 max-[46rem]:hidden"
                         aria-hidden="true">
                        <span className="area-handle" />
                        <span className="area-description">Task</span>
                        <span className="area-entered text-center">Date Entered</span>
                        <span className="area-priority text-center">Priority</span>
                        <span className="area-target text-center">Target Date</span>
                        <span className="area-completed text-center">Completed</span>
                        <span className="area-actions" />
                    </div>
                )}

                {list === null ? (
                    <p id="list-loading-message"
                       className="m-auto pb-16 text-center text-[1.0625rem] text-grey-500">
                        Loading this list…
                    </p>
                ) : isEmpty ? (
                    <p id="list-empty-message"
                       className="m-auto pb-16 text-center text-[1.0625rem] text-grey-500">
                        This list is empty.<br />
                        Press the <strong>+</strong> button to add an item.
                    </p>
                ) : (
                    <ol
                        id="item-card-container"
                        ref={containerRef}
                        aria-label="The items in this list"
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className="card-container card-scroll m-0 min-h-0 flex-1 list-none
                                   overflow-x-hidden overflow-y-auto pt-0.5 pr-2 pb-22 pl-0.5">
                        {items.map((item, index) => (
                            <ItemCard
                                key={item.id}
                                item={item}
                                index={index}
                                isDragging={dragFromIndex === index}
                                dropIndicator={dropIndicator.index === index ? dropIndicator.edge : null}
                                onEdit={() => requestEditItem(index)}
                                onDuplicate={() => duplicateItem(index)}
                                onDelete={() => requestDeleteItem(index)}
                                onDragStart={(event) => handleDragStart(index, event)}
                                onDragEnd={endDrag} />
                        ))}
                    </ol>
                )}

                {list !== null && (
                    <Fab id="add-item-button" label="Add a new item" onClick={requestAddItem} />
                )}
            </div>
        </section>
    );
}

/** shared by the four toolbar buttons, which differ only in their faces */
const TOOLBAR_BUTTON =
    'h-10 w-10 cursor-pointer rounded-control border-none bg-transparent text-[1.375rem] ' +
    'leading-none text-sbu-white transition-[background-color,opacity] duration-150 ' +
    'hover:not-disabled:bg-white/[0.18] active:not-disabled:bg-black/[0.18] ' +
    'disabled:cursor-default disabled:opacity-35';
