/**
 * AlertModal.tsx
 *
 * The informative modal, for when the application simply has to tell the user
 * something: an item needs a description, the server could not be reached.
 */
import { useRef } from 'react';
import { useModals } from '@/context/ModalContext';
import Modal from './Modal';

export default function AlertModal() {
    const { alertModal, closeAlertModal } = useModals();
    const okRef = useRef<HTMLButtonElement>(null);

    if (alertModal === null) return null;

    return (
        // there is only one way out of an informative modal, so Escape and OK
        // do the same thing
        <Modal name="alert" id="alert-modal" role="alertdialog" described small
               onCancel={closeAlertModal} initialFocusRef={okRef}>
            <Modal.Header icon="ℹ">{alertModal.title}</Modal.Header>
            <Modal.Message>{alertModal.message}</Modal.Message>
            <Modal.Footer>
                <div className="ml-auto flex gap-2">
                    <Modal.Button id="alert-ok-button" ref={okRef} variant="primary" onClick={closeAlertModal}>
                        OK
                    </Modal.Button>
                </div>
            </Modal.Footer>
        </Modal>
    );
}
