/**
 * ListPage.tsx, one list at /lists/6f0c...
 *
 * :id in the route is a URL PARAMETER: whatever is in that part of the URL,
 * useParams hands over. A brand new list is opened as /lists/6f0c...?new,
 * which asks for its name to arrive selected.
 *
 * Nothing here checks that the list belongs to the user. It does not need to:
 * the API answers 404 for anybody else's list, exactly as for one that does
 * not exist, and the editor goes back to /lists.
 */
import { useParams, useSearchParams } from 'react-router';
import ListEditorContainer from '@/containers/ListEditorContainer';

export default function ListPage() {
    const { id = '' } = useParams();
    const [searchParams] = useSearchParams();

    // the key gives every list its own editor, and so its own undo history
    return (
        <>
            <title>Editing a List · Wolfie Lists</title>
            <ListEditorContainer key={id} listId={id} isNew={searchParams.has('new')} />
        </>
    );
}
