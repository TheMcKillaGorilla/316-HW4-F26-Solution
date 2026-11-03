/**
 * ListEditor.test.tsx
 *
 * The list screen at /lists/:id (ListEditorContainer and ListEditorView),
 * driven the way a user drives it.
 *
 * THE LOAD BEARING TESTS IN THIS FILE are the drag and drop arithmetic ones.
 * They prove the half of drag and drop that can be proved without a browser:
 * given a cursor at a particular position over a particular card, does the view
 * work out the right destination index, including the off-by-one adjustment for
 * the dragged card being removed before it is reinserted.
 *
 * The other half, that Chrome will begin the drag, permit the drop, and deliver
 * a cursor where we think, is in the end to end tests. Neither is sufficient alone.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ListDTO } from '@wolfie-lists/shared';
import { currentUrl, renderApp } from '../helpers/harness';
import { EMPTY_LIST, WEEKEND_LIST } from '../helpers/fixtures';
import {
    dispatchDragEvent,
    fakeDataTransfer,
    stackCards,
    yAboveMidlineOf,
    yBelowMidlineOf
} from '../helpers/layout';

/**
 * Goes straight to a list's page and waits until it has loaded.
 *
 * @returns the render result
 */
async function openList(list: ListDTO = WEEKEND_LIST) {
    const rendered = renderApp({ lists: [list], url: `/lists/${list.id}` });
    await screen.findByLabelText('The name of this list');
    return rendered;
}

/** every item card on screen, in the order they are drawn */
const itemCards = () => screen.queryAllByRole('button', { name: /^Edit the item/ });

const descriptionsOnScreen = () =>
    itemCards().map((card) => card.querySelector('.item-description')?.textContent);


describe('drawing the items', () => {
    it('shows one card per item, in order', async () => {
        await openList();

        expect(descriptionsOnScreen()).toEqual([
            'Hike the Ashokan rail trail', 'Read chapter four', 'Call home'
        ]);
    });

    it('shows every column of an item', async () => {
        await openList();
        const card = itemCards()[0];

        expect(within(card).getByText('09/01/2026')).toBeInTheDocument();  // date entered
        expect(within(card).getByText('Medium')).toBeInTheDocument();      // priority
        expect(within(card).getByText('09/19/2026')).toBeInTheDocument();  // target date
    });

    it('shows an em dash where an item has no target date', async () => {
        await openList();
        expect(within(itemCards()[1]).getByText('—')).toBeInTheDocument();
    });

    it('marks a completed item as completed, for a screen reader too', async () => {
        await openList();

        expect(itemCards()[1]).toHaveAttribute('aria-label',
            'Edit the item Read chapter four, completed');
        expect(itemCards()[0]).toHaveAttribute('aria-label',
            'Edit the item Hike the Ashokan rail trail');
    });

    it('shows the column headers above the cards', async () => {
        await openList();

        for (const heading of ['Task', 'Date Entered', 'Priority', 'Target Date', 'Completed']) {
            expect(screen.getByText(heading)).toBeInTheDocument();
        }
    });

    it('says so plainly when a list is empty, and drops the headers with it', async () => {
        await openList(EMPTY_LIST);

        expect(await screen.findByText(/This list is empty/i)).toBeInTheDocument();
        expect(screen.queryByText('Task')).not.toBeInTheDocument();
    });
});

describe('leaving the list', () => {
    it('goes home when close is pressed', async () => {
        const { user } = await openList();
        await user.click(screen.getByRole('button', { name: 'Close this list' }));

        await waitFor(() => expect(currentUrl()).toBe('/lists'));
        expect(await screen.findByRole('button', { name: /Open the list named Wolfie/ }))
            .toBeInTheDocument();
    });

    /**
     * The Wolfie in the corner is a second way of doing exactly what close does,
     * and calls the very same function rather than one of its own.
     */
    it('goes home when the Wolfie in the corner is pressed', async () => {
        const { user } = await openList();
        await user.click(screen.getByRole('button',
            { name: 'Close this list and return to the home screen' }));

        await waitFor(() => expect(currentUrl()).toBe('/lists'));
        expect(await screen.findByRole('button', { name: /Open the list named Wolfie/ }))
            .toBeInTheDocument();
    });
});

