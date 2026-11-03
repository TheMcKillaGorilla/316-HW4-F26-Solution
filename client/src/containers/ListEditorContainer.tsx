/**
 * ListEditorContainer.tsx
 *
 * CONTAINER for the list screen. The list itself, its history and its saving
 * live in CurrentListProvider; useListEditor turns them into actions; this
 * component connects those actions, and the keyboard shortcuts, to the
 * presentational ListEditorView.
 */
import { CurrentListProvider } from '@/context/CurrentListContext';
import { useListEditor } from '@/hooks/useListEditor';
import { useUndoRedoShortcuts } from '@/hooks/useUndoRedoShortcuts';
import ListEditorView from '@/components/ListEditorView';
import { ItemModalHost } from '@/components/modals/ModalLayer';

interface ListEditorContainerProps {
    listId: string;
    isNew: boolean;
}

export default function ListEditorContainer({ listId, isNew }: ListEditorContainerProps) {
    return (
        <CurrentListProvider listId={listId}>
            <ConnectedListEditor isNew={isNew} />
            <ItemModalHost />
        </CurrentListProvider>
    );
}

/** split out because a hook can only use a context from inside its provider */
function ConnectedListEditor({ isNew }: { isNew: boolean }) {
    const editor = useListEditor();
    useUndoRedoShortcuts(editor.undo, editor.redo);
    return <ListEditorView {...editor} selectNameOnLoad={isNew} />;
}
