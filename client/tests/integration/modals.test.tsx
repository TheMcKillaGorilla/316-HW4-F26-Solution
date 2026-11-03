/**
 * modals.test.tsx
 *
 * All three modals, driven through the real list screen.
 *
 * THE LOAD BEARING TESTS are the stacking group (the alert can open on top of
 * the item modal, which must keep what was typed, and Escape talks to the top
 * one only) and the Previous/Next group, which would notice if the key on
 * ItemModal in ItemModalHost were removed.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UserEvent } from '@testing-library/user-event';
import { renderApp } from '../helpers/harness';
import { WEEKEND_LIST } from '../helpers/fixtures';

async function openList() {
    const rendered = renderApp({ lists: [WEEKEND_LIST], url: `/lists/${WEEKEND_LIST.id}` });
    await screen.findByLabelText('The name of this list');
    return rendered;
}

const itemCards = () => screen.queryAllByRole('button', { name: /^Edit the item/ });

/** opens the item modal on one existing item */
async function openItem(user: UserEvent, index: number) {
    await user.click(itemCards()[index]);
    await screen.findByLabelText('Description');
}

describe('the item modal, opened on an existing item', () => {
    it('says which item of how many it is showing', async () => {
        const { user } = await openList();
        await openItem(user, 1);

        expect(screen.getByRole('heading', { name: 'Item 2 of 3' })).toBeInTheDocument();
    });

    it('loads every field from the item', async () => {
        const { user } = await openList();
        await openItem(user, 0);

        expect(screen.getByLabelText('Description'))
            .toHaveValue('Hike the Ashokan rail trail');
        expect(screen.getByLabelText('Date Entered')).toHaveValue('2026-09-01');
        expect(screen.getByLabelText('Priority')).toHaveValue('Medium');
        expect(screen.getByLabelText(/meant to be finished by/)).toHaveValue('2026-09-19');
        expect(screen.getByLabelText('Completed')).not.toBeChecked();
    });

    it('shows a completed item as completed', async () => {
        const { user } = await openList();
        await openItem(user, 1);

        expect(screen.getByLabelText('Completed')).toBeChecked();
    });

    it('leaves the target date live even for a completed item', async () => {
        const { user } = await openList();
        await openItem(user, 1);

        expect(screen.getByLabelText(/meant to be finished by/)).toBeEnabled();
    });

    it('offers the three priorities, most urgent first', async () => {
        const { user } = await openList();
        await openItem(user, 0);

        const options = within(screen.getByLabelText('Priority')).getAllByRole('option');
        expect(options.map((option) => option.textContent)).toEqual(['High', 'Medium', 'Low']);
    });

    it('starts with the caret in the description, selected', async () => {
        const { user } = await openList();
        await openItem(user, 0);

        const description = screen.getByLabelText<HTMLInputElement>('Description');
        await waitFor(() => expect(description).toHaveFocus());
        expect(description.selectionEnd).toBe('Hike the Ashokan rail trail'.length);
    });

    it('saves the changes when OK is pressed', async () => {
        const { user } = await openList();
        await openItem(user, 0);

        await user.clear(screen.getByLabelText('Description'));
        await user.type(screen.getByLabelText('Description'), 'Hike Bear Mountain');
        await user.click(screen.getByRole('button', { name: 'OK' }));

        await waitFor(() => expect(screen.queryByLabelText('Description')).not.toBeInTheDocument());
        expect(itemCards()[0]).toHaveTextContent('Hike Bear Mountain');
    });

    it('changes nothing when Cancel is pressed', async () => {
        const { user } = await openList();
        await openItem(user, 0);

        await user.clear(screen.getByLabelText('Description'));
        await user.type(screen.getByLabelText('Description'), 'Something Else');
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        await waitFor(() => expect(screen.queryByLabelText('Description')).not.toBeInTheDocument());
        expect(itemCards()[0]).toHaveTextContent('Hike the Ashokan rail trail');
        expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    });

    it('changes nothing when Escape is pressed', async () => {
        const { user } = await openList();
        await openItem(user, 0);

        await user.clear(screen.getByLabelText('Description'));
        await user.type(screen.getByLabelText('Description'), 'Something Else');
        await user.keyboard('{Escape}');

        await waitFor(() => expect(screen.queryByLabelText('Description')).not.toBeInTheDocument());
        expect(itemCards()[0]).toHaveTextContent('Hike the Ashokan rail trail');
    });

    it('treats Enter in the form as OK', async () => {
        const { user } = await openList();
        await openItem(user, 0);

        await user.clear(screen.getByLabelText('Description'));
        await user.type(screen.getByLabelText('Description'), 'Hike Bear Mountain{Enter}');

        await waitFor(() => expect(screen.queryByLabelText('Description')).not.toBeInTheDocument());
        expect(itemCards()[0]).toHaveTextContent('Hike Bear Mountain');
    });

    it('records the edit as undoable', async () => {
        const { user } = await openList();
        await openItem(user, 0);

        await user.clear(screen.getByLabelText('Description'));
        await user.type(screen.getByLabelText('Description'), 'Hike Bear Mountain');
        await user.click(screen.getByRole('button', { name: 'OK' }));

        await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled());
        await user.click(screen.getByRole('button', { name: 'Undo' }));

        await waitFor(() => expect(itemCards()[0])
            .toHaveTextContent('Hike the Ashokan rail trail'));
    });

    it('can mark an item completed from the checkbox', async () => {
        const { user } = await openList();
        await openItem(user, 0);

        await user.click(screen.getByLabelText('Completed'));
        await user.click(screen.getByRole('button', { name: 'OK' }));

        await waitFor(() => expect(itemCards()[0]).toHaveAttribute('aria-label',
            'Edit the item Hike the Ashokan rail trail, completed'));
    });
});

