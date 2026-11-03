/**
 * Fab.tsx
 *
 * The floating + button at the bottom right of both list screens.
 */
interface FabProps {
    id: string;
    label: string;
    onClick: () => void;
}

export default function Fab({ id, label, onClick }: FabProps) {
    return (
        <button
            id={id}
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            className="absolute right-8 bottom-6 h-14 w-14 cursor-pointer rounded-full
                       border-[0.1875rem] border-sbu-white bg-sbu-red text-[2.25rem]
                       leading-none font-light text-sbu-white shadow-card-hover
                       transition-[background-color,transform] duration-150
                       hover:scale-[1.06] hover:bg-sbu-red-light
                       active:scale-[0.98] active:bg-sbu-red-dark
                       focus-visible:outline-[0.1875rem] focus-visible:outline-offset-2
                       focus-visible:outline-sbu-black">
            +
        </button>
    );
}
