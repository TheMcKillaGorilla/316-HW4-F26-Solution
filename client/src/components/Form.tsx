/**
 * Form.tsx
 *
 * COMPOUND COMPONENTS again, this time for the account forms:
 *
 *     <Form id="login-form" onSubmit={logIn}>
 *         <Form.Error />
 *         <Form.Field id="email" label="Email" type="email" ... />
 *         <Form.Submit>Log In</Form.Submit>
 *     </Form>
 *
 * The family shares state through a context: while onSubmit is running,
 * Form.Submit is disabled and says so, and if onSubmit throws, Form.Error
 * shows the message. So every form gets the same waiting and the same error
 * reporting just by being built from these pieces, and onSubmit can reject
 * bad input with nothing more than `throw new Error('...')`.
 */
import { createContext, useContext, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';

interface FormState {
    id: string;
    pending: boolean;
    error: string | null;
}

const FormContext = createContext<FormState>({ id: 'form', pending: false, error: null });

interface FormProps {
    id: string;
    /** may throw (or reject); the message is shown by Form.Error */
    onSubmit: () => Promise<void> | void;
    children: ReactNode;
}

function Form({ id, onSubmit, children }: FormProps) {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (pending) return;
        setPending(true);
        setError(null);
        try {
            await onSubmit();
        } catch (thrown) {
            setError(thrown instanceof Error ? thrown.message : String(thrown));
        } finally {
            setPending(false);
        }
    }

    return (
        <FormContext.Provider value={{ id, pending, error }}>
            {/* noValidate: our own messages, in Form.Error, instead of the browser's bubbles */}
            <form id={id} noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
                {children}
            </form>
        </FormContext.Provider>
    );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
    id: string;
    label: string;
    /** a line of help beneath the control */
    hint?: string;
}

/** a label and its input, wired together, with everything else passed to the input */
function Field({ id, label, hint, className = '', ...inputProps }: FieldProps) {
    const { pending } = useContext(FormContext);
    return (
        <div className="flex flex-col gap-[0.3125rem]">
            <label htmlFor={id} className="text-xs font-bold tracking-[0.08em] uppercase text-grey-700">
                {label}
            </label>
            <input id={id} disabled={pending} aria-describedby={hint ? `${id}-hint` : undefined}
                   className={`${FIELD_CONTROL} ${className}`} {...inputProps} />
            {hint && <span id={`${id}-hint`} className="text-[0.8125rem] text-grey-500">{hint}</span>}
        </div>
    );
}

/** what went wrong the last time the form was submitted, if anything did */
function ErrorMessage() {
    const { id, error } = useContext(FormContext);
    if (error === null) return null;
    return (
        <p id={`${id}-error`} role="alert"
           className="m-0 rounded-control border border-sbu-red/30 bg-sbu-red/[0.06] px-3 py-2
                      text-[0.9375rem] text-sbu-red-dark">
            {error}
        </p>
    );
}

function Submit({ children, pendingLabel = 'Please wait…' }: { children: ReactNode; pendingLabel?: string }) {
    const { pending } = useContext(FormContext);
    return (
        <button type="submit" disabled={pending}
                className="mt-1 cursor-pointer rounded-control bg-sbu-red px-4 py-2.5 text-base
                           font-semibold text-sbu-white transition-colors duration-150
                           hover:not-disabled:bg-sbu-red-dark disabled:cursor-default disabled:opacity-60
                           focus-visible:outline-[0.1875rem] focus-visible:outline-offset-2
                           focus-visible:outline-sbu-black">
            {pending ? pendingLabel : children}
        </button>
    );
}

export const FIELD_CONTROL =
    'w-full rounded-control border border-grey-300 bg-sbu-white px-2.5 py-2 text-base '
    + 'text-grey-900 placeholder:text-grey-500 '
    + 'focus:border-sbu-red focus:outline-2 focus:outline-offset-[0.0625rem] focus:outline-sbu-red '
    + 'disabled:cursor-not-allowed disabled:bg-grey-100';

export default Object.assign(Form, { Field, Error: ErrorMessage, Submit });
