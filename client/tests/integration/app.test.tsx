/**
 * app.test.tsx
 *
 * The two list pages talking to the (fake) server: what is loaded when, what
 * is saved, and what happens when the server is not there, refuses, or says
 * the login has run out.
 *
 * THE LOAD BEARING TESTS are in the first group. The home screen gets
 * metadata and nothing more, and a list's items are fetched only when it is
 * opened.
 *
 * Before either page asks for anything, the application asks who is logged
 * in, GET /api/users/me. The first group leaves that request out of its sums.
 */
import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ListDTO } from '@wolfie-lists/shared';
import { currentUrl, renderApp } from '../helpers/harness';
import { CHORES_LIST, WEEKEND_LIST } from '../helpers/fixtures';

const listCards = () => screen.queryAllByRole('button', { name: /^Open the list named/ });

/** what the session and the home screen ask for, so neither is a list's items */
const NOT_A_LIST = ['/api/users/me', '/api/lists'];

async function openWeekend(user: UserEvent) {
    await user.click(await screen.findByRole('button', { name: /Open the list named Wolfie/ }));
    await screen.findByRole('button', { name: 'Edit the item Call home' });
}

/**
 * Opens the account page, which asks the server for nothing but the session,
 * so a test can change the server before the home screen asks it anything.
 * The test then goes home with goHome.
 */
async function startOnAccountPage(lists: ListDTO[] = [WEEKEND_LIST]) {
    const rendered = renderApp({ url: '/account', lists });
    await screen.findByRole('heading', { name: 'Your Account' });
    return rendered;
}

/** the logo in the header, which goes to /lists */
async function goHome(user: UserEvent) {
    await user.click(screen.getByRole('link', { name: 'Wolfie Lists, your lists' }));
}

describe('what each page loads', () => {
    it('asks the server for the metadata only', async () => {
        const { server } = renderApp({ lists: [WEEKEND_LIST, CHORES_LIST] });

        await waitFor(() => expect(listCards()).toHaveLength(2));
        expect(server.requests.every((request) => NOT_A_LIST.includes(request.url))).toBe(true);
    });

    it('does not fetch any list until it is opened', async () => {
        const { server, user } = renderApp({ lists: [WEEKEND_LIST, CHORES_LIST] });
        await waitFor(() => expect(listCards()).toHaveLength(2));

        expect(server.requests.filter((request) => !NOT_A_LIST.includes(request.url))).toEqual([]);

        await openWeekend(user);

        const fetchedLists = server.requestsOf('GET').map((request) => request.url)
            .filter((url) => !NOT_A_LIST.includes(url));
        expect(new Set(fetchedLists)).toEqual(new Set([`/api/lists/${WEEKEND_LIST.id}`]));
    });

    it('fetches the list again every time it is opened', async () => {
        const { server, user } = renderApp();
        await openWeekend(user);
        await user.click(screen.getByRole('button', { name: 'Close this list' }));

        server.list(WEEKEND_LIST.id)!.items[2].description = 'Changed elsewhere';
        await user.click(await screen.findByRole('button', { name: /Open the list named Wolfie/ }));

        expect(await screen.findByRole('button', { name: 'Edit the item Changed elsewhere' }))
            .toBeInTheDocument();
    });

    it('says it is loading while a list is on its way', async () => {
        const { server, user } = renderApp();
        const card = await screen.findByRole('button', { name: /Open the list named Wolfie/ });

        let answer = (_value?: unknown) => {};
        server.wait = new Promise((resolve) => { answer = resolve; });
        await user.click(card);

        expect(await screen.findByText(/Loading this list/)).toBeInTheDocument();
        answer();
        await screen.findByRole('button', { name: 'Edit the item Call home' });
        expect(screen.queryByText(/Loading this list/)).not.toBeInTheDocument();
    });
});

