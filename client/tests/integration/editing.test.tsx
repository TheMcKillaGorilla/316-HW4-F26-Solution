/**
 * editing.test.tsx
 *
 * Every kind of edit, with undo and redo, driving the real CurrentListContext
 * and the real useUndoRedo against the fake server.
 *
 * THE LOAD BEARING TESTS are the identity ones. Undo and redo must bring back
 * THE SAME ITEM WITH THE SAME ID, not a rebuilt lookalike. An id is also a
 * React key, so a lookalike would make React throw the card away and build a
 * new one. With snapshots this holds because undo returns the old list object
 * itself, and these tests would notice if anything ever rebuilt it.
 */
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ItemValues } from '@/model/listItem';
import { renderOpenList, type OpenListContext } from '../helpers/harness';
import { WEEKEND_LIST } from '../helpers/fixtures';

type Context = { current: OpenListContext };

/**
 * Opens the weekend list and waits until the editor is genuinely available.
 * Every test starts this way, so the wait lives here rather than in each of them.
 */
async function openWeekendList() {
    const rendered = renderOpenList({ lists: [WEEKEND_LIST] });
    await waitFor(() => expect(rendered.context.current.editor.list).not.toBeNull());
    return rendered;
}

const descriptionsOf = (context: Context) =>
    context.current.editor.items.map((item) => item.description);

const idsOf = (context: Context) => context.current.editor.items.map((item) => item.id);

describe('adding an item', () => {
    it('adds the item at the end of the list', async () => {
        const { context } = await openWeekendList();

        await act(async () => {
            context.current.editor.requestAddItem();
        });
        await act(async () => {
            context.current.editor.commitItemModal({
                mode: 'create',
                index: -1,
                values: {
                    description: 'Buy groceries',
                    dateEntered: '2026-09-10',
                    priority: 'High',
                    targetDate: null,
                    completed: false
                },
                then: 'close'
            });
        });

        expect(descriptionsOf(context)).toEqual([
            'Hike the Ashokan rail trail', 'Read chapter four', 'Call home', 'Buy groceries'
        ]);
    });

    it('takes the item back out again on undo', async () => {
        const { context } = await openWeekendList();
        await addAnItem(context, 'Buy groceries');

        await act(async () => context.current.currentList.undo());

        expect(descriptionsOf(context)).toEqual([
            'Hike the Ashokan rail trail', 'Read chapter four', 'Call home'
        ]);
    });

    it('puts back the very same item on redo, id and all', async () => {
        const { context } = await openWeekendList();
        await addAnItem(context, 'Buy groceries');

        const idWhenAdded = idsOf(context).at(-1);

        await act(async () => context.current.currentList.undo());
        await act(async () => context.current.currentList.redo());

        expect(idsOf(context).at(-1)).toBe(idWhenAdded);
    });

    it('survives many undo and redo cycles without drifting', async () => {
        const { context } = await openWeekendList();
        await addAnItem(context, 'Buy groceries');
        const expected = idsOf(context);

        for (let round = 0; round < 5; round++) {
            await act(async () => context.current.currentList.undo());
            await act(async () => context.current.currentList.redo());
        }

        expect(idsOf(context)).toEqual(expected);
    });
});

