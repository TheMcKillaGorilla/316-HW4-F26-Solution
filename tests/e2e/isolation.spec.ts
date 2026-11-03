/**
 * isolation.spec.ts
 *
 * Two users, and neither can see or touch the other's lists.
 *
 * The server tests already prove each route refuses another user's list. What
 * is checked here is the whole path a real browser takes: the login cookie
 * really changes who the server thinks is asking, and the pages built for one
 * user never show another's lists, even when the address of one is typed in.
 *
 * Every test begins logged in as Joe, and then becomes another user: Jane,
 * the other example account, who has lists of her own, or Bob, a brand new
 * account with none. page.request shares the browser's cookies, so a request
 * sent through it is sent as whoever the browser is logged in as at the time.
 */
import { test, expect, type Page } from '@playwright/test';
import {
    openApp, openList, homeView, listCards, listCardNamed, listNames, itemDescriptions,
    logInThroughApi, logOutThroughApi, registerThroughApi,
    JANE_EMAIL, JANE_PASSWORD, JANE_LIST_NAMES, STARTER_LIST_NAMES, SAMPLE_LIST_NAME, SAMPLE_ITEMS
} from './support/app';

const BOB_EMAIL = 'bob@stonybrook.edu';
const BOB_PASSWORD = 'bobs-password';

/** Joe's sample list's id, as its card on the home screen carries it */
let joesListId: string;

test.beforeEach(async ({ page }) => {
    await openApp(page);
    joesListId = (await listCardNamed(page, SAMPLE_LIST_NAME).getAttribute('data-list-id'))!;
});

/** Logs Joe out and Bob in, as a brand new account. */
async function becomeBob(page: Page) {
    await logOutThroughApi(page);
    await registerThroughApi(page, BOB_EMAIL, BOB_PASSWORD);
}

/** Logs Joe out and Jane in. */
async function becomeJane(page: Page) {
    await logOutThroughApi(page);
    await logInThroughApi(page, JANE_EMAIL, JANE_PASSWORD);
}

/** Logs whoever it is out and Joe back in. */
async function becomeJoeAgain(page: Page) {
    await logOutThroughApi(page);
    await logInThroughApi(page);
}

test.describe('the two example accounts', () => {
    test('each see only their own lists', async ({ page }) => {
        // the beforeEach left Joe on his home screen
        expect(await listNames(page)).toEqual(STARTER_LIST_NAMES);

        await becomeJane(page);
        await page.goto('/lists');

        await expect(listCards(page)).toHaveCount(JANE_LIST_NAMES.length);
        expect(await listNames(page)).toEqual(JANE_LIST_NAMES);
    });

    test('cannot open each other\'s lists', async ({ page }) => {
        await becomeJane(page);

        const response = await page.request.get(`/api/lists/${joesListId}`);

        expect(response.status()).toBe(404);
    });
});

test.describe('the home screen', () => {
    test('shows a second user none of the first user\'s lists', async ({ page }) => {
        await becomeBob(page);

        await page.goto('/lists');

        await expect(page.locator('#home-empty-message')).toContainText('You do not have any lists yet');
        await expect(listCards(page)).toHaveCount(0);
    });

    test('never shows the first user what the second user made', async ({ page }) => {
        await becomeBob(page);
        await page.goto('/lists');
        await page.locator('#add-list-button').click();
        await expect(page.locator('#list-name-input')).toBeFocused();
        await page.keyboard.type('Bob\'s Secret Plans');
        await page.keyboard.press('Enter');
        await page.locator('#close-button').click();
        await expect(listCards(page)).toHaveCount(1);

        await becomeJoeAgain(page);
        await page.goto('/lists');

        await expect(listCards(page)).toHaveCount(STARTER_LIST_NAMES.length);
        expect(await listNames(page)).not.toContain('Bob\'s Secret Plans');
    });
});

test.describe('typing in the address of somebody else\'s list', () => {
    test('sends the user back to their own lists, and says the list could not be opened', async ({ page }) => {
        await becomeBob(page);

        await page.goto(`/lists/${joesListId}`);

        await expect(page.locator('#alert-modal-title')).toHaveText('The List Could Not Be Opened');
        await expect(page).toHaveURL(/\/lists$/);
        await page.locator('#alert-ok-button').click();
        await expect(homeView(page)).toBeVisible();
        await expect(listCards(page)).toHaveCount(0);
    });

    test('leaves that list exactly as it was', async ({ page }) => {
        await becomeBob(page);
        await page.goto(`/lists/${joesListId}`);
        await expect(page.locator('#alert-modal-title')).toHaveText('The List Could Not Be Opened');

        await becomeJoeAgain(page);
        await page.goto('/lists');
        await openList(page, SAMPLE_LIST_NAME);

        expect(await itemDescriptions(page)).toEqual(SAMPLE_ITEMS);
    });
});

test.describe('the API, asked as the second user about the first user\'s list', () => {
    // a list that is not yours gets the same 404 as one that does not exist,
    // so nobody can even learn that it is there

    test('will not hand it over', async ({ page }) => {
        await becomeBob(page);

        const response = await page.request.get(`/api/lists/${joesListId}`);

        expect(response.status()).toBe(404);
    });

    test('will not save over it', async ({ page }) => {
        await becomeBob(page);

        const response = await page.request.put(`/api/lists/${joesListId}`,
            { data: { name: 'Taken Over', items: [] } });

        expect(response.status()).toBe(404);
    });

    test('will not delete it', async ({ page }) => {
        await becomeBob(page);

        const response = await page.request.delete(`/api/lists/${joesListId}`);

        expect(response.status()).toBe(404);
    });

    test('will not copy it', async ({ page }) => {
        await becomeBob(page);

        const response = await page.request.post(`/api/lists/${joesListId}/duplicate`);

        expect(response.status()).toBe(404);
        expect(await (await page.request.get('/api/lists')).json()).toEqual([]);
    });

    test('changed nothing by being asked', async ({ page }) => {
        await becomeBob(page);
        await page.request.put(`/api/lists/${joesListId}`, { data: { name: 'Taken Over', items: [] } });
        await page.request.delete(`/api/lists/${joesListId}`);

        await becomeJoeAgain(page);
        const response = await page.request.get(`/api/lists/${joesListId}`);

        expect(response.status()).toBe(200);
        const list = await response.json();
        expect(list.name).toBe(SAMPLE_LIST_NAME);
        expect(list.items.map((item: { description: string }) => item.description)).toEqual(SAMPLE_ITEMS);
    });
});
