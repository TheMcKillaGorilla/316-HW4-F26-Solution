/**
 * ConfirmModal.tsx
 *
 * The warning modal. Nothing is deleted without it. The caller passes the
 * function to run on accept, and a closure carries whatever it needs.
 */
import { useRef } from 'react';
import { useModals } from '@/context/ModalContext';
import Modal from './Modal';

export default function ConfirmModal() {
    const { confirmModal, closeConfirmModal } = useModals();
    const declineRef = useRef<HTMLButtonElement>(null);

    if (confirmModal === null) return null;

    function handleAccept() {
        // closed first, so anything the action reports opens on a clear screen
        closeConfirmModal();
        confirmModal?.onAccept();
    }

    return (
        // Escape means no, exactly like the Cancel button, and focus starts on
        // Cancel, so pressing Enter cannot delete by accident
        <Modal name="confirm" id="confirm-modal" role="alertdialog" described small
               onCancel={closeConfirmModal} initialFocusRef={declineRef}>
            <Modal.Header icon="⚠" warning>{confirmModal.title}</Modal.Header>
            <Modal.Message>{confirmModal.message}</Modal.Message>
            <Modal.Footer>
                <div className="ml-auto flex gap-2">
                    <Modal.Button id="confirm-decline-button" ref={declineRef} variant="secondary"
                                  onClick={closeConfirmModal}>
                        Cancel
                    </Modal.Button>
                    <Modal.Button id="confirm-accept-button" variant="danger" onClick={handleAccept}>
                        {confirmModal.acceptLabel}
                    </Modal.Button>
                </div>
            </Modal.Footer>
        </Modal>
    );
}
