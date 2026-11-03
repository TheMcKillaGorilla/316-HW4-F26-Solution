/**
 * IconButton.tsx
 *
 * The small duplicate and delete buttons on the right of every card.
 *
 * They sit inside a card that is itself clickable, so onClick stops the event
 * there. Without that, pressing delete would also open what is being deleted.
 * The data-action attributes are for the end to end tests.
 */
interface IconButtonProps {
    action: string;
    label: string;
    glyph: string;
    danger?: boolean;
    onClick: () => void;
}

export default function IconButton({ action, label, glyph, danger = false, onClick }: IconButtonProps) {
    const dangerHover = danger
        ? 'hover:bg-sbu-red hover:text-sbu-white'
        : 'hover:bg-grey-200 hover:text-sbu-black';

    return (
        <button
            type="button"
            data-action={action}
            title={label}
            aria-label={label}
            onClick={(event) => {
                event.stopPropagation();
                onClick();
            }}
            className={`h-9 w-9 cursor-pointer rounded-control border-none bg-transparent
                        font-symbol text-[1.125rem] leading-none text-grey-700
                        transition-[background-color,color] duration-150
                        focus-visible:outline-[0.1875rem] focus-visible:outline-offset-[0.0625rem]
                        focus-visible:outline-sbu-red ${dangerHover}`}>
            {glyph}
        </button>
    );
}

/** the two glyphs, with U+FE0E after each so the browser draws them as text in
 *  our own colors rather than reaching for the emoji font */
export const DUPLICATE_GLYPH = '⧉︎';
export const DELETE_GLYPH = '\u{1F5D1}︎';
