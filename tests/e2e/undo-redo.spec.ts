/**
 * undo-redo.spec.ts
 *
 * The undo stack, driven through the toolbar and through the keyboard.
 *
 * The keyboard tests are the reason this file exists rather than living entirely
 * in jsdom. Ctrl+Z is a shortcut the browser itself also wants, our handler has
 * to call preventDefault to win it, and whether that works is a question only a
 * real browser can answer.
 */
import { test, expect } from '@playwright/test';
import {
    openApp, openList, homeView, itemCards, itemCardAt, itemDescriptions,
    addItemButton, duplicateButton, deleteButton, modal,
    SAMPLE_LIST_NAME, SAMPLE_ITEMS, OTHER_LIST_NAME
} from './support/app';

/** on a Mac the shortcut is the command key */
const MODIFIER = process.platform === 'darwin' ? 'Meta' : 'Control';

test.beforeEach(async ({ page }) => {
    await openApp(page);
    await openList(page, SAMPLE_LIST_NAME);
});

test.describe('the toolbar buttons', () => {
    test('start greyed out on a freshly opened list', async ({ page }) => {
        await expect(page.locator('#undo-button')).toBeDisabled();
        await expect(page.locator('#redo-button')).toBeDisabled();
    });

    test('light up and grey out as the stack moves', async ({ page }) => {
        await duplicateButton(itemCardAt(page, 0)).click();
        await expect(page.locator('#undo-button')).toBeEnabled();
        await expect(page.locator('#redo-button')).toBeDisabled();

        await page.locator('#undo-button').click();
        await expect(page.locator('#undo-button')).toBeDisabled();
        await expect(page.locator('#redo-button')).toBeEnabled();

        await page.locator('#redo-button').click();
        await expect(page.locator('#undo-button')).toBeEnabled();
        await expect(page.locator('#redo-button')).toBeDisabled();
    });

    test('undo an add', async ({ page }) => {
        await addItemButton(page).click();
        await modal.description(page).fill('Buy a new leash');
        await modal.ok(page).click();
        await expect(itemCards(page)).toHaveCount(4);

        await page.locator('#undo-button').click();

        expect(await itemDescriptions(page)).toEqual(SAMPLE_ITEMS);
    });

    test('undo a delete, and the item comes back where it was', async ({ page }) => {
        await deleteButton(itemCardAt(page, 1)).click();
        await page.locator('#confirm-accept-button').click();
        await expect(itemCards(page)).toHaveCount(2);

        await page.locator('#undo-button').click();

        expect(await itemDescriptions(page)).toEqual(SAMPLE_ITEMS);
    });

    test('undo an edit', async ({ page }) => {
        await itemCardAt(page, 0).click();
        await modal.description(page).fill('Something else entirely');
        await modal.ok(page).click();

        await page.locator('#undo-button').click();

        await expect(itemCardAt(page, 0).locator('.item-description')).toHaveText(SAMPLE_ITEMS[0]);
    });

    test('undo a rename', async ({ page }) => {
        await page.locator('#list-name-input').fill('Weekend Plans');
        await page.keyboard.press('Enter');

        await page.locator('#undo-button').click();

        await expect(page.locator('#list-name-input')).toHaveValue(SAMPLE_LIST_NAME);
    });

    test('unwind several edits in reverse order', async ({ page }) => {
        await duplicateButton(itemCardAt(page, 0)).click();
        await duplicateButton(itemCardAt(page, 3)).click();
        await expect(itemCards(page)).toHaveCount(5);

        await page.locator('#undo-button').click();
        await expect(itemCards(page)).toHaveCount(4);

        await page.locator('#undo-button').click();
        expect(await itemDescriptions(page)).toEqual(SAMPLE_ITEMS);
        await expect(page.locator('#undo-button')).toBeDisabled();
    });

    test('throw the redo away once something new is done', async ({ page }) => {
        await duplicateButton(itemCardAt(page, 0)).click();
        await page.locator('#undo-button').click();
        await expect(page.locator('#redo-button')).toBeEnabled();

        await duplicateButton(itemCardAt(page, 2)).click();

        await expect(page.locator('#redo-button')).toBeDisabled();
    });
});

test.describe('the keyboard shortcuts', () => {
    test.beforeEach(async ({ page }) => {
        await duplicateButton(itemCardAt(page, 0)).click();
        await expect(itemCards(page)).toHaveCount(4);
        // make sure the caret is not sitting in the name field
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    });

    test('undo on Ctrl+Z', async ({ page }) => {
        await page.keyboard.press(`${MODIFIER}+z`);
        await expect(itemCards(page)).toHaveCount(3);
    });

    test('redo on Ctrl+Y', async ({ page }) => {
        await page.keyboard.press(`${MODIFIER}+z`);
        await expect(itemCards(page)).toHaveCount(3);

        await page.keyboard.press(`${MODIFIER}+y`);
        await expect(itemCards(page)).toHaveCount(4);
    });

    test('redo on Ctrl+Shift+Z as well', async ({ page }) => {
        await page.keyboard.press(`${MODIFIER}+z`);
        await expect(itemCards(page)).toHaveCount(3);

        await page.keyboard.press(`${MODIFIER}+Shift+z`);
        await expect(itemCards(page)).toHaveCount(4);
    });

    test('do nothing while a modal is up, since the modal owns the keyboard', async ({ page }) => {
        await addItemButton(page).click();
        await expect(page.locator('#item-modal')).toBeVisible();

        await page.keyboard.press(`${MODIFIER}+z`);

        await modal.cancel(page).click();
        await expect(itemCards(page)).toHaveCount(4);
    });

    test('do nothing while the caret is in the name field', async ({ page }) => {
        // there Ctrl+Z belongs to the browser and means undo my typing
        await page.locator('#list-name-input').click();

        await page.keyboard.press(`${MODIFIER}+z`);

        await expect(itemCards(page)).toHaveCount(4);
    });

    test('do nothing on the home screen', async ({ page }) => {
        await page.locator('#close-button').click();
        await expect(homeView(page)).toBeVisible();

        await page.keyboard.press(`${MODIFIER}+z`);

        await expect(homeView(page)).toBeVisible();
    });
});

test.describe('the boundary between lists', () => {
    // Undo must never reach back across a list boundary and start undoing edits
    // made to a list the user is no longer looking at.
    test('forgets the history when the list is closed and reopened', async ({ page }) => {
        await duplicateButton(itemCardAt(page, 0)).click();
        await expect(page.locator('#undo-button')).toBeEnabled();

        await page.locator('#close-button').click();
        await openList(page, SAMPLE_LIST_NAME);

        await expect(page.locator('#undo-button')).toBeDisabled();
        await expect(page.locator('#redo-button')).toBeDisabled();
        // the edit itself stands, it was only the history that was dropped
        await expect(itemCards(page)).toHaveCount(4);
    });

    test('forgets the history when a different list is opened', async ({ page }) => {
        await duplicateButton(itemCardAt(page, 0)).click();

        await page.locator('#close-button').click();
        await openList(page, OTHER_LIST_NAME);

        await expect(page.locator('#undo-button')).toBeDisabled();
    });

    test('forgets the history when the browser goes Back and then Forward again', async ({ page }) => {
        // the list's page is a new page each time it is visited, history and all
        await duplicateButton(itemCardAt(page, 0)).click();
        await expect(page.locator('#undo-button')).toBeEnabled();

        await page.goBack();
        await expect(homeView(page)).toBeVisible();
        await page.goForward();
        await expect(itemCards(page)).toHaveCount(4);

        await expect(page.locator('#undo-button')).toBeDisabled();
    });
});
