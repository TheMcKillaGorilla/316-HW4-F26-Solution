/**
 * ListsContainer.test.tsx
 *
 * The home screen at /lists, driven the way a user drives it: by finding
 * controls the way a user would find them and clicking them.
 *
 * The queries find controls by role and accessible name, the way a screen
 * reader does, so a button that loses its label fails a test.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { currentUrl, renderApp } from '../helpers/harness';
import { CHORES_LIST, EMPTY_LIST, WEEKEND_LIST } from '../helpers/fixtures';

/** every list card on screen, in the order they are drawn */
const listCards = () => screen.getAllByRole('button', { name: /^Open the list named/ });

describe('drawing the lists', () => {
    it('shows one card per list, in order', async () => {
        renderApp({ lists: [WEEKEND_LIST, CHORES_LIST] });

        await waitFor(() => expect(listCards()).toHaveLength(2));
        expect(listCards()[0]).toHaveTextContent("Wolfie's Weekend");
        expect(listCards()[1]).toHaveTextContent('Chores');
    });

    it('says how much of each list is done', async () => {
        renderApp({ lists: [WEEKEND_LIST] });

        // one of the three weekend items is completed
        await screen.findByText('1 of 3 completed');
    });

    it('says so plainly when a list has no items at all', async () => {
        renderApp({ lists: [EMPTY_LIST] });
        await screen.findByText('No items yet');
    });

    it('says it is loading until the server has answered', async () => {
        // start on the account page, so the lists can be held back on their way
        const { server, user } = renderApp({ url: '/account', lists: [] });
        await screen.findByRole('heading', { name: 'Your Account' });
        let answer = (_value?: unknown) => {};
        server.wait = new Promise((resolve) => { answer = resolve; });

        await user.click(screen.getByRole('link', { name: /Back to your lists/ }));

        expect(await screen.findByText('Loading your lists…')).toBeInTheDocument();
        answer();
        await screen.findByText(/do not have any lists yet/i);
        expect(screen.queryByText('Loading your lists…')).not.toBeInTheDocument();
    });

    it('invites the user to start when there are no lists', async () => {
        renderApp({ lists: [] });
        await screen.findByText(/do not have any lists yet/i);
    });

    it('does not show the empty message once a list exists', async () => {
        renderApp({ lists: [WEEKEND_LIST] });

        await waitFor(() => expect(listCards()).toHaveLength(1));
        expect(screen.queryByText(/do not have any lists yet/i)).not.toBeInTheDocument();
    });
});

describe('opening a list', () => {
    it('goes to the list\'s own page when a card is clicked', async () => {
        const { user } = renderApp({ lists: [WEEKEND_LIST] });

        await user.click(await screen.findByRole('button', { name: /Open the list named Wolfie/ }));

        await waitFor(() => expect(currentUrl()).toBe('/lists/list-weekend'));
        expect(await screen.findByLabelText('The name of this list'))
            .toHaveValue("Wolfie's Weekend");
    });

    it('opens on Enter as well as on a click, since a card is focusable', async () => {
        const { user } = renderApp({ lists: [WEEKEND_LIST] });

        const card = await screen.findByRole('button', { name: /Open the list named Wolfie/ });
        card.focus();
        await user.keyboard('{Enter}');

        expect(await screen.findByLabelText('The name of this list')).toBeInTheDocument();
    });
});

describe('creating a list', () => {
    it('makes a list and opens it straight away, marked as new', async () => {
        const { user } = renderApp({ lists: [] });
        await screen.findByText(/do not have any lists yet/i);

        await user.click(screen.getByRole('button', { name: 'Create a new list' }));

        expect(await screen.findByLabelText('The name of this list'))
            .toHaveValue('Untitled List');
        expect(currentUrl()).toBe('/lists/server-list-1?new');
    });

    /** naming a new list should be simply the next thing the user types */
    it('puts the caret in the name field with the name selected', async () => {
        const { user } = renderApp({ lists: [] });
        await screen.findByText(/do not have any lists yet/i);

        await user.click(screen.getByRole('button', { name: 'Create a new list' }));

        const nameInput = await screen.findByLabelText<HTMLInputElement>('The name of this list');
        await waitFor(() => expect(nameInput).toHaveFocus());
        expect(nameInput.selectionStart).toBe(0);
        expect(nameInput.selectionEnd).toBe('Untitled List'.length);
    });

    it('does not reuse a name that is already taken', async () => {
        const { user } = renderApp({ lists: [] });
        await screen.findByText(/do not have any lists yet/i);

        await user.click(screen.getByRole('button', { name: 'Create a new list' }));
        await screen.findByLabelText('The name of this list');
        await user.click(screen.getByRole('button', { name: 'Close this list' }));

        await user.click(await screen.findByRole('button', { name: 'Create a new list' }));

        expect(await screen.findByLabelText('The name of this list'))
            .toHaveValue('Untitled List 2');
    });
});

