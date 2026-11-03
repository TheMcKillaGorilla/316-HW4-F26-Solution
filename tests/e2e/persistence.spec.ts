/**
 * persistence.spec.ts
 *
 * Does a change really reach MongoDB and survive the page being reloaded?
 *
 * The server tests prove the API stores what it is sent. This is the one place
 * both halves run together, in Chrome, with the page really torn down and
 * rebuilt.
 *
 * Most of these start again from /lists, the way a user would after closing
 * the browser (see reload in support/app.ts). Since a list has an address of
 * its own now, a few reload the list's own page instead.
 */
import { test, expect } from '@playwright/test';
import {
    openApp, openList, homeView, listView, listCards, listNames, itemCards, itemCardAt,
    itemDescriptions, reload, waitForSaves, listsInDatabase, addItemButton,
    duplicateButton, deleteButton, fillItemModal, SAMPLE_ITEMS, STARTER_LIST_NAMES, SAMPLE_LIST_NAME
} from './support/app';

test.beforeEach(async ({ page }) => {
    await openApp(page);
});

test.describe('surviving a reload', () => {
    test('a new list is still there', async ({ page }) => {
        await page.locator('#add-list-button').click();
        await expect(page.locator('#list-name-input')).toBeFocused();
        await page.keyboard.type('Groceries');
        await page.keyboard.press('Enter');
        await page.locator('#close-button').click();

        await reload(page);

        await expect(listCards(page)).toHaveCount(STARTER_LIST_NAMES.length + 1);
        expect(await listNames(page)).toContain('Groceries');
    });

    test('a new item is still there, with all of its values', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);
        await addItemButton(page).click();
        await fillItemModal(page, {
            description: 'Buy a new leash',
            dateEntered: '2026-09-20',
            priority: 'High',
            targetDate: '2026-09-27',
            completed: true
        });
        await expect(itemCards(page)).toHaveCount(4);

        await reload(page);
        await openList(page, SAMPLE_LIST_NAME);

        await expect(itemCards(page)).toHaveCount(4);
        const card = itemCardAt(page, 3);
        await expect(card.locator('.item-description')).toHaveText('Buy a new leash');
        await expect(card).toContainText('09/20/2026');
        await expect(card).toContainText('High');
        await expect(card).toContainText('09/27/2026');
        await expect(card).toHaveAttribute('aria-label', /, completed$/);
    });

    test('a deletion stays deleted', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);
        await deleteButton(itemCardAt(page, 1)).click();
        await page.locator('#confirm-accept-button').click();
        await expect(itemCards(page)).toHaveCount(2);

        await reload(page);
        await openList(page, SAMPLE_LIST_NAME);

        expect(await itemDescriptions(page)).toEqual([SAMPLE_ITEMS[0], SAMPLE_ITEMS[2]]);
    });

    test('a rename sticks', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);
        await page.locator('#list-name-input').fill('Weekend Plans');
        await page.keyboard.press('Enter');

        await reload(page);

        await expect(listCards(page)).toHaveCount(STARTER_LIST_NAMES.length);
        expect(await listNames(page)).toContain('Weekend Plans');
    });

    test('an undone change is saved as undone', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);
        await duplicateButton(itemCardAt(page, 0)).click();
        await expect(itemCards(page)).toHaveCount(4);

        await page.locator('#undo-button').click();
        await expect(itemCards(page)).toHaveCount(3);

        await reload(page);
        await openList(page, SAMPLE_LIST_NAME);

        await expect(itemCards(page)).toHaveCount(3);
    });

    test('a burst of quick edits lands in the order it was made', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);
        for (let copies = 0; copies < 5; copies++) {
            await duplicateButton(itemCardAt(page, 0)).click();
        }
        for (let undos = 0; undos < 2; undos++) {
            await page.locator('#undo-button').click();
        }
        await expect(itemCards(page)).toHaveCount(6);

        await reload(page);
        await openList(page, SAMPLE_LIST_NAME);

        await expect(itemCards(page)).toHaveCount(6);
    });
});

test.describe('reloading a list\'s own page', () => {
    test('keeps that list open, since the list is in the address', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);
        const address = page.url();

        await page.reload();

        await expect(page).toHaveURL(address);
        await expect(listView(page)).toBeVisible();
        await expect(page.locator('#list-name-input')).toHaveValue(SAMPLE_LIST_NAME);
        expect(await itemDescriptions(page)).toEqual(SAMPLE_ITEMS);
    });

    test('shows the edits made before it', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);
        await duplicateButton(itemCardAt(page, 0)).click();
        await expect(itemCards(page)).toHaveCount(4);
        await waitForSaves(page);

        await page.reload();

        await expect(itemCards(page)).toHaveCount(4);
    });

    test('keeps the name typed into a new list, though ?new is still in the address', async ({ page }) => {
        await page.locator('#add-list-button').click();
        await expect(page.locator('#list-name-input')).toBeFocused();
        await page.keyboard.type('Groceries');
        await page.keyboard.press('Enter');
        await waitForSaves(page);

        await page.reload();

        await expect(page.locator('#list-name-input')).toHaveValue('Groceries');
    });
});

test.describe('what is not carried across a reload', () => {
    test('the undo history, which belongs to one visit to one list', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);
        await duplicateButton(itemCardAt(page, 0)).click();
        await expect(page.locator('#undo-button')).toBeEnabled();
        await waitForSaves(page);

        await page.reload();
        await expect(itemCards(page)).toHaveCount(4);

        await expect(page.locator('#undo-button')).toBeDisabled();
        await expect(page.locator('#redo-button')).toBeDisabled();
    });

    test('which list was open, once the user starts again from /lists', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);

        await reload(page);

        await expect(homeView(page)).toBeVisible();
        await expect(listView(page)).toBeHidden();
    });
});

test.describe('where things are kept', () => {
    test('every edit is in the database straight away, not only when the list closes', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);
        await duplicateButton(itemCardAt(page, 0)).click();
        await expect(itemCards(page)).toHaveCount(4);
        await waitForSaves(page);

        const sample = (await listsInDatabase(page)).find((list) => list.name === SAMPLE_LIST_NAME)!;
        expect(sample.items).toHaveLength(4);
    });

    test('the home screen shows the new counts as soon as the list is closed', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);
        await duplicateButton(itemCardAt(page, 0)).click();
        await expect(itemCards(page)).toHaveCount(4);

        await page.locator('#close-button').click();

        await expect(page.locator('.list-card', { hasText: SAMPLE_LIST_NAME }).first()
            .locator('.list-card-subtitle')).toContainText('of 4 completed');
    });

    test('the database keeps every field of an item', async ({ page }) => {
        const [list] = await listsInDatabase(page);

        expect(Object.keys(list.items[0]).sort()).toEqual(
            ['completed', 'dateEntered', 'description', 'id', 'priority', 'targetDate']);
    });
});
