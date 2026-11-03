/**
 * accounts.test.tsx
 *
 * The three account forms, at /login, /register and /account, against the
 * fake server.
 *
 * What a form refuses before sending anything is checked here, along with
 * what it does with the server's answer. Whether the server itself refuses
 * the same things is server/tests' job.
 *
 * Opening the application makes one request before any form is used, GET
 * /api/users/me, to find out who is logged in (twice, under StrictMode). So
 * "sends nothing" below means nothing but that.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUrl, renderApp } from '../helpers/harness';
import type { FakeServer } from '../helpers/fakeServer';
import { WEEKEND_LIST, WOLFIE, WOLFIE_PASSWORD } from '../helpers/fixtures';

const PNG = new File(['png bytes'], 'wolfie.png', { type: 'image/png' });

/**
 * jsdom has no URL.createObjectURL, which AvatarPicker uses to preview the
 * chosen file before anything is uploaded, so stand in for it.
 */
beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:avatar-preview');
    URL.revokeObjectURL = vi.fn();
});

/** the hidden file input inside AvatarPicker */
const avatarInput = () => document.getElementById('avatar-input') as HTMLInputElement;

/** every request but the session's GET /api/users/me, as 'POST /api/auth/login' */
const requestsMadeBy = (server: FakeServer) => server.requests
    .filter(({ url }) => url !== '/api/users/me')
    .map(({ method, url }) => `${method} ${url}`);

/** opens one of the public pages with nobody logged in, and waits for its form */
async function openPublicPage(url: '/login' | '/register') {
    const rendered = renderApp({ url, loggedIn: false });
    await screen.findByLabelText('Email');
    return rendered;
}