describe('duplicating a list', () => {
    it('files the copy directly beneath the original', async () => {
        const { user } = renderApp({ lists: [WEEKEND_LIST, CHORES_LIST] });
        await waitFor(() => expect(listCards()).toHaveLength(2));

        await user.click(screen.getByRole('button',
            { name: "Duplicate the list named Wolfie's Weekend" }));

        await waitFor(() => expect(listCards()).toHaveLength(3));
        expect(listCards()[1]).toHaveTextContent("Wolfie's Weekend (Copy)");
        expect(listCards()[2]).toHaveTextContent('Chores');
    });

    it('copies the items too', async () => {
        const { user } = renderApp({ lists: [WEEKEND_LIST] });
        await waitFor(() => expect(listCards()).toHaveLength(1));

        await user.click(screen.getByRole('button',
            { name: "Duplicate the list named Wolfie's Weekend" }));

        await waitFor(() => expect(listCards()).toHaveLength(2));
        expect(within(listCards()[1]).getByText('1 of 3 completed')).toBeInTheDocument();
    });

    it('does not open the list it was asked to duplicate', async () => {
        const { user } = renderApp({ lists: [WEEKEND_LIST] });
        await waitFor(() => expect(listCards()).toHaveLength(1));

        await user.click(screen.getByRole('button',
            { name: "Duplicate the list named Wolfie's Weekend" }));

        await waitFor(() => expect(listCards()).toHaveLength(2));
        expect(currentUrl()).toBe('/lists');
        expect(screen.queryByLabelText('The name of this list')).not.toBeInTheDocument();
    });
});

describe('deleting a list', () => {
    it('asks first, and says that it cannot be undone', async () => {
        const { user } = renderApp({ lists: [WEEKEND_LIST] });
        await waitFor(() => expect(listCards()).toHaveLength(1));

        await user.click(screen.getByRole('button',
            { name: "Delete the list named Wolfie's Weekend" }));

        expect(await screen.findByText('Delete This List?')).toBeInTheDocument();
        expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
        // and nothing has actually happened yet
        expect(listCards()).toHaveLength(1);
    });

    it('deletes it once the warning is accepted', async () => {
        const { user } = renderApp({ lists: [WEEKEND_LIST, CHORES_LIST] });
        await waitFor(() => expect(listCards()).toHaveLength(2));

        await user.click(screen.getByRole('button',
            { name: "Delete the list named Wolfie's Weekend" }));
        await user.click(await screen.findByRole('button', { name: 'Delete List' }));

        await waitFor(() => expect(listCards()).toHaveLength(1));
        expect(listCards()[0]).toHaveTextContent('Chores');
    });

    it('leaves it alone if the warning is declined', async () => {
        const { user } = renderApp({ lists: [WEEKEND_LIST] });
        await waitFor(() => expect(listCards()).toHaveLength(1));

        await user.click(screen.getByRole('button',
            { name: "Delete the list named Wolfie's Weekend" }));
        await user.click(await screen.findByRole('button', { name: 'Cancel' }));

        await waitFor(() =>
            expect(screen.queryByText('Delete This List?')).not.toBeInTheDocument());
        expect(listCards()).toHaveLength(1);
    });

    it('deletes it on the server, not just on screen', async () => {
        const { server, user } = renderApp({ lists: [WEEKEND_LIST] });
        await waitFor(() => expect(listCards()).toHaveLength(1));

        await user.click(screen.getByRole('button',
            { name: "Delete the list named Wolfie's Weekend" }));
        await user.click(await screen.findByRole('button', { name: 'Delete List' }));

        await waitFor(() => expect(server.lists).toEqual([]));
        expect(server.requestsOf('DELETE')[0].url).toBe(`/api/lists/${WEEKEND_LIST.id}`);
    });
});

describe('the buttons on a card', () => {
    /**
     * The two buttons live inside a card that is itself clickable, so without
     * stopPropagation pressing delete would also open the thing being deleted.
     */
    it('do not also open the list', async () => {
        const { user } = renderApp({ lists: [WEEKEND_LIST] });
        await waitFor(() => expect(listCards()).toHaveLength(1));

        await user.click(screen.getByRole('button',
            { name: "Delete the list named Wolfie's Weekend" }));

        await screen.findByText('Delete This List?');
        expect(currentUrl()).toBe('/lists');
    });
});

describe('what a screen reader is told', () => {
    it('gives every card and every button an accessible name', async () => {
        renderApp({ lists: [CHORES_LIST] });

        expect(await screen.findByRole('button', { name: 'Open the list named Chores' }))
            .toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Duplicate the list named Chores' }))
            .toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete the list named Chores' }))
            .toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create a new list' })).toBeInTheDocument();
    });
});
