/**
 * items.spec.ts
 *
 * Adding, editing, duplicating and deleting items, through the real item modal
 * in a real browser.
 *
 * The date input is the reason several of these tests could not live in jsdom.
 * <input type="date"> is a genuine browser control with its own parsing and its
 * own idea of what a valid value is, and jsdom implements almost none of that.
 */
import { test, expect } from '@playwright/test';
import {
    openApp, openList, itemCards, itemCardAt, itemDescriptions, fillItemModal, displayDate,
    expectHeadingShowsItem, addItemButton, duplicateButton, deleteButton, modal,
    SAMPLE_LIST_NAME, SAMPLE_ITEMS, SAMPLE_LIST_ITEMS,
    SAMPLE_COMPLETED_INDEX, SAMPLE_UNFINISHED_INDEX
} from './support/app';

test.beforeEach(async ({ page }) => {
    await openApp(page);
    await openList(page, SAMPLE_LIST_NAME);
});

test.describe('adding an item', () => {
    test('adds it to the end of the list', async ({ page }) => {
        await addItemButton(page).click();
        await fillItemModal(page, { description: 'Buy a new leash', priority: 'High' });

        await expect(itemCards(page)).toHaveCount(4);
        expect(await itemDescriptions(page)).toEqual([...SAMPLE_ITEMS, 'Buy a new leash']);
    });

    test('opens the modal empty, dated today, with Previous and Next switched off', async ({ page }) => {
        await addItemButton(page).click();

        await expect(page.locator('#item-modal-heading')).toHaveText('New Item');
        await expect(modal.ok(page)).toHaveText('Add');
        await expect(modal.description(page)).toHaveValue('');
        await expect(modal.description(page)).toBeFocused();
        await expect(modal.previous(page)).toBeDisabled();
        await expect(modal.next(page)).toBeDisabled();

        // the date field defaults to today, in the browser's own time zone
        const today = await page.evaluate(() => {
            const now = new Date();
            const pad = (value: number) => String(value).padStart(2, '0');
            return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        });
        await expect(modal.dateEntered(page)).toHaveValue(today);
    });

    test('shows the new item with its priority and dates', async ({ page }) => {
        await addItemButton(page).click();
        await fillItemModal(page, {
            description: 'Buy a new leash',
            dateEntered: '2026-09-20',
            priority: 'High',
            targetDate: '2026-09-27'
        });

        const newCard = itemCardAt(page, 3);
        await expect(newCard).toContainText('High');
        await expect(newCard).toContainText('09/20/2026');
        await expect(newCard).toContainText('09/27/2026');
    });

    test('leaves the target date empty until the user picks one', async ({ page }) => {
        await addItemButton(page).click();
        // a target date is the user's choice, so the modal does not guess at one
        await expect(modal.targetDate(page)).toHaveValue('');
        await expect(modal.targetDate(page)).toBeEnabled();

        await fillItemModal(page, { description: 'Buy a new leash' });

        await expect(itemCardAt(page, 3)).toContainText('—');
    });

    test('adds nothing on Cancel', async ({ page }) => {
        await addItemButton(page).click();
        await fillItemModal(page, { description: 'Buy a new leash' }, 'cancel');

        await expect(itemCards(page)).toHaveCount(3);
        await expect(page.locator('#undo-button')).toBeDisabled();
    });

    test('adds nothing on Escape', async ({ page }) => {
        await addItemButton(page).click();
        await modal.description(page).fill('Buy a new leash');
        await page.keyboard.press('Escape');

        await expect(page.locator('#item-modal')).toBeHidden();
        await expect(itemCards(page)).toHaveCount(3);
    });

    test('commits when Enter is pressed in the form', async ({ page }) => {
        await addItemButton(page).click();
        await modal.description(page).fill('Buy a new leash');
        await page.keyboard.press('Enter');

        await expect(page.locator('#item-modal')).toBeHidden();
        await expect(itemCards(page)).toHaveCount(4);
    });
});

