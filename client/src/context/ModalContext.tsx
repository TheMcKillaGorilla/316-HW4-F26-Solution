/**
 * ModalContext.tsx
 *
 * Which modals are open and what each one is showing.
 *
 * Open modals are kept as a stack, because one can open on top of another: OK
 * in the item modal with no description puts the alert modal over it. Only the
 * modal on top responds to the keyboard.
 *
 * The root layout provides this, so a modal can be opened from any page.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ItemValues } from '@/model/listItem';

export type ModalName = 'item' | 'confirm' | 'alert';

export interface ItemModalRequest {
    mode: 'create' | 'edit';
    index: number;
    itemCount: number;
    values: ItemValues;
}

export interface ConfirmRequest {
    title: string;
    message: string;
    acceptLabel?: string;
    onAccept: () => void;
}

export interface AlertRequest {
    title?: string;
    message?: string;
}

/**
 * A DISCRIMINATED UNION: every open modal has a name, and the name tells
 * TypeScript which of the three shapes the rest of it has.
 */
type OpenModal =
    | ({ name: 'item' } & ItemModalRequest)
    | ({ name: 'confirm' } & Required<ConfirmRequest>)
    | ({ name: 'alert' } & Required<AlertRequest>);

interface ModalContextValue {
    itemModal: ItemModalRequest | null;
    confirmModal: Required<ConfirmRequest> | null;
    alertModal: Required<AlertRequest> | null;
    topModal: ModalName | null;
    isAnyModalOpen: boolean;
    openItemModal: (request: ItemModalRequest) => void;
    closeItemModal: () => void;
    askConfirm: (request: ConfirmRequest) => void;
    closeConfirmModal: () => void;
    inform: (request: AlertRequest) => void;
    closeAlertModal: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModals(): ModalContextValue {
    const value = useContext(ModalContext);
    if (value === null) throw new Error('useModals must be used inside a <ModalProvider>');
    return value;
}

export function ModalProvider({ children }: { children: ReactNode }) {
    // the open modals, bottom first
    const [openModals, setOpenModals] = useState<OpenModal[]>([]);

    function show(modal: OpenModal) {
        setOpenModals((previous) => [...previous.filter(({ name }) => name !== modal.name), modal]);
    }

    function hide(name: ModalName) {
        setOpenModals((previous) => previous.filter((modal) => modal.name !== name));
    }

    // while any modal is open, the body class stops the page behind it being clicked
    useEffect(() => {
        document.body.classList.toggle('modal-is-open', openModals.length > 0);
    }, [openModals]);

    // narrowing: inside each find, TypeScript knows exactly which shape it found
    const itemModal = openModals.find((modal) => modal.name === 'item') ?? null;
    const confirmModal = openModals.find((modal) => modal.name === 'confirm') ?? null;
    const alertModal = openModals.find((modal) => modal.name === 'alert') ?? null;

    const value: ModalContextValue = {
        itemModal,
        confirmModal,
        alertModal,
        topModal: openModals.at(-1)?.name ?? null,
        isAnyModalOpen: openModals.length > 0,

        openItemModal: (request) => show({ name: 'item', ...request }),
        closeItemModal: () => hide('item'),

        askConfirm: (request) => show({ name: 'confirm', acceptLabel: 'Delete', ...request }),
        closeConfirmModal: () => hide('confirm'),

        inform: (request) => show({ name: 'alert', title: 'Notice', message: '', ...request }),
        closeAlertModal: () => hide('alert')
    };

    return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}