describe('logging in', () => {
    it('sends what was typed and goes to the user\'s lists', async () => {
        const { server, user } = await openPublicPage('/login');

        await user.type(screen.getByLabelText('Email'), WOLFIE.email);
        await user.type(screen.getByLabelText('Password'), WOLFIE_PASSWORD);
        await user.click(screen.getByRole('button', { name: 'Log In' }));

        expect(await screen.findByRole('button', { name: /Open the list named Wolfie/ })).toBeInTheDocument();
        expect(currentUrl()).toBe('/lists');
        expect(server.requestsOf('POST')[0]).toEqual({
            method: 'POST',
            url: '/api/auth/login',
            body: { email: WOLFIE.email, password: WOLFIE_PASSWORD }
        });
    });

    /** the same words for a wrong email and a wrong password, which come from the server */
    it('says "Invalid email or password." when the server refuses, and stays put', async () => {
        const { user } = await openPublicPage('/login');

        await user.type(screen.getByLabelText('Email'), WOLFIE.email);
        await user.type(screen.getByLabelText('Password'), 'not the password');
        await user.click(screen.getByRole('button', { name: 'Log In' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
        expect(currentUrl()).toBe('/login');
    });

    it('asks for both fields before sending anything', async () => {
        const { server, user } = await openPublicPage('/login');

        await user.type(screen.getByLabelText('Email'), WOLFIE.email);
        await user.click(screen.getByRole('button', { name: 'Log In' }));

        expect(await screen.findByRole('alert'))
            .toHaveTextContent('Enter your email address and your password.');
        expect(requestsMadeBy(server)).toEqual([]);
    });

    it('says it is logging in while the server thinks about it', async () => {
        const { server, user } = await openPublicPage('/login');
        let answer = (_value?: unknown) => {};
        server.wait = new Promise((resolve) => { answer = resolve; });

        await user.type(screen.getByLabelText('Email'), WOLFIE.email);
        await user.type(screen.getByLabelText('Password'), WOLFIE_PASSWORD);
        await user.click(screen.getByRole('button', { name: 'Log In' }));

        expect(screen.getByRole('button', { name: 'Logging In…' })).toBeDisabled();
        answer();
        await waitFor(() => expect(currentUrl()).toBe('/lists'));
    });

    it('starts with the caret in the email field', async () => {
        await openPublicPage('/login');
        expect(screen.getByLabelText('Email')).toHaveFocus();
    });

    it('links to the sign up page', async () => {
        const { user } = await openPublicPage('/login');

        await user.click(screen.getByRole('link', { name: 'Create an account' }));

        expect(await screen.findByRole('heading', { name: 'Create an Account' })).toBeInTheDocument();
        expect(currentUrl()).toBe('/register');
    });
});

describe('creating an account', () => {
    /** fills in the form, choosing an avatar first if one is given */
    async function fillIn(user: UserEvent, { password = 'go seawolves', confirm = 'go seawolves', avatar = null }:
                          { password?: string; confirm?: string; avatar?: File | null } = {}) {
        if (avatar !== null) await user.upload(avatarInput(), avatar);
        await user.type(screen.getByLabelText('Email'), 'new@stonybrook.edu');
        await user.type(screen.getByLabelText('Password'), password);
        await user.type(screen.getByLabelText('Confirm Password'), confirm);
        await user.click(screen.getByRole('button', { name: 'Create Account' }));
    }

    /** the avatar in the form; the logo above the card is an <img> too */
    const formAvatar = () => document.querySelector('#register-form img');

    it('refuses two passwords that do not match, before sending anything', async () => {
        const { server, user } = await openPublicPage('/register');

        await fillIn(user, { password: 'go seawolves', confirm: 'go seawolvez' });

        expect(await screen.findByRole('alert')).toHaveTextContent('The two passwords do not match.');
        expect(requestsMadeBy(server)).toEqual([]);
    });

    it('refuses a password that is too short, before sending anything', async () => {
        const { server, user } = await openPublicPage('/register');

        await fillIn(user, { password: 'short', confirm: 'short' });

        expect(await screen.findByRole('alert'))
            .toHaveTextContent('A password must be at least 8 characters long.');
        expect(requestsMadeBy(server)).toEqual([]);
    });

    it('makes the account and goes to the new user\'s lists', async () => {
        const { server, user } = await openPublicPage('/register');

        await fillIn(user);

        // a brand new account has no lists yet
        expect(await screen.findByText(/do not have any lists yet/i)).toBeInTheDocument();
        expect(currentUrl()).toBe('/lists');
        // the one request, followed by the home screen asking for the lists
        expect(requestsMadeBy(server)[0]).toBe('POST /api/auth/register');
        expect(server.requestsOf('POST')).toHaveLength(1);
        expect(server.account.user.email).toBe('new@stonybrook.edu');
    });

    /** only a logged in user can have an avatar, so it goes up once the account exists */
    it('uploads the avatar straight afterwards, when one was chosen', async () => {
        const { server, user } = await openPublicPage('/register');

        await fillIn(user, { avatar: PNG });

        await screen.findByText(/do not have any lists yet/i);
        expect(requestsMadeBy(server).slice(0, 2)).toEqual(['POST /api/auth/register', 'PUT /api/users/me/avatar']);
        expect(server.requestsOf('PUT')[0].body.get('avatar')).toBe(PNG);
        // and the header has it from the start
        expect(screen.getByRole('button', { name: 'Account menu for new@stonybrook.edu' }).querySelector('img'))
            .toHaveAttribute('src', server.account.user.avatarUrl);
    });

    it('previews the chosen avatar before anything is uploaded', async () => {
        const { server, user } = await openPublicPage('/register');

        await user.upload(avatarInput(), PNG);

        expect(formAvatar()).toHaveAttribute('src', 'blob:avatar-preview');
        expect(requestsMadeBy(server)).toEqual([]);
    });

    it('refuses an avatar of the wrong type, and says why', async () => {
        await openPublicPage('/register');
        // the file chooser would not offer a GIF at all, so go round it
        const user = userEvent.setup({ applyAccept: false });

        await user.upload(avatarInput(), new File(['gif'], 'wolfie.gif', { type: 'image/gif' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('An avatar must be a PNG, JPEG or WebP image.');
        expect(formAvatar()).toBeNull();
    });

    it('says so when the email address is already taken', async () => {
        const { user } = await openPublicPage('/register');

        await user.type(screen.getByLabelText('Email'), WOLFIE.email);
        await user.type(screen.getByLabelText('Password'), 'go seawolves');
        await user.type(screen.getByLabelText('Confirm Password'), 'go seawolves');
        await user.click(screen.getByRole('button', { name: 'Create Account' }));

        expect(await screen.findByRole('alert'))
            .toHaveTextContent('There is already an account with that email address.');
        expect(currentUrl()).toBe('/register');
    });
});

describe('the account page', () => {
    /** opens /account, logged in, and waits for it */
    async function openAccountPage() {
        const rendered = renderApp({ url: '/account', lists: [WEEKEND_LIST] });
        await screen.findByRole('heading', { name: 'Your Account' });
        return rendered;
    }

    it('shows whose account it is', async () => {
        await openAccountPage();
        expect(screen.getByText(WOLFIE.email)).toBeInTheDocument();
    });

    /**
     * The header's avatar and this page's both read the session's copy of the
     * user, so the server's answer has to be put there for both to change.
     */
    it('uploads a new avatar the moment it is chosen, and the header shows it', async () => {
        const { server, user } = await openAccountPage();
        const menuButton = screen.getByRole('button', { name: `Account menu for ${WOLFIE.email}` });
        expect(menuButton.querySelector('img')).toBeNull();

        await user.upload(avatarInput(), PNG);

        await waitFor(() => expect(menuButton.querySelector('img'))
            .toHaveAttribute('src', server.account.user.avatarUrl));
        expect(server.requestsOf('PUT')[0].url).toBe('/api/users/me/avatar');
    });

    it('says it is uploading until the server answers', async () => {
        const { server, user } = await openAccountPage();
        let answer = (_value?: unknown) => {};
        server.wait = new Promise((resolve) => { answer = resolve; });

        await user.upload(avatarInput(), PNG);

        expect(await screen.findByText('Uploading…')).toBeInTheDocument();
        expect(avatarInput()).toBeDisabled();
        answer();
        expect(await screen.findByText('Change Avatar')).toBeInTheDocument();
    });

    it('changes the password, says so, and empties the fields', async () => {
        const { server, user } = await openAccountPage();

        await user.type(screen.getByLabelText('Current Password'), WOLFIE_PASSWORD);
        await user.type(screen.getByLabelText('New Password'), 'go seawolves');
        await user.type(screen.getByLabelText('Confirm New Password'), 'go seawolves');
        await user.click(screen.getByRole('button', { name: 'Change Password' }));

        expect(await screen.findByRole('status')).toHaveTextContent('Your password has been changed.');
        expect(server.account.password).toBe('go seawolves');
        expect(screen.getByLabelText('Current Password')).toHaveValue('');
        expect(screen.getByLabelText('New Password')).toHaveValue('');
    });

    it('says so when the current password is wrong, and changes nothing', async () => {
        const { server, user } = await openAccountPage();

        await user.type(screen.getByLabelText('Current Password'), 'not the password');
        await user.type(screen.getByLabelText('New Password'), 'go seawolves');
        await user.type(screen.getByLabelText('Confirm New Password'), 'go seawolves');
        await user.click(screen.getByRole('button', { name: 'Change Password' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('The current password is not correct.');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(server.account.password).toBe(WOLFIE_PASSWORD);
    });

    it('refuses two new passwords that do not match, before sending anything', async () => {
        const { server, user } = await openAccountPage();

        await user.type(screen.getByLabelText('Current Password'), WOLFIE_PASSWORD);
        await user.type(screen.getByLabelText('New Password'), 'go seawolves');
        await user.type(screen.getByLabelText('Confirm New Password'), 'go seawolvez');
        await user.click(screen.getByRole('button', { name: 'Change Password' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('The two new passwords do not match.');
        expect(requestsMadeBy(server)).toEqual([]);
    });

    it('links back to the lists', async () => {
        const { user } = await openAccountPage();

        await user.click(screen.getByRole('link', { name: /Back to your lists/ }));

        expect(await screen.findByRole('button', { name: /Open the list named Wolfie/ })).toBeInTheDocument();
        expect(currentUrl()).toBe('/lists');
    });
});