test.describe('an item with no description', () => {
    test('is refused, with the informative modal stacked on the item modal', async ({ page }) => {
        await addItemButton(page).click();
        await modal.description(page).fill('   ');
        await modal.ok(page).click();

        await expect(page.locator('#alert-modal')).toBeVisible();
        await expect(page.locator('#alert-modal-title')).toHaveText('A Description Is Required');
        // the item modal is still underneath, still holding what was typed
        await expect(page.locator('#item-modal')).toBeVisible();
        await expect(itemCards(page)).toHaveCount(3);
    });

    test('lets the user carry on once the warning is dismissed', async ({ page }) => {
        await addItemButton(page).click();
        await modal.ok(page).click();
        await page.locator('#alert-ok-button').click();

        await expect(page.locator('#alert-modal')).toBeHidden();
        await expect(page.locator('#item-modal')).toBeVisible();

        await fillItemModal(page, { description: 'Buy a new leash' });
        await expect(itemCards(page)).toHaveCount(4);
    });
});

test.describe('editing an item', () => {
    test('opens on the item that was clicked, carrying all of its values', async ({ page }) => {
        const item = SAMPLE_LIST_ITEMS[1];
        await itemCardAt(page, 1).click();

        await expectHeadingShowsItem(page, 2, 3);
        await expect(modal.description(page)).toHaveValue(item.description);
        await expect(modal.dateEntered(page)).toHaveValue(item.dateEntered);
        await expect(modal.priority(page)).toHaveValue(item.priority);
        await expect(modal.targetDate(page)).toHaveValue(item.targetDate ?? '');
        await expect(modal.completed(page)).toBeChecked({ checked: item.completed });
    });

    test('applies the change to the card', async ({ page }) => {
        await itemCardAt(page, 0).click();
        await fillItemModal(page, { description: 'Walk Wolfie twice', priority: 'Low' });

        await expect(itemCardAt(page, 0).locator('.item-description')).toHaveText('Walk Wolfie twice');
        await expect(itemCardAt(page, 0)).toContainText('Low');
    });

    test('records nothing on the undo stack when nothing changed', async ({ page }) => {
        await itemCardAt(page, 0).click();
        await modal.ok(page).click();

        await expect(page.locator('#undo-button')).toBeDisabled();
    });

    test('marks an item completed through the checkbox', async ({ page }) => {
        const index = SAMPLE_UNFINISHED_INDEX;
        await itemCardAt(page, index).click();

        await modal.completed(page).check();
        await modal.ok(page).click();

        await expect(itemCardAt(page, index)).toHaveAttribute('aria-label', /, completed$/);
        await expect(itemCardAt(page, index)).toContainText('✓');
    });

    test('ticks the completed column, and only for the items that are done', async ({ page }) => {
        for (const [index, item] of SAMPLE_LIST_ITEMS.entries()) {
            if (item.completed) {
                await expect(itemCardAt(page, index)).toContainText('✓');
            } else {
                await expect(itemCardAt(page, index)).not.toContainText('✓');
            }
        }
    });

    test('shows each target date in the display format', async ({ page }) => {
        for (const [index, item] of SAMPLE_LIST_ITEMS.entries()) {
            await expect(itemCardAt(page, index)).toContainText(displayDate(item.targetDate));
        }
    });

    test('un-completes an item, leaving its target date alone', async ({ page }) => {
        const index = SAMPLE_COMPLETED_INDEX;
        const targetDate = displayDate(SAMPLE_LIST_ITEMS[index].targetDate);

        await itemCardAt(page, index).click();
        await modal.completed(page).uncheck();
        await expect(modal.targetDate(page)).toBeEnabled();
        await modal.ok(page).click();

        await expect(itemCardAt(page, index)).not.toHaveAttribute('aria-label', /, completed$/);
        await expect(itemCardAt(page, index)).toContainText(targetDate);
        await expect(itemCardAt(page, index)).not.toContainText('✓');
    });

    test('changes a target date without touching whether the item is done', async ({ page }) => {
        const index = SAMPLE_COMPLETED_INDEX;
        await itemCardAt(page, index).click();
        await modal.targetDate(page).fill('2026-09-30');
        await modal.ok(page).click();

        await expect(itemCardAt(page, index)).toContainText('09/30/2026');
        await expect(itemCardAt(page, index)).toHaveAttribute('aria-label', /, completed$/);
    });

    test('walks the list with Next, saving each fix as it goes', async ({ page }) => {
        await itemCardAt(page, 0).click();
        await fillItemModal(page, { description: 'Fixed the first' }, 'next');

        await expectHeadingShowsItem(page, 2, 3);
        await expect(modal.description(page)).toHaveValue(SAMPLE_ITEMS[1]);

        await fillItemModal(page, { description: 'Fixed the second' }, 'ok');

        expect(await itemDescriptions(page)).toEqual([
            'Fixed the first', 'Fixed the second', SAMPLE_ITEMS[2]]);
    });

    test('walks backwards with Previous', async ({ page }) => {
        await itemCardAt(page, 2).click();
        await expect(modal.next(page)).toBeDisabled();

        await modal.previous(page).click();

        await expectHeadingShowsItem(page, 2, 3);
    });

    test('switches Previous off on the first item and Next off on the last', async ({ page }) => {
        await itemCardAt(page, 0).click();
        await expect(modal.previous(page)).toBeDisabled();
        await expect(modal.next(page)).toBeEnabled();
        await modal.cancel(page).click();

        await itemCardAt(page, 2).click();
        await expect(modal.previous(page)).toBeEnabled();
        await expect(modal.next(page)).toBeDisabled();
    });
});

