/**
 * Modal.tsx
 *
 * COMPOUND COMPONENTS: Modal is not one component but a small family that is
 * meant to be used together, the way <select> and <option> are:
 *
 *     <Modal id="alert-modal" name="alert" onCancel={close}>
 *         <Modal.Header icon="ℹ">The Server Could Not Be Reached</Modal.Header>
 *         <Modal.Message>Is it running?</Modal.Message>
 *         <Modal.Footer>
 *             <Modal.Button variant="primary" onClick={close}>OK</Modal.Button>
 *         </Modal.Footer>
 *     </Modal>
 *
 * The parent shares what the children need through a context of its own, so
 * nobody has to pass it by hand. Here that is the modal's id: Modal.Header
 * becomes alert-modal-heading and Modal.Message alert-modal-message, and the
 * dialog's aria-labelledby and aria-describedby point at them, without the
 * caller ever writing an id twice or getting one wrong.
 *
 * Modal itself is the shell: the backdrop, the box, the focus trap and what
 * Escape means. Modals can stack (the alert opens over the item modal), so
 * only the topmost one listens to the keyboard.
 */
import { createContext, useContext, useEffect, useRef, type ReactNode, type Ref, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useModals, type ModalName } from '@/context/ModalContext';

/** the selector for everything a user can legitimately land on with Tab */
const FOCUSABLE =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), '
    + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** what a Modal shares with the pieces inside it */
const ModalIdContext = createContext<string>('modal');

interface ModalProps {
    name: ModalName;
    id: string;
    role?: 'dialog' | 'alertdialog';
    /** true if a Modal.Message describes it */
    described?: boolean;
    small?: boolean;
    onCancel: () => void;
    initialFocusRef?: RefObject<HTMLElement | null>;
    children: ReactNode;
}

function Modal({
    name, id, role = 'dialog', described = false, small = false, onCancel, initialFocusRef, children
}: ModalProps) {
    const { topModal } = useModals();
    const elementRef = useRef<HTMLDivElement>(null);
    const elementToRefocus = useRef<Element | null>(null);
    const shakeRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const isTopMost = topModal === name;

    /** remember where focus was, and put it back when the modal closes (the cleanup) */
    useEffect(() => {
        elementToRefocus.current = document.activeElement;
        return () => {
            const target = elementToRefocus.current;
            if (target instanceof HTMLElement && document.contains(target)) target.focus();
        };
    }, []);

    /** focus the control each modal asks for, i.e. Cancel rather than Delete */
    useEffect(() => {
        if (!isTopMost) return;
        const preferred = initialFocusRef?.current;
        if (preferred) {
            preferred.focus();
            if (preferred instanceof HTMLInputElement) preferred.select();
            return;
        }
        elementRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }, [isTopMost, initialFocusRef]);

    /** Escape and Tab, for the topmost modal only */
    useEffect(() => {
        if (!isTopMost) return undefined;

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
            } else if (event.key === 'Tab') {
                trapTab(event, elementRef.current);
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isTopMost, onCancel]);

    /**
     * Clicking the backdrop does not close the modal, which would throw away a half
     * finished edit. The modal gives a small shake to say it is waiting instead.
     */
    function handleBackdropClick() {
        const element = elementRef.current;
        if (element === null) return;

        element.classList.remove('modal-shake');
        // reading offsetWidth forces the browser to apply the removal before the
        // class goes back on, which is what lets the animation run again
        void element.offsetWidth;
        element.classList.add('modal-shake');

        clearTimeout(shakeRef.current);
        shakeRef.current = setTimeout(() => element.classList.remove('modal-shake'), 400);
    }

    useEffect(() => () => clearTimeout(shakeRef.current), []);

    /**
     * A portal: the modal stays inside its providers in the component tree, so it
     * can use their contexts, while its DOM goes to the end of <body>.
     */
    return createPortal(
        <ModalIdContext.Provider value={id}>
            {/* one backdrop per modal; only the topmost is clickable */}
            <div
                id={isTopMost ? 'modal-backdrop' : undefined}
                onClick={isTopMost ? handleBackdropClick : undefined}
                className="fixed inset-0 z-900 bg-[rgba(34,31,29,0.55)]" />

            <div
                id={id}
                ref={elementRef}
                role={role}
                aria-modal="true"
                aria-labelledby={`${id}-heading`}
                aria-describedby={described ? `${id}-message` : undefined}
                className={`modal fixed top-1/2 left-1/2 z-1000 max-h-[calc(100vh-2rem)]
                            -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-modal
                            bg-sbu-white shadow-modal
                            ${small ? 'w-[min(27rem,calc(100vw-2rem))]' : 'w-[min(34rem,calc(100vw-2rem))]'}`}>
                {children}
            </div>
        </ModalIdContext.Provider>,
        document.body
    );
}

