/**
 * lists.spec.ts
 *
 * Creating, renaming, duplicating and deleting whole lists, and getting from
 * the home screen to a list and back again.
 *
 * Creating, duplicating and deleting a list are not undoable, by design. Renaming
 * is, because it is an edit made from inside the list.
 *
 * New in HW4: every list has an address of its own, /lists/66f0..., so the
 * browser's Back button and a typed or bookmarked URL are ways in and out of a
 * list too, and they get tests of their own here.
 */
import { test, expect } from '@playwright/test';
import {
    openApp, openList, reload, homeView, listView, listCards, listCardNamed, listNames, itemCards,
    deleteButton, duplicateButton, STARTER_LIST_NAMES, SAMPLE_LIST_NAME, OTHER_LIST_NAME
} from './support/app';

/** a list's address: /lists/ and its uuid */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const LIST_URL = new RegExp(`/lists/${UUID}$`);

test.beforeEach(async ({ page }) => {
    await openApp(page);
});

test.describe('creating a list', () => {
    test('opens it straight away with the name ready to be typed over', async ({ page }) => {
        await page.locator('#add-list-button').click();

        await expect(listView(page)).toBeVisible();
        await expect(page.locator('#list-name-input')).toBeFocused();
        await expect(page.locator('#list-name-input')).toHaveValue('Untitled List');
        await expect(listView(page).getByText(/This list is empty/)).toBeVisible();
    });

    test('opens it at its own address, marked as new', async ({ page }) => {
        await page.locator('#add-list-button').click();

        // ?new is what asks for the name to arrive selected
        await expect(page).toHaveURL(new RegExp(`/lists/${UUID}\\?new$`));
    });

    test('lets the user name it simply by typing', async ({ page }) => {
        await page.locator('#add-list-button').click();

        // the name arrives selected, once the server has made the list, so
        // typing replaces it
        await expect(page.locator('#list-name-input')).toBeFocused();
        await page.keyboard.type('Groceries');
        await page.keyboard.press('Enter');

        await page.locator('#close-button').click();
        // the home screen is a page of its own now, so wait for it to fetch the lists
        await expect(listCards(page)).toHaveCount(STARTER_LIST_NAMES.length + 1);
        expect(await listNames(page)).toContain('Groceries');
    });

    test('numbers a second untitled list rather than repeating the name', async ({ page }) => {
        await page.locator('#add-list-button').click();
        await expect(page.locator('#list-name-input')).toHaveValue('Untitled List');
        await page.locator('#close-button').click();

        await page.locator('#add-list-button').click();

        await expect(page.locator('#list-name-input')).toHaveValue('Untitled List 2');
    });
});

test.describe('opening and closing a list', () => {
    test('opens it at its own address', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);

        await expect(page).toHaveURL(LIST_URL);
        await expect(page.locator('#list-name-input')).toHaveValue(SAMPLE_LIST_NAME);
    });

    test('goes back to /lists on the close button', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);

        await page.locator('#close-button').click();

        await expect(page).toHaveURL(/\/lists$/);
        await expect(homeView(page)).toBeVisible();
        await expect(listView(page)).toBeHidden();
    });

    test('goes back to /lists on the browser\'s Back button', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);

        await page.goBack();

        await expect(page).toHaveURL(/\/lists$/);
        await expect(homeView(page)).toBeVisible();
        await expect(listCards(page)).toHaveCount(STARTER_LIST_NAMES.length);
    });

    test('goes back to /lists on the logo in the header', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);

        await page.getByRole('link', { name: 'Wolfie Lists, your lists' }).click();

        await expect(page).toHaveURL(/\/lists$/);
        await expect(homeView(page)).toBeVisible();
    });

    test('opens straight from its address, without going through the home screen', async ({ page }) => {
        const id = await listCardNamed(page, SAMPLE_LIST_NAME).getAttribute('data-list-id');

        await page.goto(`/lists/${id}`);

        await expect(listView(page)).toBeVisible();
        await expect(page.locator('#list-name-input')).toHaveValue(SAMPLE_LIST_NAME);
        await expect(itemCards(page)).toHaveCount(3);
    });

    test('sends an address with no list behind it back home, and says why', async ({ page }) => {
        await page.goto('/lists/000000000000000000000000');

        await expect(page.locator('#alert-modal-title')).toHaveText('The List Could Not Be Opened');
        await expect(page).toHaveURL(/\/lists$/);
        await page.locator('#alert-ok-button').click();
        await expect(listCards(page)).toHaveCount(STARTER_LIST_NAMES.length);
    });
});