describe('deleting an item', () => {
    it('removes the item, once the warning modal has been accepted', async () => {
        const { context } = await openWeekendList();

        await act(async () => context.current.editor.requestDeleteItem(1));
        // nothing has happened yet: the modal is asking
        expect(descriptionsOf(context)).toHaveLength(3);

        await act(async () => context.current.modals.confirmModal?.onAccept());

        expect(descriptionsOf(context)).toEqual([
            'Hike the Ashokan rail trail', 'Call home'
        ]);
    });

    it('does nothing at all if the warning modal is declined', async () => {
        const { context } = await openWeekendList();

        await act(async () => context.current.editor.requestDeleteItem(1));
        await act(async () => context.current.modals.closeConfirmModal());

        expect(descriptionsOf(context)).toHaveLength(3);
        expect(context.current.currentList.canUndo).toBe(false);
    });

    it('restores the very same item on undo, id and all', async () => {
        const { context } = await openWeekendList();
        const deletedId = idsOf(context)[1];

        await deleteItem(context, 1);
        await act(async () => context.current.currentList.undo());

        expect(idsOf(context)[1]).toBe(deletedId);
    });

    it('puts the item back exactly where it was, not at the end', async () => {
        const { context } = await openWeekendList();

        await deleteItem(context, 0);
        await act(async () => context.current.currentList.undo());

        expect(descriptionsOf(context)).toEqual([
            'Hike the Ashokan rail trail', 'Read chapter four', 'Call home'
        ]);
    });

    it('restores every value, not merely the description', async () => {
        const { context } = await openWeekendList();
        const original = context.current.editor.items[1];

        await deleteItem(context, 1);
        await act(async () => context.current.currentList.undo());

        expect(context.current.editor.items[1]).toEqual(original);
    });
});

describe('duplicating an item', () => {
    it('files the copy directly beneath the original', async () => {
        const { context } = await openWeekendList();

        await act(async () => context.current.editor.duplicateItem(0));

        expect(descriptionsOf(context)).toEqual([
            'Hike the Ashokan rail trail',
            'Hike the Ashokan rail trail',
            'Read chapter four',
            'Call home'
        ]);
    });

    it('gives the copy an id of its own', async () => {
        const { context } = await openWeekendList();
        await act(async () => context.current.editor.duplicateItem(0));

        const [original, copy] = idsOf(context);
        expect(copy).not.toBe(original);
    });

    it('copies every value across', async () => {
        const { context } = await openWeekendList();
        await act(async () => context.current.editor.duplicateItem(1));

        const [, original, copy] = context.current.editor.items;
        expect(copy.description).toBe(original.description);
        expect(copy.priority).toBe(original.priority);
        expect(copy.completed).toBe(original.completed);
        expect(copy.targetDate).toBe(original.targetDate);
    });

    it('removes the copy again on undo', async () => {
        const { context } = await openWeekendList();
        await act(async () => context.current.editor.duplicateItem(0));
        await act(async () => context.current.currentList.undo());

        expect(descriptionsOf(context)).toHaveLength(3);
    });

    /** the copy is made once, so redo puts back that copy rather than a new one */
    it('puts back the same copy on redo rather than making another', async () => {
        const { context } = await openWeekendList();
        await act(async () => context.current.editor.duplicateItem(0));

        const copyId = idsOf(context)[1];

        await act(async () => context.current.currentList.undo());
        await act(async () => context.current.currentList.redo());

        expect(idsOf(context)[1]).toBe(copyId);
    });
});

describe('editing an item', () => {
    it('applies the new values', async () => {
        const { context } = await openWeekendList();
        await editItem(context, 0, { description: 'Hike Bear Mountain', priority: 'High' });

        expect(context.current.editor.items[0].description).toBe('Hike Bear Mountain');
        expect(context.current.editor.items[0].priority).toBe('High');
    });

    it('puts the old values back on undo', async () => {
        const { context } = await openWeekendList();
        const before = context.current.editor.items[0];

        await editItem(context, 0, { description: 'Hike Bear Mountain', priority: 'High' });
        await act(async () => context.current.currentList.undo());

        expect(context.current.editor.items[0]).toEqual(before);
    });

    /** an edit keeps the id, which is what makes it different from delete and re-add */
    it('keeps the item id through the edit and through undo', async () => {
        const { context } = await openWeekendList();
        const id = idsOf(context)[0];

        await editItem(context, 0, { description: 'Hike Bear Mountain' });
        expect(idsOf(context)[0]).toBe(id);

        await act(async () => context.current.currentList.undo());
        expect(idsOf(context)[0]).toBe(id);
    });

    /** or the user would press Ctrl+Z on an edit that never happened */
    it('records nothing at all when nothing actually changed', async () => {
        const { context } = await openWeekendList();
        const unchanged = { ...context.current.editor.items[0] };

        await act(async () => context.current.editor.requestEditItem(0));
        await act(async () => {
            context.current.editor.commitItemModal({
                mode: 'edit',
                index: 0,
                values: {
                    description: unchanged.description,
                    dateEntered: unchanged.dateEntered,
                    priority: unchanged.priority,
                    targetDate: unchanged.targetDate,
                    completed: unchanged.completed
                },
                then: 'close'
            });
        });

        expect(context.current.currentList.canUndo).toBe(false);
    });

    it('can be undone and redone repeatedly without drifting', async () => {
        const { context } = await openWeekendList();
        await editItem(context, 2, { description: 'Call home on Sunday' });

        for (let round = 0; round < 4; round++) {
            await act(async () => context.current.currentList.undo());
            expect(context.current.editor.items[2].description).toBe('Call home');

            await act(async () => context.current.currentList.redo());
            expect(context.current.editor.items[2].description).toBe('Call home on Sunday');
        }
    });
});