/** Keeps Tab and Shift+Tab inside this modal by wrapping around at both ends. */
function trapTab(event: KeyboardEvent, element: HTMLElement | null) {
    if (element === null) return;

    const focusable = [...element.querySelectorAll<HTMLElement>(FOCUSABLE)]
        // offsetParent is null for anything not actually being displayed, which
        // is how a hidden control is kept out of the tab order
        .filter((candidate) => candidate.offsetParent !== null || candidate === document.activeElement);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !element.contains(active))) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && (active === last || !element.contains(active))) {
        event.preventDefault();
        first.focus();
    }
}

// -----------------------------------------------------------------------------
// the pieces every modal is built from, so that three modals cannot drift apart
// -----------------------------------------------------------------------------

function Header({ icon, warning = false, children }: { icon?: string; warning?: boolean; children: ReactNode }) {
    const id = useContext(ModalIdContext);
    return (
        <h2 id={`${id}-heading`}
            className={`m-0 flex items-center gap-2.5 rounded-t-modal px-5 py-4
                        text-[1.1875rem] text-sbu-white
                        ${warning ? 'bg-sbu-black' : 'bg-sbu-red'}`}>
            {icon && <span className="text-[1.375rem] leading-none" aria-hidden="true">{icon}</span>}
            <span id={`${id}-title`}>{children}</span>
        </h2>
    );
}

function Message({ children }: { children: ReactNode }) {
    const id = useContext(ModalIdContext);
    return <p id={`${id}-message`} className="m-0 p-5 text-grey-700">{children}</p>;
}

function Footer({ children }: { children: ReactNode }) {
    return (
        <div className="flex items-center gap-2 rounded-b-modal border-t border-grey-200
                        bg-grey-100 px-5 py-3.5">
            {children}
        </div>
    );
}

/** the four button styles, so that a button cannot be almost right */
export const BUTTON_STYLES = {
    base: 'cursor-pointer rounded-control border border-transparent px-[1.125rem] py-2 '
        + 'text-[0.9375rem] font-semibold transition-[background-color,color,opacity] '
        + 'duration-150 focus-visible:outline-[0.1875rem] focus-visible:outline-offset-2 '
        + 'focus-visible:outline-sbu-black disabled:cursor-default disabled:opacity-40',
    primary: 'bg-sbu-red text-sbu-white hover:not-disabled:bg-sbu-red-dark',
    secondary: 'border-grey-300 bg-sbu-white text-grey-900 hover:not-disabled:bg-grey-200',
    danger: 'bg-sbu-red text-sbu-white hover:not-disabled:bg-sbu-red-dark',
    quiet: 'bg-transparent text-grey-700 hover:not-disabled:bg-grey-200 hover:not-disabled:text-sbu-black'
};

export type ButtonVariant = Exclude<keyof typeof BUTTON_STYLES, 'base'>;

interface ButtonProps {
    id?: string;
    variant?: ButtonVariant;
    disabled?: boolean;
    title?: string;
    onClick: () => void;
    /** React 19 passes ref to a function component like any other prop */
    ref?: Ref<HTMLButtonElement>;
    children: ReactNode;
}

function Button({ id, variant = 'secondary', disabled, title, onClick, ref, children }: ButtonProps) {
    return (
        <button
            id={id}
            ref={ref}
            type="button"
            disabled={disabled}
            onClick={onClick}
            title={title}
            className={`${BUTTON_STYLES.base} ${BUTTON_STYLES[variant]}`}>
            {children}
        </button>
    );
}

// the pieces hang off Modal itself, so one import brings the whole family
export default Object.assign(Modal, { Header, Message, Footer, Button });
