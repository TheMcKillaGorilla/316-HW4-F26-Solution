/**
 * drag-and-drop.spec.ts
 *
 * Reordering items by dragging them.
 *
 * This is the one feature in the application that genuinely cannot be tested
 * without a browser. HTML5 drag and drop is a negotiation between the page and
 * the operating system: the browser decides whether a drag may begin, refuses a
 * drop unless the page calls preventDefault on dragover, and carries the payload
 * in a DataTransfer object we never construct ourselves. jsdom implements none of
 * that.
 *
 * The arithmetic, i.e. given a cursor at this position, which destination
 * index does the view work out, could be checked in jsdom. This file checks
 * the other half: that Chrome delivers a cursor there at all, and that the
 * resulting move is a real, undoable edit.
 */
import { test, expect, type Page } from '@playwright/test';
import {
    openApp, openList, reload, itemCards, itemCardAt, itemDescriptions, SAMPLE_LIST_NAME, SAMPLE_ITEMS
} from './support/app';

/**
 * Drags one card onto another and lets go on a chosen half of it. Letting go on
 * the upper half means "put it above this one", the lower half "below".
 */
async function dragCard(page: Page, fromIndex: number, toIndex: number, half: 'top' | 'bottom' = 'bottom') {
    const source = itemCardAt(page, fromIndex);
    const target = itemCardAt(page, toIndex);

    const box = (await target.boundingBox())!;
    const y = half === 'top' ? 4 : box.height - 4;

    await source.dragTo(target, {
        targetPosition: { x: box.width / 2, y },
        force: true
    });
}

test.beforeEach(async ({ page }) => {
    await openApp(page);
    await openList(page, SAMPLE_LIST_NAME);
    expect(await itemDescriptions(page)).toEqual(SAMPLE_ITEMS);
});

test.describe('reordering by dragging', () => {
    test('moves an item down the list', async ({ page }) => {
        await dragCard(page, 0, 2, 'bottom');

        expect(await itemDescriptions(page)).toEqual([
            SAMPLE_ITEMS[1], SAMPLE_ITEMS[2], SAMPLE_ITEMS[0]]);
    });

    test('moves an item up the list', async ({ page }) => {
        await dragCard(page, 2, 0, 'top');

        expect(await itemDescriptions(page)).toEqual([
            SAMPLE_ITEMS[2], SAMPLE_ITEMS[0], SAMPLE_ITEMS[1]]);
    });

    test('moves an item by a single position', async ({ page }) => {
        await dragCard(page, 0, 1, 'bottom');

        expect(await itemDescriptions(page)).toEqual([
            SAMPLE_ITEMS[1], SAMPLE_ITEMS[0], SAMPLE_ITEMS[2]]);
    });

    test('never changes how many items there are', async ({ page }) => {
        await dragCard(page, 0, 2, 'bottom');
        await expect(itemCards(page)).toHaveCount(3);
    });

    test('renumbers the cards afterwards', async ({ page }) => {
        // the drag and drop code works from the index on each card
        await dragCard(page, 0, 2, 'bottom');

        const indexes = await itemCards(page)
            .evaluateAll((cards) => cards.map((card) => (card as HTMLElement).dataset.index));
        expect(indexes).toEqual(['0', '1', '2']);
    });
});

test.describe('a drag is an ordinary edit', () => {
    test('is undoable', async ({ page }) => {
        await dragCard(page, 0, 2, 'bottom');
        await expect(page.locator('#undo-button')).toBeEnabled();

        await page.locator('#undo-button').click();

        expect(await itemDescriptions(page)).toEqual(SAMPLE_ITEMS);
    });

    test('is redoable', async ({ page }) => {
        await dragCard(page, 0, 2, 'bottom');
        const moved = await itemDescriptions(page);

        await page.locator('#undo-button').click();
        await page.locator('#redo-button').click();

        expect(await itemDescriptions(page)).toEqual(moved);
    });

    test('is saved, and survives a reload', async ({ page }) => {
        await dragCard(page, 0, 2, 'bottom');
        const moved = await itemDescriptions(page);

        await reload(page);
        await openList(page, SAMPLE_LIST_NAME);

        expect(await itemDescriptions(page)).toEqual(moved);
    });
});

test.describe('a drag that goes nowhere', () => {
    test('records nothing when the card is dropped back on itself', async ({ page }) => {
        await dragCard(page, 1, 1, 'top');

        expect(await itemDescriptions(page)).toEqual(SAMPLE_ITEMS);
        await expect(page.locator('#undo-button')).toBeDisabled();
    });

    test('leaves no drop line on any card afterwards', async ({ page }) => {
        await dragCard(page, 0, 2, 'bottom');

        await expect(page.locator('.drop-before, .drop-after')).toHaveCount(0);
    });
});
