/**
 * Form.test.tsx
 *
 * The Form compound component on its own: Form.Field, Form.Error and
 * Form.Submit learn from the Form around them, through its context, whether
 * a submit is under way and what went wrong with the last one.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Form from '@/components/Form';

/** a small form built the way the account forms are */
function renderForm(onSubmit: () => Promise<void> | void) {
    render(
        <Form id="test-form" onSubmit={onSubmit}>
            <Form.Error />
            <Form.Field id="test-email" label="Email" type="email" defaultValue="" />
            <Form.Field id="test-password" label="Password" type="password" hint="At least 8 characters" />
            <Form.Submit pendingLabel="Saving…">Save</Form.Submit>
        </Form>
    );
    return userEvent.setup();
}

/** a promise, and the function that settles it, so a test decides when a submit ends */
function deferred() {
    let resolve = () => {};
    const promise = new Promise<void>((settle) => { resolve = settle; });
    return { promise, resolve };
}

describe('Form.Field', () => {
    it('wires its label to its input', () => {
        renderForm(() => {});

        const email = screen.getByLabelText('Email');
        expect(email).toHaveAttribute('id', 'test-email');
        expect(email).toHaveAttribute('type', 'email');
    });

    it('points the input at its hint, for a screen reader', () => {
        renderForm(() => {});

        expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('At least 8 characters');
        expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-describedby');
    });
});

describe('while onSubmit is running', () => {
    it('disables the submit button and says it is waiting', async () => {
        const submit = deferred();
        const user = renderForm(() => submit.promise);

        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
        expect(screen.getByLabelText('Email')).toBeDisabled();

        submit.resolve();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
        expect(screen.getByLabelText('Email')).toBeEnabled();
    });

    it('does not submit a second time', async () => {
        const submit = deferred();
        const onSubmit = vi.fn(() => submit.promise);
        const user = renderForm(onSubmit);

        await user.click(screen.getByRole('button', { name: 'Save' }));
        // the button is disabled now, so submit the form directly, as Enter would
        fireEvent.submit(screen.getByRole('button', { name: 'Saving…' }).closest('form')!);

        expect(onSubmit).toHaveBeenCalledOnce();
        submit.resolve();
    });
});

describe('Form.Error', () => {
    it('shows nothing until something goes wrong', () => {
        renderForm(() => {});
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows the message onSubmit threw', async () => {
        const user = renderForm(() => { throw new Error('Enter your email address.'); });

        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Enter your email address.');
        expect(screen.getByRole('alert')).toHaveAttribute('id', 'test-form-error');
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('shows the message of a rejected promise too', async () => {
        const user = renderForm(async () => { throw new Error('Invalid email or password.'); });

        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    });

    it('goes away when the form is submitted again and succeeds', async () => {
        let attempts = 0;
        const user = renderForm(() => {
            attempts += 1;
            if (attempts === 1) throw new Error('Try again.');
        });

        await user.click(screen.getByRole('button', { name: 'Save' }));
        await screen.findByRole('alert');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    });
});
