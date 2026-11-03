/**
 * Modal.test.tsx
 *
 * The Modal compound component on its own. The point of the family is that
 * the caller names the modal once and Modal.Header and Modal.Message take
 * their ids from it, through Modal's context, so the dialog's aria-labelledby
 * and aria-describedby cannot point at an id that is not there.
 */
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModalProvider, useModals } from '@/context/ModalContext';
import Modal from '@/components/modals/Modal';
import ModalLayer from '@/components/modals/ModalLayer';

describe('the ids Modal hands its pieces', () => {
    function renderModal({ described }: { described: boolean }) {
        render(
            <ModalProvider>
                <Modal name="alert" id="alert-modal" role="alertdialog" described={described} onCancel={vi.fn()}>
                    <Modal.Header icon="ℹ">The Server Could Not Be Reached</Modal.Header>
                    <Modal.Message>Is it running?</Modal.Message>
                </Modal>
            </ModalProvider>
        );
        return screen.getByRole('alertdialog');
    }

    it('names the heading, the title and the message after the modal', () => {
        renderModal({ described: true });

        expect(document.getElementById('alert-modal-heading')?.tagName).toBe('H2');
        expect(document.getElementById('alert-modal-title'))
            .toHaveTextContent('The Server Could Not Be Reached');
        expect(document.getElementById('alert-modal-message')).toHaveTextContent('Is it running?');
    });

    it('points aria-labelledby and aria-describedby at them', () => {
        const dialog = renderModal({ described: true });

        expect(dialog).toHaveAttribute('id', 'alert-modal');
        expect(dialog).toHaveAttribute('aria-labelledby', 'alert-modal-heading');
        expect(dialog).toHaveAttribute('aria-describedby', 'alert-modal-message');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('is not described by anything unless it says it is', () => {
        expect(renderModal({ described: false })).not.toHaveAttribute('aria-describedby');
    });

    it('is drawn at the end of <body>, outside whatever rendered it (a portal)', () => {
        const dialog = renderModal({ described: true });
        expect(dialog.parentElement).toBe(document.body);
    });
});

describe('a real modal built from the pieces', () => {
    /** so a screen reader announces the alert's title, then its message */
    it('gets its accessible name and description from its header and message', () => {
        const seen = {} as { modals: ReturnType<typeof useModals> };
        function Probe() {
            seen.modals = useModals();
            return null;
        }
        render(
            <ModalProvider>
                <Probe />
                <ModalLayer />
            </ModalProvider>
        );

        act(() => seen.modals.inform({ title: 'Changes Were Not Saved', message: 'Is the server running?' }));

        const dialog = screen.getByRole('alertdialog', { name: 'Changes Were Not Saved' });
        expect(dialog).toHaveAccessibleDescription('Is the server running?');
    });
});