describe('the item modal, opened for a new item', () => {
    it('opens empty, and calls itself New Item', async () => {
        const { user } = await openList();
        await user.click(screen.getByRole('button', { name: 'Add a new item' }));

        expect(await screen.findByRole('heading', { name: 'New Item' })).toBeInTheDocument();
        expect(screen.getByLabelText('Description')).toHaveValue('');
        expect(screen.getByLabelText('Completed')).not.toBeChecked();
    });

    it('offers Add rather than OK', async () => {
        const { user } = await openList();
        await user.click(screen.getByRole('button', { name: 'Add a new item' }));

        expect(await screen.findByRole('button', { name: 'Add' })).toBeInTheDocument();
    });

    /**
     * Previous and Next are meaningless while describing an item that does not
     * exist yet, so they are switched off.
     */
    it('switches Previous and Next off', async () => {
        const { user } = await openList();
        await user.click(screen.getByRole('button', { name: 'Add a new item' }));

        await screen.findByLabelText('Description');
        expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();
    });

    it('adds the item at the end of the list', async () => {
        const { user } = await openList();
        await user.click(screen.getByRole('button', { name: 'Add a new item' }));

        await user.type(await screen.findByLabelText('Description'), 'Buy groceries');
        await user.click(screen.getByRole('button', { name: 'Add' }));

        await waitFor(() => expect(itemCards()).toHaveLength(4));
        expect(itemCards()[3]).toHaveTextContent('Buy groceries');
    });

    it('creates nothing at all if Cancel is pressed', async () => {
        const { user } = await openList();
        await user.click(screen.getByRole('button', { name: 'Add a new item' }));

        await user.type(await screen.findByLabelText('Description'), 'Buy groceries');
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        await waitFor(() => expect(screen.queryByLabelText('Description')).not.toBeInTheDocument());
        expect(itemCards()).toHaveLength(3);
    });
});

describe('Previous and Next', () => {
    it('are switched off at the ends of the list', async () => {
        const { user } = await openList();

        await openItem(user, 0);
        expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Next/ })).toBeEnabled();

        await user.keyboard('{Escape}');
        await openItem(user, 2);
        expect(screen.getByRole('button', { name: /Previous/ })).toBeEnabled();
        expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();
    });

    /**
     * THE LOAD BEARING ONE. Without the key in ModalLayer, the heading would
     * update and the fields would not, so this test would show item 1's text
     * under the words "Item 2 of 3".
     */
    it('reloads every field when moving to the next item', async () => {
        const { user } = await openList();
        await openItem(user, 0);

        await user.click(screen.getByRole('button', { name: /Next/ }));

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Item 2 of 3' })).toBeInTheDocument();
        });
        expect(screen.getByLabelText('Description')).toHaveValue('Read chapter four');
        expect(screen.getByLabelText('Priority')).toHaveValue('High');
        expect(screen.getByLabelText('Completed')).toBeChecked();
    });

    it('reloads every field when moving to the previous item', async () => {
        const { user } = await openList();
        await openItem(user, 2);

        await user.click(screen.getByRole('button', { name: /Previous/ }));

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Item 2 of 3' })).toBeInTheDocument();
        });
        expect(screen.getByLabelText('Description')).toHaveValue('Read chapter four');
    });

    /**
     * The point of Previous and Next: a whole list can be corrected in one
     * visit, and every fix is its own step of undo.
     */
    it('saves the current item before moving on', async () => {
        const { user } = await openList();
        await openItem(user, 0);

        await user.clear(screen.getByLabelText('Description'));
        await user.type(screen.getByLabelText('Description'), 'Hike Bear Mountain');
        await user.click(screen.getByRole('button', { name: /Next/ }));

        await waitFor(() => {
            expect(screen.getByLabelText('Description')).toHaveValue('Read chapter four');
        });

        await user.keyboard('{Escape}');
        await waitFor(() => expect(itemCards()[0]).toHaveTextContent('Hike Bear Mountain'));
    });

    it('records one undo step per fix, so each can be undone on its own', async () => {
        const { user } = await openList();
        await openItem(user, 0);

        await user.clear(screen.getByLabelText('Description'));
        await user.type(screen.getByLabelText('Description'), 'First fix');
        await user.click(screen.getByRole('button', { name: /Next/ }));

        await waitFor(() => {
            expect(screen.getByLabelText('Description')).toHaveValue('Read chapter four');
        });
        await user.clear(screen.getByLabelText('Description'));
        await user.type(screen.getByLabelText('Description'), 'Second fix');
        await user.click(screen.getByRole('button', { name: 'OK' }));

        await waitFor(() => expect(itemCards()[1]).toHaveTextContent('Second fix'));

        await user.click(screen.getByRole('button', { name: 'Undo' }));
        await waitFor(() => expect(itemCards()[1]).toHaveTextContent('Read chapter four'));
        // the first fix is still standing, which is the whole point
        expect(itemCards()[0]).toHaveTextContent('First fix');
    });
});