test.describe('renaming a list', () => {
    test('shows the new name on the home screen', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);

        await page.locator('#list-name-input').fill('Weekend Plans');
        await page.keyboard.press('Enter');
        await page.locator('#close-button').click();
        await expect(listCards(page)).toHaveCount(STARTER_LIST_NAMES.length);

        expect(await listNames(page)).toContain('Weekend Plans');
        expect(await listNames(page)).not.toContain(SAMPLE_LIST_NAME);
    });

    test('can be undone, since it is an edit made inside the list', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);

        await page.locator('#list-name-input').fill('Weekend Plans');
        await page.keyboard.press('Enter');
        await expect(page.locator('#undo-button')).toBeEnabled();

        await page.locator('#undo-button').click();

        await expect(page.locator('#list-name-input')).toHaveValue(SAMPLE_LIST_NAME);
    });

    test('puts the old name back on Escape', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);

        await page.locator('#list-name-input').fill('Half typed nam');
        await page.keyboard.press('Escape');

        await expect(page.locator('#list-name-input')).toHaveValue(SAMPLE_LIST_NAME);
        await expect(page.locator('#undo-button')).toBeDisabled();
    });

    test('refuses to leave a list nameless', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);

        await page.locator('#list-name-input').fill('   ');
        await page.keyboard.press('Enter');

        await expect(page.locator('#list-name-input')).toHaveValue('Untitled List');
    });
});

test.describe('duplicating a list', () => {
    test('files the copy directly beneath the original', async ({ page }) => {
        await listCardNamed(page, SAMPLE_LIST_NAME)
            .getByRole('button', { name: /^Duplicate the list named/ }).click();

        await expect(listCards(page)).toHaveCount(STARTER_LIST_NAMES.length + 1);
        const names = await listNames(page);
        const original = STARTER_LIST_NAMES.indexOf(SAMPLE_LIST_NAME);
        expect(names[original]).toBe(SAMPLE_LIST_NAME);
        expect(names[original + 1]).toBe(`${SAMPLE_LIST_NAME} (Copy)`);
    });

    test('copies the items, and the copies are independent', async ({ page }) => {
        await listCardNamed(page, SAMPLE_LIST_NAME)
            .getByRole('button', { name: /^Duplicate the list named/ }).click();

        await openList(page, `${SAMPLE_LIST_NAME} (Copy)`);
        await expect(itemCards(page)).toHaveCount(3);

        // delete an item from the copy
        await deleteButton(itemCards(page).first()).click();
        await page.locator('#confirm-accept-button').click();
        await expect(itemCards(page)).toHaveCount(2);

        // the original, which is the first card carrying its name, still has all three
        await page.locator('#close-button').click();
        await openList(page, SAMPLE_LIST_NAME);
        await expect(page.locator('#list-name-input')).toHaveValue(SAMPLE_LIST_NAME);
        await expect(itemCards(page)).toHaveCount(3);
    });

    test('does not open the list it just copied', async ({ page }) => {
        await listCardNamed(page, OTHER_LIST_NAME)
            .getByRole('button', { name: /^Duplicate the list named/ }).click();
        await expect(listCards(page)).toHaveCount(STARTER_LIST_NAMES.length + 1);

        await expect(page).toHaveURL(/\/lists$/);
        await expect(homeView(page)).toBeVisible();
        await expect(listView(page)).toBeHidden();
    });
});