describe('moving an item', () => {
    it('moves the item', async () => {
        const { context } = await openWeekendList();
        await act(async () => context.current.editor.moveItem(0, 2));

        expect(descriptionsOf(context)).toEqual([
            'Read chapter four', 'Call home', 'Hike the Ashokan rail trail'
        ]);
    });

    it('puts the order back on undo', async () => {
        const { context } = await openWeekendList();
        const before = descriptionsOf(context);

        await act(async () => context.current.editor.moveItem(0, 2));
        await act(async () => context.current.currentList.undo());

        expect(descriptionsOf(context)).toEqual(before);
    });

    it('keeps every item id through a move and its undo', async () => {
        const { context } = await openWeekendList();
        const before = idsOf(context);

        await act(async () => context.current.editor.moveItem(2, 0));
        expect(idsOf(context).sort()).toEqual([...before].sort());

        await act(async () => context.current.currentList.undo());
        expect(idsOf(context)).toEqual(before);
    });

    it('is its own inverse for every pair of positions', async () => {
        const { context } = await openWeekendList();
        const expected = descriptionsOf(context);

        for (let from = 0; from < 3; from++) {
            for (let to = 0; to < 3; to++) {
                if (from === to) continue;

                await act(async () => context.current.editor.moveItem(from, to));
                await act(async () => context.current.currentList.undo());

                expect(descriptionsOf(context), `moving ${from} to ${to}`).toEqual(expected);
            }
        }
    });

    it('records nothing when asked to move an item to where it already is', async () => {
        const { context } = await openWeekendList();
        await act(async () => context.current.editor.moveItem(1, 1));

        expect(context.current.currentList.canUndo).toBe(false);
    });
});

describe('renaming the list', () => {
    it('renames the open list', async () => {
        const { context } = await openWeekendList();
        await act(async () => context.current.editor.renameList('Weekend Plans'));

        expect(context.current.editor.list?.name).toBe('Weekend Plans');
    });

    it('puts the old name back on undo', async () => {
        const { context } = await openWeekendList();
        await act(async () => context.current.editor.renameList('Weekend Plans'));
        await act(async () => context.current.currentList.undo());

        expect(context.current.editor.list?.name).toBe("Wolfie's Weekend");
    });

    it('normalizes before deciding whether anything changed', async () => {
        const { context } = await openWeekendList();
        // the same name with whitespace round it is not a change
        await act(async () => context.current.editor.renameList("   Wolfie's Weekend   "));

        expect(context.current.currentList.canUndo).toBe(false);
    });

    /** the home screen asks the server afresh every time it opens, so this is all it needs */
    it('saves the new name to the server, where the home screen will find it', async () => {
        const { context, server } = await openWeekendList();
        await act(async () => context.current.editor.renameList('Weekend Plans'));

        await waitFor(() => expect(server.list(WEEKEND_LIST.id)?.name).toBe('Weekend Plans'));
    });
});