describe('saving', () => {
    it('sends the whole list after an edit', async () => {
        const { server, user } = renderApp();
        await openWeekend(user);

        await user.click(screen.getByRole('button', { name: 'Edit the item Hike the Ashokan rail trail' }));
        await user.clear(await screen.findByLabelText('Description'));
        await user.type(screen.getByLabelText('Description'), 'Hike Bear Mountain');
        await user.click(screen.getByRole('button', { name: 'OK' }));

        await waitFor(() => {
            expect(server.list(WEEKEND_LIST.id)!.items[0].description).toBe('Hike Bear Mountain');
        });
        expect(server.requestsOf('PUT').at(-1)!.body.items).toHaveLength(3);
    });

    it('sends an undo through to the server too', async () => {
        const { server, user } = renderApp();
        await openWeekend(user);

        await user.click(screen.getByRole('button', { name: 'Delete the item Call home' }));
        await user.click(await screen.findByRole('button', { name: 'Delete Item' }));
        await waitFor(() => expect(server.list(WEEKEND_LIST.id)!.items).toHaveLength(2));

        await user.click(screen.getByRole('button', { name: 'Undo' }));
        await waitFor(() => expect(server.list(WEEKEND_LIST.id)!.items).toHaveLength(3));
    });

    it('saves nothing just because a list was opened and closed', async () => {
        const { server, user } = renderApp();
        await openWeekend(user);
        await user.click(screen.getByRole('button', { name: 'Close this list' }));
        await screen.findByRole('button', { name: /Open the list named Wolfie/ });

        expect(server.requestsOf('PUT')).toEqual([]);
    });

    /** the home screen asks the server again when it opens, so it sees the last save */
    it('shows the new counts on the home screen once the list is closed', async () => {
        const { user } = renderApp();
        await openWeekend(user);

        await user.click(screen.getByRole('button', { name: 'Duplicate the item Read chapter four' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled());
        await user.click(screen.getByRole('button', { name: 'Close this list' }));

        expect(await screen.findByText('2 of 4 completed')).toBeInTheDocument();
    });
});

describe('when the server is not there', () => {
    it('says so, and shows the empty home screen', async () => {
        const { server, user } = await startOnAccountPage();
        server.down = true;

        await goHome(user);

        expect(await screen.findByText('Your Lists Could Not Be Loaded')).toBeInTheDocument();
        expect(screen.getByText(/could not be reached/)).toBeInTheDocument();
        expect(await screen.findByText(/do not have any lists yet/i)).toBeInTheDocument();
    });

    it('says so and goes back home when a list cannot be opened', async () => {
        const { server, user } = renderApp();
        await waitFor(() => expect(listCards()).toHaveLength(1));
        server.down = true;

        await user.click(screen.getByRole('button', { name: /Open the list named Wolfie/ }));

        expect(await screen.findByText(/could not be reached/)).toBeInTheDocument();
        await waitFor(() => expect(currentUrl()).toBe('/lists'));
    });

    it('says so when a change cannot be saved, and keeps it on screen', async () => {
        const { server, user } = renderApp();
        await openWeekend(user);
        server.down = true;

        await user.click(screen.getByRole('button', { name: 'Duplicate the item Call home' }));

        expect(await screen.findByText('Changes Were Not Saved')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Edit the item Call home' })).toHaveLength(2);
    });

    it('says so, and changes nothing, when a list cannot be created', async () => {
        const { server, user } = renderApp();
        await waitFor(() => expect(listCards()).toHaveLength(1));
        server.down = true;

        await user.click(screen.getByRole('button', { name: 'Create a new list' }));

        expect(await screen.findByText('The List Could Not Be Created')).toBeInTheDocument();
        expect(listCards()).toHaveLength(1);
        expect(currentUrl()).toBe('/lists');
    });
});

describe('when the server refuses', () => {
    /**
     * Somebody else's list gets the same 404 as one that does not exist, so
     * this is also what a user sees on following a link to another user's list.
     */
    it('says why a list could not be opened, in the server\'s own words, and goes home', async () => {
        const { server, user } = renderApp();
        await waitFor(() => expect(listCards()).toHaveLength(1));
        // deleted behind this client's back
        server.lists = [];

        await user.click(screen.getByRole('button', { name: /Open the list named Wolfie/ }));

        expect(await screen.findByText('The List Could Not Be Opened')).toBeInTheDocument();
        expect(screen.getByText('There is no list with that id.')).toBeInTheDocument();
        expect(await screen.findByText(/do not have any lists yet/i)).toBeInTheDocument();
        expect(currentUrl()).toBe('/lists');
    });

    it('does the same for a list\'s address typed in directly', async () => {
        renderApp({ lists: [], url: '/lists/not-a-real-id' });

        expect(await screen.findByText('The List Could Not Be Opened')).toBeInTheDocument();
        await waitFor(() => expect(currentUrl()).toBe('/lists'));
    });
});

/**
 * A 401 makes the session forget the user, and then the AppLayout guard,
 * finding nobody logged in, sends the browser to the splash screen.
 */
describe('when the login has run out', () => {
    it('goes to the splash screen when the home screen asks for its lists', async () => {
        const { server, user } = await startOnAccountPage();
        server.loggedIn = false;

        await goHome(user);

        expect(await screen.findByRole('region', { name: 'Welcome' })).toBeInTheDocument();
        expect(currentUrl()).toBe('/');
    });

    it('goes to the splash screen when a change is saved', async () => {
        const { server, user } = renderApp();
        await openWeekend(user);
        server.loggedIn = false;

        await user.click(screen.getByRole('button', { name: 'Duplicate the item Call home' }));

        expect(await screen.findByRole('region', { name: 'Welcome' })).toBeInTheDocument();
        expect(currentUrl()).toBe('/');
    });
});