describe('the name field when a list opens', () => {
    /** only a brand new list (/lists/:id?new) wants its name typed over */
    it('is left alone for a list that already existed', async () => {
        await openList();
        expect(screen.getByLabelText('The name of this list')).not.toHaveFocus();
    });

    it('arrives focused and selected for a brand new one', async () => {
        renderApp({ lists: [EMPTY_LIST], url: `/lists/${EMPTY_LIST.id}?new` });

        const nameInput = await screen.findByLabelText<HTMLInputElement>('The name of this list');
        await waitFor(() => expect(nameInput).toHaveFocus());
        expect(nameInput.selectionStart).toBe(0);
        expect(nameInput.selectionEnd).toBe(EMPTY_LIST.name.length);
    });
});

describe('renaming the list', () => {
    it('renames on Enter', async () => {
        const { user } = await openList();
        const nameInput = screen.getByLabelText('The name of this list');

        await user.clear(nameInput);
        await user.type(nameInput, 'Weekend Plans{Enter}');

        await waitFor(() => {
            expect(screen.getByLabelText('The name of this list')).toHaveValue('Weekend Plans');
        });
    });

    it('renames on leaving the field', async () => {
        const { user } = await openList();
        const nameInput = screen.getByLabelText('The name of this list');

        await user.clear(nameInput);
        await user.type(nameInput, 'Weekend Plans');
        await user.tab();

        await waitFor(() => {
            expect(screen.getByLabelText('The name of this list')).toHaveValue('Weekend Plans');
        });
    });

    /**
     * One undo step per rename, not one per keystroke. This is the reason the
     * name field is uncontrolled, and the reason is worth a test of its own.
     */
    it('files one undoable rename however many letters were typed', async () => {
        const { user } = await openList();
        const nameInput = screen.getByLabelText('The name of this list');

        await user.clear(nameInput);
        await user.type(nameInput, 'Weekend Plans{Enter}');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled());

        await user.click(screen.getByRole('button', { name: 'Undo' }));

        await waitFor(() => {
            expect(screen.getByLabelText('The name of this list')).toHaveValue("Wolfie's Weekend");
        });
        expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    });

    it('puts the old name back on Escape, without recording anything', async () => {
        const { user } = await openList();
        const nameInput = screen.getByLabelText('The name of this list');

        await user.clear(nameInput);
        await user.type(nameInput, 'Something Else{Escape}');

        await waitFor(() => {
            expect(screen.getByLabelText('The name of this list')).toHaveValue("Wolfie's Weekend");
        });
        expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    });

    it('falls back to the default name when the field is emptied', async () => {
        const { user } = await openList();
        const nameInput = screen.getByLabelText('The name of this list');

        await user.clear(nameInput);
        await user.tab();

        await waitFor(() => {
            expect(screen.getByLabelText('The name of this list')).toHaveValue('Untitled List');
        });
    });
});