test.describe('deleting a list', () => {
    test('asks first, and warns that it cannot be undone', async ({ page }) => {
        await listCardNamed(page, SAMPLE_LIST_NAME).locator('[data-action="delete-list"]').click();

        await expect(page.locator('#confirm-modal')).toBeVisible();
        await expect(page.locator('#confirm-modal-title')).toHaveText('Delete This List?');
        await expect(page.locator('#confirm-modal-message')).toContainText(SAMPLE_LIST_NAME);
        await expect(page.locator('#confirm-modal-message')).toContainText('cannot be undone');
    });

    test('starts with the focus on Cancel, never on the dangerous button', async ({ page }) => {
        await listCardNamed(page, SAMPLE_LIST_NAME).locator('[data-action="delete-list"]').click();

        await expect(page.locator('#confirm-decline-button')).toBeFocused();
    });

    test('deletes on yes', async ({ page }) => {
        await listCardNamed(page, SAMPLE_LIST_NAME).locator('[data-action="delete-list"]').click();
        await page.locator('#confirm-accept-button').click();

        await expect(listCards(page)).toHaveCount(STARTER_LIST_NAMES.length - 1);
        expect(await listNames(page)).not.toContain(SAMPLE_LIST_NAME);
    });

    test('keeps the list on no', async ({ page }) => {
        await listCardNamed(page, SAMPLE_LIST_NAME).locator('[data-action="delete-list"]').click();
        await page.locator('#confirm-decline-button').click();

        await expect(listCards(page)).toHaveCount(STARTER_LIST_NAMES.length);
    });

    test('keeps the list on Escape', async ({ page }) => {
        await listCardNamed(page, SAMPLE_LIST_NAME).locator('[data-action="delete-list"]').click();
        await page.keyboard.press('Escape');

        await expect(page.locator('#confirm-modal')).toBeHidden();
        await expect(listCards(page)).toHaveCount(STARTER_LIST_NAMES.length);
    });

    test('shows the invitation to start again once every list is gone', async ({ page }) => {
        for (const name of await listNames(page)) {
            await listCardNamed(page, name).locator('[data-action="delete-list"]').click();
            await page.locator('#confirm-accept-button').click();
        }

        await expect(page.locator('#home-empty-message')).toBeVisible();
        await expect(page.locator('#list-card-container')).toBeHidden();
    });
});

test.describe('the Wolfie button in the list toolbar', () => {
    test('returns to the home screen, like the close button', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);

        await page.locator('#home-button').click();

        await expect(page).toHaveURL(/\/lists$/);
        await expect(homeView(page)).toBeVisible();
        await expect(listView(page)).toBeHidden();
        await expect(listCards(page)).toHaveCount(STARTER_LIST_NAMES.length);
    });

    test('shows the logo, loaded and decoded', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);

        const logo = page.locator('#home-button img');
        await expect(logo).toBeVisible();
        expect(await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    });

    test('fits inside the toolbar without pushing anything off the edge', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);

        const button = (await page.locator('#home-button').boundingBox())!;
        const undo = (await page.locator('#undo-button').boundingBox())!;
        const logo = (await page.locator('#home-button img').boundingBox())!;

        expect(Math.round(button.height)).toBe(Math.round(undo.height));
        expect(Math.round(button.width)).toBe(Math.round(undo.width));
        expect(logo.width).toBeLessThanOrEqual(button.width);
        expect(logo.height).toBeLessThanOrEqual(button.height);
        expect(button.x).toBeLessThan(undo.x);
    });

    test('carries an accessible name, since it is a real control', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);

        await expect(page.locator('#home-button'))
            .toHaveAccessibleName(/return to the home screen/i);
    });

    test('saves edits on the way out', async ({ page }) => {
        await openList(page, SAMPLE_LIST_NAME);
        await duplicateButton(itemCards(page).first()).click();

        await page.locator('#home-button').click();
        await reload(page);
        await openList(page, SAMPLE_LIST_NAME);

        await expect(itemCards(page)).toHaveCount(4);
    });
});

test.describe('the warning modal', () => {
    test('does not close when the backdrop is clicked', async ({ page }) => {
        // a modal exists to insist on an answer
        await listCardNamed(page, SAMPLE_LIST_NAME).locator('[data-action="delete-list"]').click();

        await page.locator('#modal-backdrop').click({ position: { x: 5, y: 5 } });

        await expect(page.locator('#confirm-modal')).toBeVisible();
        await expect(listCards(page)).toHaveCount(STARTER_LIST_NAMES.length);
    });
});
