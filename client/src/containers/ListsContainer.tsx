/**
 * ListsContainer.tsx
 *
 * CONTAINER for the home screen. It owns the data (the user's list metadata),
 * talks to the server, navigates, and asks for confirmation, then hands
 * ListsView the results as props. ListsView draws; this decides.
 *
 * Creating, duplicating and deleting a list are not undoable, and each waits
 * for the server's answer before the screen changes, so the screen never shows
 * something the server refused.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ListMetadata } from '@wolfie-lists/shared';
import * as api from '@/lib/api';
import { useModals } from '@/context/ModalContext';
import ListsView from '@/components/ListsView';

export default function ListsContainer() {
    const [metadata, setMetadata] = useState<ListMetadata[]>([]);
    // true once the server has answered, or failed to
    const [isLoaded, setIsLoaded] = useState(false);

    const navigate = useNavigate();
    const { askConfirm, inform } = useModals();

    function reportError(title: string, error: unknown) {
        inform({ title, message: error instanceof Error ? error.message : String(error) });
    }

    /**
     * Ask the server for the metadata whenever the home screen opens, so the
     * cards always reflect the last save of whatever list was just closed. In
     * development StrictMode runs this twice; the ignore flag makes the first
     * run's answer, which arrives after its cleanup, do nothing.
     */
    useEffect(() => {
        let ignore = false;
        api.getAllMetadata()
            .then((fresh) => {
                if (!ignore) setMetadata(fresh);
            })
            .catch((error) => {
                if (!ignore) reportError('Your Lists Could Not Be Loaded', error);
            })
            .finally(() => {
                if (!ignore) setIsLoaded(true);
            });
        return () => { ignore = true; };
    }, []);

    /** a new list opens straight away, with its name selected (?new) */
    async function createList() {
        try {
            const created = await api.createList();
            navigate(`/lists/${created.id}?new`);
        } catch (error) {
            reportError('The List Could Not Be Created', error);
        }
    }

    /** the server files the copy directly beneath the original, so we do too */
    async function duplicateList(list: ListMetadata) {
        try {
            const copy = await api.duplicateList(list.id);
            setMetadata((previous) => {
                const index = previous.findIndex(({ id }) => id === list.id);
                return previous.toSpliced(index + 1, 0, copy);
            });
        } catch (error) {
            reportError('The List Could Not Be Duplicated', error);
        }
    }

    /** deleting a whole list is not undoable, so the warning says so */
    function requestDeleteList(list: ListMetadata) {
        askConfirm({
            title: 'Delete This List?',
            message: `The list named "${list.name}" and everything in it will be permanently deleted. Deleting a list cannot be undone.`,
            acceptLabel: 'Delete List',
            onAccept: async () => {
                try {
                    await api.deleteList(list.id);
                    setMetadata((previous) => previous.filter(({ id }) => id !== list.id));
                } catch (error) {
                    reportError('The List Could Not Be Deleted', error);
                }
            }
        });
    }

    return (
        <ListsView
            metadata={metadata}
            isLoaded={isLoaded}
            onOpen={(list) => navigate(`/lists/${list.id}`)}
            onCreate={createList}
            onDuplicate={duplicateList}
            onDelete={requestDeleteList} />
    );
}