describe('undo and redo buttons', () => {
    it('start disabled, because a freshly opened list has no history', async () => {
        await openList();

        expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
    });

    it('enable and disable as the stack moves', async () => {
        const { user } = await openList();

        await user.click(screen.getByRole('button',
            { name: 'Duplicate the item Hike the Ashokan rail trail' }));

        await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled());
        expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();

        await user.click(screen.getByRole('button', { name: 'Undo' }));

        await waitFor(() => expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled());
        expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    });

    /**
     * Undo must never reach back into a list the user has left. The provider
     * holding the history is unmounted when the list closes, so it cannot.
     */
    it('forget everything when a list is closed and another is opened', async () => {
        const { user } = await openList();

        await user.click(screen.getByRole('button',
            { name: 'Duplicate the item Hike the Ashokan rail trail' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled());

        await user.click(screen.getByRole('button', { name: 'Close this list' }));
        await user.click(await screen.findByRole('button', { name: /Open the list named Wolfie/ }));

        expect(await screen.findByRole('button', { name: 'Undo' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
    });
});

describe('keyboard shortcuts', () => {
    it('undoes with Ctrl+Z and redoes with Ctrl+Y', async () => {
        const { user } = await openList();

        await user.click(screen.getByRole('button',
            { name: 'Duplicate the item Hike the Ashokan rail trail' }));
        await waitFor(() => expect(itemCards()).toHaveLength(4));

        await user.keyboard('{Control>}z{/Control}');
        await waitFor(() => expect(itemCards()).toHaveLength(3));

        await user.keyboard('{Control>}y{/Control}');
        await waitFor(() => expect(itemCards()).toHaveLength(4));
    });

    it('also redoes with Ctrl+Shift+Z', async () => {
        const { user } = await openList();

        await user.click(screen.getByRole('button',
            { name: 'Duplicate the item Hike the Ashokan rail trail' }));
        await waitFor(() => expect(itemCards()).toHaveLength(4));

        await user.keyboard('{Control>}z{/Control}');
        await waitFor(() => expect(itemCards()).toHaveLength(3));

        await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
        await waitFor(() => expect(itemCards()).toHaveLength(4));
    });

    /**
     * While the caret is in a text field, Ctrl+Z belongs to the browser and
     * means "undo my typing", not "undo my last list edit".
     */
    it('leaves Ctrl+Z alone while the caret is in a text field', async () => {
        const { user } = await openList();

        await user.click(screen.getByRole('button',
            { name: 'Duplicate the item Hike the Ashokan rail trail' }));
        await waitFor(() => expect(itemCards()).toHaveLength(4));

        screen.getByLabelText('The name of this list').focus();
        await user.keyboard('{Control>}z{/Control}');

        expect(itemCards()).toHaveLength(4);
    });

    it('leaves Ctrl+Z alone while a modal is up', async () => {
        const { user } = await openList();

        await user.click(screen.getByRole('button',
            { name: 'Duplicate the item Hike the Ashokan rail trail' }));
        await waitFor(() => expect(itemCards()).toHaveLength(4));

        // put the warning modal up and leave it up
        await user.click(screen.getAllByRole('button', { name: /^Delete the item/ })[0]);
        await screen.findByText('Delete This Item?');

        await user.keyboard('{Control>}z{/Control}');

        expect(itemCards()).toHaveLength(4);
    });
});

describe('the buttons on an item card', () => {
    it('duplicates directly beneath the original', async () => {
        const { user } = await openList();

        await user.click(screen.getByRole('button',
            { name: 'Duplicate the item Hike the Ashokan rail trail' }));

        await waitFor(() => expect(itemCards()).toHaveLength(4));
        expect(descriptionsOnScreen()).toEqual([
            'Hike the Ashokan rail trail',
            'Hike the Ashokan rail trail',
            'Read chapter four',
            'Call home'
        ]);
    });

    it('asks before deleting, and says the deletion can be undone', async () => {
        const { user } = await openList();

        await user.click(screen.getByRole('button', { name: 'Delete the item Call home' }));

        expect(await screen.findByText('Delete This Item?')).toBeInTheDocument();
        expect(screen.getByText(/can undo this/i)).toBeInTheDocument();
        expect(itemCards()).toHaveLength(3);
    });

    it('deletes once the warning is accepted, and can be undone afterwards', async () => {
        const { user } = await openList();

        await user.click(screen.getByRole('button', { name: 'Delete the item Call home' }));
        await user.click(await screen.findByRole('button', { name: 'Delete Item' }));

        await waitFor(() => expect(itemCards()).toHaveLength(2));

        await user.click(screen.getByRole('button', { name: 'Undo' }));
        await waitFor(() => expect(itemCards()).toHaveLength(3));
        expect(descriptionsOnScreen()[2]).toBe('Call home');
    });

    it('does not open the item modal when a card button is pressed', async () => {
        const { user } = await openList();

        await user.click(screen.getByRole('button',
            { name: 'Duplicate the item Hike the Ashokan rail trail' }));

        await waitFor(() => expect(itemCards()).toHaveLength(4));
        expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
    });
});

describe('drag and drop', () => {
    /**
     * Starts a drag on one card and drops it at a y coordinate, returning once
     * React has settled.
     *
     * The geometry is faked; see the note at the top of tests/helpers/layout.ts.
     */
    async function dragCardTo(fromIndex: number, clientY: number, targetIndex: number) {
        const cards = itemCards();
        stackCards(cards);

        const dataTransfer = fakeDataTransfer();
        dispatchDragEvent(fireEvent, 'dragstart', cards[fromIndex], { dataTransfer });
        dispatchDragEvent(fireEvent, 'dragover', cards[targetIndex], { dataTransfer, clientY });
        dispatchDragEvent(fireEvent, 'drop', cards[targetIndex], { dataTransfer, clientY });
    }

    it('moves a card downwards when dropped below a lower card', async () => {
        await openList();

        // drag "Hike" (0) and drop it in the bottom half of "Call home" (2)
        await dragCardTo(0, yBelowMidlineOf(2), 2);

        await waitFor(() => expect(descriptionsOnScreen()).toEqual([
            'Read chapter four', 'Call home', 'Hike the Ashokan rail trail'
        ]));
    });

    it('moves a card upwards when dropped above a higher card', async () => {
        await openList();

        // drag "Call home" (2) and drop it in the top half of "Hike" (0)
        await dragCardTo(2, yAboveMidlineOf(0), 0);

        await waitFor(() => expect(descriptionsOnScreen()).toEqual([
            'Call home', 'Hike the Ashokan rail trail', 'Read chapter four'
        ]));
    });

    /**
     * THE LOAD BEARING ONE, and the off-by-one that is easy to get wrong.
     *
     * Dropping card 0 into the BOTTOM half of card 1 gives an insertion point of
     * 2 among the cards currently on screen. But the dragged card is pulled out
     * first, which shifts everything after it down by one, so the correct
     * destination is 1. An implementation missing that adjustment moves the card
     * one place too far and passes the two tests above regardless.
     */
    it('adjusts for the dragged card being removed before it is reinserted', async () => {
        await openList();

        await dragCardTo(0, yBelowMidlineOf(1), 1);

        await waitFor(() => expect(descriptionsOnScreen()).toEqual([
            'Read chapter four', 'Hike the Ashokan rail trail', 'Call home'
        ]));
    });

    it('needs no adjustment when dragging upwards', async () => {
        await openList();

        // drag "Call home" (2) into the bottom half of "Hike" (0): insertion
        // point 1, and 2 is not less than 1, so no adjustment
        await dragCardTo(2, yBelowMidlineOf(0), 0);

        await waitFor(() => expect(descriptionsOnScreen()).toEqual([
            'Hike the Ashokan rail trail', 'Call home', 'Read chapter four'
        ]));
    });

    it('leaves the order alone when a card is dropped on itself', async () => {
        await openList();
        const before = descriptionsOnScreen();

        await dragCardTo(1, yAboveMidlineOf(1), 1);

        await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled());
        expect(descriptionsOnScreen()).toEqual(before);
    });

    it('puts a dropped card back where it came from on undo', async () => {
        const { user } = await openList();
        const before = descriptionsOnScreen();

        await dragCardTo(0, yBelowMidlineOf(2), 2);
        await waitFor(() => expect(descriptionsOnScreen()).not.toEqual(before));

        await user.click(screen.getByRole('button', { name: 'Undo' }));
        await waitFor(() => expect(descriptionsOnScreen()).toEqual(before));
    });

    it('gives up quietly when the drag is abandoned', async () => {
        await openList();
        const before = descriptionsOnScreen();
        const cards = itemCards();
        stackCards(cards);

        const dataTransfer = fakeDataTransfer();
        fireEvent.dragStart(cards[0], { dataTransfer });
        fireEvent.dragOver(cards[2], { dataTransfer, clientY: yBelowMidlineOf(2) });
        fireEvent.dragEnd(cards[0], { dataTransfer });

        await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled());
        expect(descriptionsOnScreen()).toEqual(before);
    });
});
