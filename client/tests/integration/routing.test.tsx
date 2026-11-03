/**
 * routing.test.tsx
 *
 * The routes in App.tsx and the two layouts that guard them: who may see
 * which page, where everybody else is sent, and what happens at a URL that
 * matches no route.
 *
 * Every test opens the whole application at a URL, the way typing that URL
 * into the address bar would, and checks where it ended up by what is on
 * screen and by currentUrl().
 */
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { currentUrl, renderApp } from '../helpers/harness';
import { WEEKEND_LIST } from '../helpers/fixtures';

const splashScreen = () => screen.findByRole('region', { name: 'Welcome' });
const homeScreen = () => screen.findByRole('button', { name: /Open the list named Wolfie/ });

describe('before the server has said who is logged in', () => {
    /** the session is undefined, "not known yet", on the very first render */
    it('says Loading… instead of a page behind the login', async () => {
        renderApp({ url: '/lists' });

        expect(screen.getByText('Loading…')).toBeInTheDocument();
        expect(screen.queryByRole('banner')).not.toBeInTheDocument();

        await homeScreen();
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });

    /** so a logged in user never sees the splash screen flash past on the way to their lists */
    it('shows nothing of a public page', async () => {
        renderApp({ url: '/' });

        expect(screen.queryByRole('region', { name: 'Welcome' })).not.toBeInTheDocument();

        await homeScreen();
        expect(currentUrl()).toBe('/lists');
    });
});

describe('the AppLayout guard', () => {
    it.each(['/lists', `/lists/${WEEKEND_LIST.id}`, '/account'])(
        'sends a visitor who is not logged in from %s to the splash screen', async (url) => {
            const { server } = renderApp({ url, loggedIn: false });

            expect(await splashScreen()).toBeInTheDocument();
            expect(currentUrl()).toBe('/');
            // the page was never drawn, so it never asked the server for anything
            expect(server.requests.every((request) => request.url === '/api/users/me')).toBe(true);
        });

    it.each([
        ['/lists', 'Create a new list'],
        [`/lists/${WEEKEND_LIST.id}`, 'Close this list'],
        ['/account', 'Change Password']
    ])('lets a logged in user see %s', async (url, button) => {
        renderApp({ url });

        expect(await screen.findByRole('button', { name: button })).toBeInTheDocument();
        expect(screen.getByRole('banner')).toBeInTheDocument();
        expect(currentUrl()).toBe(url);
    });
});

describe('the PublicLayout guard', () => {
    it.each(['/', '/login', '/register'])('sends a logged in user from %s to their lists', async (url) => {
        renderApp({ url });

        expect(await homeScreen()).toBeInTheDocument();
        expect(currentUrl()).toBe('/lists');
    });

    it.each([
        ['/', 'Wolfie Lists'],
        ['/login', 'Log In'],
        ['/register', 'Create an Account']
    ])('lets a visitor who is not logged in see %s', async (url, heading) => {
        renderApp({ url, loggedIn: false });

        expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
        expect(currentUrl()).toBe(url);
    });

    /** with no answer at all, nobody is taken to be logged in, rather than Loading… forever */
    it('shows the splash screen when the server cannot be reached at all', async () => {
        const { server } = renderApp({ url: '/' });
        server.down = true;

        expect(await splashScreen()).toBeInTheDocument();
    });
});

describe('the links between the public pages', () => {
    it.each([
        ['Log In', '/login', 'Log In'],
        ['Create Account', '/register', 'Create an Account']
    ])('the splash screen\'s %s goes to %s', async (link, url, heading) => {
        const { user } = renderApp({ url: '/', loggedIn: false });

        await user.click(await screen.findByRole('link', { name: link }));

        expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
        expect(currentUrl()).toBe(url);
    });

    it.each(['/login', '/register'])('the logo above %s goes back to the splash screen', async (url) => {
        const { user } = renderApp({ url, loggedIn: false });

        await user.click(await screen.findByRole('link', { name: 'Back to the Wolfie Lists welcome page' }));

        expect(await splashScreen()).toBeInTheDocument();
        expect(currentUrl()).toBe('/');
    });
});

describe('a URL that matches no route', () => {
    /** /lists/a/b is not /lists/:id, since a parameter is one part of the URL only */
    it.each(['/nowhere', '/lists/a/b'])('shows the not found page at %s', async (url) => {
        renderApp({ url, loggedIn: false });

        expect(await screen.findByRole('heading', { name: 'There is no page here.' })).toBeInTheDocument();
        expect(currentUrl()).toBe(url);
    });

    it('links to the splash screen, for a visitor', async () => {
        const { user } = renderApp({ url: '/nowhere', loggedIn: false });

        await user.click(await screen.findByRole('link', { name: 'Go to Wolfie Lists' }));

        expect(await splashScreen()).toBeInTheDocument();
    });

    /** the same link, and the PublicLayout guard sends them on */
    it('links to the lists, for a logged in user', async () => {
        const { user } = renderApp({ url: '/nowhere' });

        await user.click(await screen.findByRole('link', { name: 'Go to Wolfie Lists' }));

        expect(await homeScreen()).toBeInTheDocument();
        expect(currentUrl()).toBe('/lists');
    });
});

describe('the title in the browser tab', () => {
    it.each([
        ['/', false, 'Wolfie Lists'],
        ['/login', false, 'Log In · Wolfie Lists'],
        ['/register', false, 'Create an Account · Wolfie Lists'],
        ['/nowhere', false, 'Not Found · Wolfie Lists'],
        ['/lists', true, 'Your Lists · Wolfie Lists'],
        [`/lists/${WEEKEND_LIST.id}`, true, 'Editing a List · Wolfie Lists'],
        ['/account', true, 'Account Settings · Wolfie Lists']
    ])('at %s is the page\'s own', async (url, loggedIn, title) => {
        renderApp({ url, loggedIn });

        // React 19 moves a <title> rendered anywhere into the document's <head>
        await waitFor(() => expect(document.title).toBe(title));
    });
});