test.describe('duplicating an item', () => {
    test('copies it in directly beneath, without asking', async ({ page }) => {
        await duplicateButton(itemCardAt(page, 0)).click();

        await expect(itemCards(page)).toHaveCount(4);
        const descriptions = await itemDescriptions(page);
        expect(descriptions[0]).toBe(SAMPLE_ITEMS[0]);
        expect(descriptions[1]).toBe(SAMPLE_ITEMS[0]);
    });

    test('does not open the item modal', async ({ page }) => {
        await duplicateButton(itemCardAt(page, 0)).click();
        await expect(page.locator('#item-modal')).toBeHidden();
    });
});

test.describe('deleting an item', () => {
    test('asks first, and says the deletion can be undone', async ({ page }) => {
        await deleteButton(itemCardAt(page, 1)).click();

        await expect(page.locator('#confirm-modal')).toBeVisible();
        await expect(page.locator('#confirm-modal-title')).toHaveText('Delete This Item?');
        await expect(page.locator('#confirm-modal-message')).toContainText(SAMPLE_ITEMS[1]);
        await expect(page.locator('#confirm-modal-message')).toContainText('can undo this');
    });

    test('deletes on yes', async ({ page }) => {
        await deleteButton(itemCardAt(page, 1)).click();
        await page.locator('#confirm-accept-button').click();

        expect(await itemDescriptions(page)).toEqual([SAMPLE_ITEMS[0], SAMPLE_ITEMS[2]]);
    });

    test('keeps the item on no', async ({ page }) => {
        await deleteButton(itemCardAt(page, 1)).click();
        await page.locator('#confirm-decline-button').click();

        await expect(itemCards(page)).toHaveCount(3);
        await expect(page.locator('#undo-button')).toBeDisabled();
    });

    test('says the list is empty once the last item is gone', async ({ page }) => {
        for (let i = 0; i < 3; i++) {
            await deleteButton(itemCardAt(page, 0)).click();
            await page.locator('#confirm-accept-button').click();
        }

        await expect(page.getByText(/This list is empty/)).toBeVisible();
        await expect(page.getByText('Task', { exact: true })).toBeHidden();
    });
});

test.describe('opening an item from the keyboard', () => {
    test('opens the item modal on Enter', async ({ page }) => {
        await itemCardAt(page, 1).focus();
        await page.keyboard.press('Enter');

        await expect(page.locator('#item-modal')).toBeVisible();
        await expectHeadingShowsItem(page, 2, 3);
    });
});