describe('the history as a whole', () => {
    it('reports what can be undone and redone as it goes', async () => {
        const { context } = await openWeekendList();
        expect(context.current.currentList.canUndo).toBe(false);
        expect(context.current.currentList.canRedo).toBe(false);

        await act(async () => context.current.editor.moveItem(0, 1));
        expect(context.current.currentList.canUndo).toBe(true);
        expect(context.current.currentList.canRedo).toBe(false);

        await act(async () => context.current.currentList.undo());
        expect(context.current.currentList.canUndo).toBe(false);
        expect(context.current.currentList.canRedo).toBe(true);
    });

    it('throws the redo branch away when a new edit is made partway down', async () => {
        const { context } = await openWeekendList();

        await act(async () => context.current.editor.moveItem(0, 1));
        await act(async () => context.current.currentList.undo());
        expect(context.current.currentList.canRedo).toBe(true);

        await act(async () => context.current.editor.duplicateItem(0));
        expect(context.current.currentList.canRedo).toBe(false);
    });

    it('interleaves several kinds of edit correctly', async () => {
        const { context } = await openWeekendList();

        await act(async () => context.current.editor.duplicateItem(0));
        await act(async () => context.current.editor.moveItem(0, 3));
        await editItem(context, 0, { description: 'Renamed' });

        await act(async () => context.current.currentList.undo());
        await act(async () => context.current.currentList.undo());
        await act(async () => context.current.currentList.undo());

        expect(descriptionsOf(context)).toEqual([
            'Hike the Ashokan rail trail', 'Read chapter four', 'Call home'
        ]);
        expect(context.current.currentList.canUndo).toBe(false);
    });
});

describe('saving', () => {
    it('sends every kind of edit, and every undo and redo, to the server', async () => {
        const { context, server } = await openWeekendList();
        const saved = () => server.list(WEEKEND_LIST.id)!.items.map((item) => item.description);

        await act(async () => context.current.editor.moveItem(0, 2));
        await waitFor(() => expect(saved()[2]).toBe('Hike the Ashokan rail trail'));

        await act(async () => context.current.currentList.undo());
        await waitFor(() => expect(saved()[0]).toBe('Hike the Ashokan rail trail'));

        await act(async () => context.current.currentList.redo());
        await waitFor(() => expect(saved()[2]).toBe('Hike the Ashokan rail trail'));
    });

    it('sends one save per change, however many renders there are', async () => {
        const { context, server } = await openWeekendList();

        await act(async () => context.current.editor.duplicateItem(0));
        await act(async () => context.current.editor.duplicateItem(0));
        await waitFor(() => expect(server.list(WEEKEND_LIST.id)!.items).toHaveLength(5));

        expect(server.requestsOf('PUT')).toHaveLength(2);
    });

    it('sends nothing when nothing has changed', async () => {
        const { context, server } = await openWeekendList();
        await act(async () => context.current.editor.moveItem(1, 1));
        expect(server.requestsOf('PUT')).toHaveLength(0);
    });
});

// -----------------------------------------------------------------------------
// small helpers, so that each test above reads as what it is checking
// -----------------------------------------------------------------------------

async function addAnItem(context: Context, description: string) {
    await act(async () => context.current.editor.requestAddItem());
    await act(async () => {
        context.current.editor.commitItemModal({
            mode: 'create',
            index: -1,
            values: {
                description,
                dateEntered: '2026-09-10',
                priority: 'Low',
                targetDate: null,
                completed: false
            },
            then: 'close'
        });
    });
}

async function deleteItem(context: Context, index: number) {
    await act(async () => context.current.editor.requestDeleteItem(index));
    await act(async () => context.current.modals.confirmModal?.onAccept());
}

async function editItem(context: Context, index: number, changes: Partial<ItemValues>) {
    const existing = context.current.editor.items[index];
    await act(async () => context.current.editor.requestEditItem(index));
    await act(async () => {
        context.current.editor.commitItemModal({
            mode: 'edit',
            index,
            values: {
                description: existing.description,
                dateEntered: existing.dateEntered,
                priority: existing.priority,
                targetDate: existing.targetDate,
                completed: existing.completed,
                ...changes
            },
            then: 'close'
        });
    });
}
