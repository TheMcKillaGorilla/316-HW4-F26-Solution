/**
 * ListsView.tsx
 *
 * The home screen: a card per list and the + button that makes a new one.
 *
 * PRESENTATIONAL: it is handed the metadata and a callback for everything a
 * user can do, and draws them. ListsContainer decides what those callbacks
 * actually do. That split is why this file can be tested, or restyled,
 * without a server anywhere in sight.
 */
import type { ListMetadata } from '@wolfie-lists/shared';
import Fab from './Fab';
import ListCard from './ListCard';

interface ListsViewProps {
    metadata: ListMetadata[];
    isLoaded: boolean;
    onOpen: (list: ListMetadata) => void;
    onCreate: () => void;
    onDuplicate: (list: ListMetadata) => void;
    onDelete: (list: ListMetadata) => void;
}

export default function ListsView({ metadata, isLoaded, onOpen, onCreate, onDuplicate, onDelete }: ListsViewProps) {
    return (
        <section className="relative flex min-h-0 flex-1 flex-col px-6 pt-5 max-[46rem]:px-3.5 max-[46rem]:pt-4"
                 aria-label="Home">
            {metadata.length > 0 ? (
                <ul
                    id="list-card-container"
                    aria-label="Your lists"
                    className="card-container card-scroll m-0 min-h-0 flex-1 list-none
                               overflow-x-hidden overflow-y-auto pt-0.5 pr-2 pb-22 pl-0.5">
                    {metadata.map((list, index) => (
                        <ListCard
                            key={list.id}
                            list={list}
                            index={index}
                            onOpen={() => onOpen(list)}
                            onDuplicate={() => onDuplicate(list)}
                            onDelete={() => onDelete(list)} />
                    ))}
                </ul>
            ) : (
                <p id="home-empty-message"
                   className="m-auto pb-16 text-center text-[1.0625rem] text-grey-500">
                    {isLoaded ? (
                        <>
                            You do not have any lists yet.<br />
                            Press the <strong>+</strong> button to make your first one.
                        </>
                    ) : 'Loading your lists…'}
                </p>
            )}

            <Fab id="add-list-button" label="Create a new list" onClick={onCreate} />
        </section>
    );
}
