/**
 * ListCard.tsx
 *
 * One card on the home screen: the list's name, how much of it is done, and
 * duplicate and delete buttons. It is drawn from the list's METADATA, so it
 * works without the list's items ever having been loaded.
 *
 * PRESENTATIONAL: everything it shows arrives as props and everything it does
 * is a callback prop. It has no idea there is a server.
 */
import type { KeyboardEvent } from 'react';
import type { ListMetadata } from '@wolfie-lists/shared';
import IconButton, { DELETE_GLYPH, DUPLICATE_GLYPH } from './IconButton';

interface ListCardProps {
    list: ListMetadata;
    index: number;
    onOpen: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
}

export default function ListCard({ list, index, onOpen, onDuplicate, onDelete }: ListCardProps) {
    const subtitle = (list.itemCount === 0)
        ? 'No items yet'
        : `${list.completedCount} of ${list.itemCount} completed`;

    /** a card is reachable by keyboard, so it has to be operable by keyboard */
    function handleKeyDown(event: KeyboardEvent) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen();
    }

    return (
        <li
            className="list-card group mt-2.5 flex cursor-pointer items-center gap-3
                       rounded-card border-l-[0.3125rem] border-l-sbu-red bg-sbu-white
                       px-[0.875rem] py-3.5 shadow-card transition-[box-shadow,transform]
                       duration-150 first:mt-0 hover:-translate-y-px hover:shadow-card-hover
                       focus-visible:outline-[0.1875rem] focus-visible:outline-offset-2
                       focus-visible:outline-sbu-red"
            data-list-id={list.id}
            data-index={index}
            role="button"
            tabIndex={0}
            aria-label={`Open the list named ${list.name}`}
            onClick={onOpen}
            onKeyDown={handleKeyDown}>

            <div className="flex min-w-0 flex-1 flex-col">
                <span className="list-card-title truncate text-[1.125rem] font-bold">
                    {list.name}
                </span>
                <span className="list-card-subtitle text-[0.8125rem] text-grey-500">
                    {subtitle}
                </span>
            </div>

            <div className="flex gap-1">
                <IconButton
                    action="duplicate-list"
                    label={`Duplicate the list named ${list.name}`}
                    glyph={DUPLICATE_GLYPH}
                    onClick={onDuplicate} />
                <IconButton
                    action="delete-list"
                    label={`Delete the list named ${list.name}`}
                    glyph={DELETE_GLYPH}
                    danger
                    onClick={onDelete} />
            </div>
        </li>
    );
}