describe('an item with no description', () => {
    it('is refused, with the informative modal saying why', async () => {
        const { user } = await openList();
        await user.click(screen.getByRole('button', { name: 'Add a new item' }));
        await screen.findByLabelText('Description');

        await user.click(screen.getByRole('button', { name: 'Add' }));

        expect(await screen.findByText('A Description Is Required')).toBeInTheDocument();
        expect(itemCards()).toHaveLength(3);
    });

    it('counts a description of nothing but spaces as no description', async () => {
        const { user } = await openList();
        await user.click(screen.getByRole('button', { name: 'Add a new item' }));

        await user.type(await screen.findByLabelText('Description'), '    ');
        await user.click(screen.getByRole('button', { name: 'Add' }));

        expect(await screen.findByText('A Description Is Required')).toBeInTheDocument();
    });

    /**
     * THE LOAD BEARING ONE. The informative modal opens ON TOP of the item
     * editor rather than replacing it, so the user does not lose what they had
     * typed into the other fields.
     */
    it('leaves the item modal open underneath, with its values intact', async () => {
        const { user } = await openList();
        await user.click(screen.getByRole('button', { name: 'Add a new item' }));

        await screen.findByLabelText('Description');
        await user.selectOptions(screen.getByLabelText('Priority'), 'High');
        await user.click(screen.getByRole('button', { name: 'Add' }));

        await screen.findByText('A Description Is Required');

        // still there, still remembering the priority that was chosen
        expect(screen.getByLabelText('Description')).toBeInTheDocument();
        expect(screen.getByLabelText('Priority')).toHaveValue('High');
    });

    it('lets the user carry on once the informative modal is dismissed', async () => {
        const { user } = await openList();
        await user.click(screen.getByRole('button', { name: 'Add a new item' }));
        await screen.findByLabelText('Description');
        await user.click(screen.getByRole('button', { name: 'Add' }));

        await user.click(await screen.findByRole('button', { name: 'OK' }));
        await waitFor(() =>
            expect(screen.queryByText('A Description Is Required')).not.toBeInTheDocument());

        await user.type(screen.getByLabelText('Description'), 'Buy groceries');
        await user.click(screen.getByRole('button', { name: 'Add' }));

        await waitFor(() => expect(itemCards()).toHaveLength(4));
    });
});

describe('the warning modal', () => {
    it('starts with focus on Cancel rather than on the destructive button', async () => {
        const { user } = await openList();

        await user.click(screen.getByRole('button', { name: 'Delete the item Call home' }));

        const cancel = await screen.findByRole('button', { name: 'Cancel' });
        await waitFor(() => expect(cancel).toHaveFocus());
    });

    it('declines on Escape', async () => {
        const { user } = await openList();

        await user.click(screen.getByRole('button', { name: 'Delete the item Call home' }));
        await screen.findByText('Delete This Item?');
        await user.keyboard('{Escape}');

        await waitFor(() =>
            expect(screen.queryByText('Delete This Item?')).not.toBeInTheDocument());
        expect(itemCards()).toHaveLength(3);
    });
});

describe('clicking the backdrop', () => {
    /**
     * Deliberately not "close". A modal exists to insist on an answer, and
     * quietly throwing away a half finished edit because the user clicked
     * slightly outside the box is unkind.
     */
    it('does not close the modal', async () => {
        const { user } = await openList();
        await openItem(user, 0);

        await user.click(document.getElementById('modal-backdrop')!);

        expect(screen.getByLabelText('Description')).toBeInTheDocument();
    });
});

describe('focus', () => {
    /**
     * Being able to tab to the buttons of the screen behind a modal defeats the
     * entire point of one.
     */
    it('is trapped inside the modal, wrapping round at the end', async () => {
        const { user } = await openList();
        await openItem(user, 0);

        const modal = document.getElementById('item-modal')!;
        for (let press = 0; press < 12; press++) {
            await user.tab();
            expect(modal.contains(document.activeElement)).toBe(true);
        }
    });

    it('goes back to where it came from when the modal closes', async () => {
        const { user } = await openList();

        const deleteButton = screen.getByRole('button', { name: 'Delete the item Call home' });
        await user.click(deleteButton);
        await screen.findByText('Delete This Item?');
        await user.keyboard('{Escape}');

        await waitFor(() => expect(deleteButton).toHaveFocus());
    });
});
