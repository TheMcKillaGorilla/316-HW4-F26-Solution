/**
 * session.test.tsx
 *
 * The logged in user: SessionContext, which asks the server who is logged in
 * and notices when the login runs out, and the header's avatar menu, which is
 * where a user sees who they are and logs out.
 */
import { act, renderHook, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import * as api from '@/lib/api';
import { SessionProvider, useSession } from '@/context/SessionContext';
import { useModals } from '@/context/ModalContext';
import { useCurrentList } from '@/context/CurrentListContext';
import { currentUrl, renderApp } from '../helpers/harness';
import { installFakeServer } from '../helpers/fakeServer';
import { WOLFIE } from '../helpers/fixtures';

describe('the providers', () => {
    /** a mistake in the component tree should say so plainly, not fail somewhere later */
    it.each([
        ['useSession', useSession, '<SessionProvider>'],
        ['useModals', useModals, '<ModalProvider>'],
        ['useCurrentList', useCurrentList, '<CurrentListProvider>']
    ])('%s throws when used outside its provider', (_name, hook, provider) => {
        // React reports the error to the console as well as throwing it
        vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => renderHook(() => hook())).toThrow(`must be used inside a ${provider}`);
    });
});

describe('SessionContext', () => {
    /** a SessionProvider on its own, inside the router it needs for logging out, starting at /lists */
    function renderSession() {
        return renderHook(() => ({ session: useSession(), location: useLocation() }), {
            wrapper: ({ children }: { children: ReactNode }) => (
                <MemoryRouter initialEntries={['/lists']}>
                    <SessionProvider>{children}</SessionProvider>
                </MemoryRouter>
            )
        });
    }

    it('does not know who is logged in until the server says', async () => {
        installFakeServer();
        const { result } = renderSession();

        expect(result.current.session.user).toBeUndefined();
        await waitFor(() => expect(result.current.session.user).toEqual(WOLFIE));
    });

    it('asks the server, GET /api/users/me', async () => {
        const server = installFakeServer();
        const { result } = renderSession();

        await waitFor(() => expect(result.current.session.user).toEqual(WOLFIE));
        expect(server.requests.map(({ method, url }) => `${method} ${url}`)).toEqual(['GET /api/users/me']);
    });

    it('knows nobody is logged in when the server says so', async () => {
        installFakeServer([], { loggedIn: false });
        const { result } = renderSession();

        await waitFor(() => expect(result.current.session.user).toBeNull());
    });

    /** the login cannot be checked, so the user is asked to log in rather than left waiting */
    it('takes nobody to be logged in when the server cannot be reached', async () => {
        const server = installFakeServer();
        server.down = true;
        const { result } = renderSession();

        await waitFor(() => expect(result.current.session.user).toBeNull());
    });

    it('forgets the user when the server says the login has run out', async () => {
        const server = installFakeServer();
        const { result } = renderSession();
        await waitFor(() => expect(result.current.session.user).toEqual(WOLFIE));
        server.loggedIn = false;

        // any request at all, answered 401
        await act(() => api.getAllMetadata().catch(() => {}));

        expect(result.current.session.user).toBeNull();
    });

    it('logs out on the server, forgets the user, then leaves for the splash screen', async () => {
        const server = installFakeServer();
        const { result } = renderSession();
        await waitFor(() => expect(result.current.session.user).toEqual(WOLFIE));

        await act(() => result.current.session.logout());

        expect(server.loggedIn).toBe(false);
        expect(result.current.session.user).toBeNull();
        expect(result.current.location.pathname).toBe('/');
    });

    it('leaves for the splash screen even when the server cannot be reached', async () => {
        const server = installFakeServer();
        const { result } = renderSession();
        await waitFor(() => expect(result.current.session.user).toEqual(WOLFIE));
        server.down = true;

        await act(() => result.current.session.logout());

        expect(result.current.session.user).toBeNull();
        expect(result.current.location.pathname).toBe('/');
    });
});

describe('the avatar menu', () => {
    const menuButton = () => screen.getByRole('button', { name: `Account menu for ${WOLFIE.email}` });

    /** opens the home screen, whose header holds the menu, and waits for it */
    async function openHomeScreen() {
        const rendered = renderApp();
        await screen.findByRole('button', { name: /Open the list named Wolfie/ });
        return rendered;
    }

    it('starts closed', async () => {
        await openHomeScreen();

        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens when the avatar is pressed, and shows whose account it is', async () => {
        const { user } = await openHomeScreen();

        await user.click(menuButton());

        expect(screen.getByRole('menu', { name: 'Account' })).toBeInTheDocument();
        expect(document.getElementById('account-menu-email')).toHaveTextContent(WOLFIE.email);
        expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes on Escape', async () => {
        const { user } = await openHomeScreen();
        await user.click(menuButton());

        await user.keyboard('{Escape}');

        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('closes on a click anywhere else, but not on a click inside it', async () => {
        const { user } = await openHomeScreen();
        await user.click(menuButton());

        await user.click(document.getElementById('account-menu-email')!);
        expect(screen.getByRole('menu')).toBeInTheDocument();

        await user.click(document.body);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('closes when the avatar is pressed again', async () => {
        const { user } = await openHomeScreen();
        await user.click(menuButton());
        await user.click(menuButton());

        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('goes to the account page from Account Settings', async () => {
        const { user } = await openHomeScreen();
        await user.click(menuButton());

        await user.click(screen.getByRole('menuitem', { name: 'Account Settings' }));

        expect(await screen.findByRole('heading', { name: 'Your Account' })).toBeInTheDocument();
        expect(currentUrl()).toBe('/account');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('logs out on the server and then goes to the splash screen', async () => {
        const { server, user } = await openHomeScreen();
        await user.click(menuButton());

        await user.click(screen.getByRole('menuitem', { name: 'Log Out' }));

        expect(await screen.findByRole('region', { name: 'Welcome' })).toBeInTheDocument();
        expect(currentUrl()).toBe('/');
        expect(server.requestsOf('POST').map((request) => request.url)).toEqual(['/api/auth/logout']);
        expect(server.loggedIn).toBe(false);
    });
});

describe('the header', () => {
    it('takes the user home from the logo', async () => {
        const { user } = renderApp({ url: '/account' });
        await screen.findByRole('heading', { name: 'Your Account' });

        await user.click(screen.getByRole('link', { name: 'Wolfie Lists, your lists' }));

        expect(await screen.findByRole('button', { name: /Open the list named Wolfie/ })).toBeInTheDocument();
        expect(currentUrl()).toBe('/lists');
    });

    it('does not make a screen reader read the logo as well as the title', async () => {
        renderApp({ url: '/account' });
        const header = await screen.findByRole('banner');

        // an empty alt is how you say "this image is decoration"
        expect(within(header).queryByRole('img')).not.toBeInTheDocument();
    });
});
