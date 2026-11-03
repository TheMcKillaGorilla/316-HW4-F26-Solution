/**
 * ModalLayer.tsx
 *
 * Renders whichever modals are open. The confirm and alert modals can open
 * from any page, so the root layout renders them once. The item modal edits
 * the open list, so it only exists inside CurrentListProvider (ItemModalHost).
 */
import { useCurrentList } from '@/context/CurrentListContext';
import { useModals } from '@/context/ModalContext';
import AlertModal from './AlertModal';
import ConfirmModal from './ConfirmModal';
import ItemModal from './ItemModal';

/** the two modals that can be shown from any page */
export default function ModalLayer() {
    return (
        <>
            <ConfirmModal />
            <AlertModal />
        </>
    );
}

/**
 * The key makes React build a fresh ItemModal when Next or Previous moves to
 * another item. Without it the form's state would keep the old item's values.
 */
export function ItemModalHost() {
    const { itemModal } = useModals();
    const { listId } = useCurrentList();

    if (itemModal === null) return null;

    return <ItemModal key={`${listId}:${itemModal.mode}:${itemModal.index}`} request={itemModal} />;
}
