/**
 * app.ts
 *
 * Shared helpers for the Playwright tests.
 *
 * Everything that can be proved without a browser is proved by the client and
 * server suites. What is left here is what needs every tier running together:
 * that logging in really sets a cookie the browser keeps, that the pages
 * behind the login really refuse a visitor, that a change really reaches
 * PostgreSQL and survives a reload, that Chrome's own drag and drop and keyboard
 * really reach our handlers.
 *
 * Every test starts by resetting the database to the example accounts in
 * server/data/starter_accounts.json. Most tests then log in as the first of
 * them, Joe, so his lists are the fixture.
 *
 * Selectors use ids, roles, accessible names and labels, and the few class
 * names the assignment lists, never a Tailwind class.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page } from '@playwright/test';

/** the e2e API server, started by playwright.config.ts */
export const API_URL = 'http://localhost:4100';

/** a picture to use as an avatar, small enough to be accepted */
export const AVATAR_FILE = fileURLToPath(new URL('../../../client/public/images/wolfie-logo.png', import.meta.url));

interface StarterItem {
    description: string;
    dateEntered: string;
    priority: string;
    targetDate: string | null;
    completed: boolean;
}

interface StarterAccount {
    email: string;
    password: string;
    lists: { name: string; items: StarterItem[] }[];
}

/**
 * The example accounts, read from the very file the server seeds from, so
 * that the example data is free to change and these tests follow along.
 */
const STARTER_ACCOUNTS: StarterAccount[] = JSON.parse(readFileSync(
    new URL('../../../server/data/starter_accounts.json', import.meta.url), 'utf8')).accounts;

/** the account most tests log in as, and whose lists they work in */
export const JOE_EMAIL = STARTER_ACCOUNTS[0].email;
export const JOE_PASSWORD = STARTER_ACCOUNTS[0].password;

/** a second example account, with lists of her own */
export const JANE_EMAIL = STARTER_ACCOUNTS[1].email;
export const JANE_PASSWORD = STARTER_ACCOUNTS[1].password;
export const JANE_LIST_NAMES = STARTER_ACCOUNTS[1].lists.map((list) => list.name);

/** Joe's lists, in order */
export const STARTER_LISTS = STARTER_ACCOUNTS[0].lists;

/** the names of Joe's lists, in order */
export const STARTER_LIST_NAMES = STARTER_LISTS.map((list) => list.name);

/** what each list card's subtitle should read, in order */
export const STARTER_LIST_SUBTITLES = STARTER_LISTS.map((list) => (list.items.length === 0)
    ? 'No items yet'
    : `${list.items.filter((item) => item.completed).length} of ${list.items.length} completed`);

/**
 * The list of Joe's that most of these tests work in, found by shape rather
 * than by name: one of exactly three items, at least one completed and at
 * least one not.
 */
const SAMPLE_LIST = (() => {
    const sample = STARTER_LISTS.find((list) => list.items.length === 3
        && list.items.some((item) => item.completed)
        && list.items.some((item) => !item.completed));
    if (sample === undefined) {
        throw new Error(
            'the end to end tests need Joe to own a list of exactly three items, at least one '
            + 'completed and at least one not, and server/data/starter_accounts.json no longer '
            + 'gives him one');
    }
    return sample;
})();

/** the name of that list */
export const SAMPLE_LIST_NAME = SAMPLE_LIST.name;

/** any other list of Joe's, for the tests that need a second one */
export const OTHER_LIST_NAME = STARTER_LIST_NAMES.find((name) => name !== SAMPLE_LIST_NAME)!;

/** its three items exactly as the file has them, in order */
export const SAMPLE_LIST_ITEMS = SAMPLE_LIST.items.map((item) => ({ ...item }));

/** the descriptions of those items, in order */
export const SAMPLE_ITEMS = SAMPLE_LIST_ITEMS.map((item) => item.description);

/** where the finished and the unfinished items sit, which the file decides */
export const SAMPLE_COMPLETED_INDEX = SAMPLE_LIST_ITEMS.findIndex((item) => item.completed);
export const SAMPLE_UNFINISHED_INDEX = SAMPLE_LIST_ITEMS.findIndex((item) => !item.completed);

/** @returns that date as an item card shows it, i.e. 08/20/2026 */
export function displayDate(isoDate: string | null): string {
    if (typeof isoDate !== 'string') return '—';
    const [year, month, day] = isoDate.split('-');
    return `${month}/${day}/${year}`;
}

// -----------------------------------------------------------------------------
// accounts
// -----------------------------------------------------------------------------

/** Wipes every account and list, and makes the example accounts again. */
export async function resetDatabase(page: Page) {
    const reset = await page.request.post(`${API_URL}/test/reset`);
    expect(reset.ok(), 'the e2e server could not reset the database').toBe(true);
}

/**
 * Logs in WITHOUT the form, straight through the API. page.request shares the
 * browser's cookies, so the login cookie the server sets lands in the browser
 * too. Tests that are not about logging in start this way, because it is fast.
 */
export async function logInThroughApi(page: Page, email = JOE_EMAIL, password = JOE_PASSWORD) {
    const response = await page.request.post('/api/auth/login', { data: { email, password } });
    expect(response.ok(), `could not log in as ${email}`).toBe(true);
}

/** Makes a new account through the API, which also logs the browser in as it. */
export async function registerThroughApi(page: Page, email: string, password = 'password316') {
    const response = await page.request.post('/api/auth/register', { data: { email, password } });
    expect(response.ok(), `could not register ${email}`).toBe(true);
}

/** Logs out through the API, so the browser forgets its cookie. */
export async function logOutThroughApi(page: Page) {
    await page.request.post('/api/auth/logout');
}

/** Fills in and submits the login form, starting from /login. */
export async function logInThroughForm(page: Page, email: string, password: string) {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Log In' }).click();
}

// -----------------------------------------------------------------------------
// getting to the lists
// -----------------------------------------------------------------------------

/**
 * Resets the database, logs in as Joe, opens the home screen, and waits
 * until it has drawn his lists.
 */
export async function openApp(page: Page) {
    await resetDatabase(page);
    await logInThroughApi(page);
    watchRequests(page);
    await page.goto('/lists');
    await expect(page.locator('.list-card').first()).toBeVisible();
}

/** @returns the home screen */
export const homeView = (page: Page) => page.getByRole('region', { name: 'Home' });

/** @returns the list screen */
export const listView = (page: Page) => page.getByRole('region', { name: 'List editor' });

/** Opens one of the lists on the home screen by name, and waits for its items. */
export async function openList(page: Page, name: string) {
    await page.locator('.list-card', { hasText: name }).first().click();
    await expect(listView(page)).toBeVisible();
    await expect(page.locator('#list-loading-message')).toHaveCount(0);
}

/** the API requests each page has sent that have not been answered yet */
const unanswered = new WeakMap<Page, Set<unknown>>();

function watchRequests(page: Page) {
    if (unanswered.has(page)) return;
    const pending = new Set<unknown>();
    unanswered.set(page, pending);
    page.on('request', (request) => {
        if (new URL(request.url()).pathname.startsWith('/api/')) pending.add(request);
    });
    page.on('requestfinished', (request) => pending.delete(request));
    page.on('requestfailed', (request) => pending.delete(request));
}

/**
 * Waits until every save has been answered. Saves happen in the background, so
 * reloading straight after an edit could cut one off. A real user is far
 * slower than a test, but a test has to wait deliberately. The client sends
 * one request at a time, so this checks twice to catch the gap between them.
 */
export async function waitForSaves(page: Page) {
    const pending = unanswered.get(page) ?? new Set();
    for (let quietChecks = 0; quietChecks < 2; quietChecks++) {
        await expect.poll(() => pending.size).toBe(0);
        await page.waitForTimeout(150);
        if (pending.size > 0) quietChecks = -1;
    }
}

/**
 * Starts again from the home screen once every save has landed, the way a
 * user would after closing the browser: a fresh load of /lists.
 */
export async function reload(page: Page) {
    await waitForSaves(page);
    await page.goto('/lists');
    await expectHomeLoaded(page);
}

/** Waits until the home screen has its lists from the server, not just its frame. */
export async function expectHomeLoaded(page: Page) {
    await expect(homeView(page)).toBeVisible();
    await expect(page.getByText('Loading your lists…')).toHaveCount(0);
}

// -----------------------------------------------------------------------------
// what is on the screen
// -----------------------------------------------------------------------------

/** every list card on the home screen */
export const listCards = (page: Page) => page.locator('#list-card-container .list-card');

/** the list card for one list */
export const listCardNamed = (page: Page, name: string) => page.locator('.list-card', { hasText: name }).first();

/** every item card in the open list */
export const itemCards = (page: Page) => page.locator('#item-card-container .item-card');

/** the item card at one position */
export const itemCardAt = (page: Page, index: number) =>
    page.locator(`#item-card-container .item-card[data-index="${index}"]`);

/** an item card's duplicate button */
export const duplicateButton = (card: Locator) => card.getByRole('button', { name: /^Duplicate the item/ });

/** an item card's delete button */
export const deleteButton = (card: Locator) => card.getByRole('button', { name: /^Delete the item/ });

/** the + button in the list view */
export const addItemButton = (page: Page) => page.getByRole('button', { name: 'Add a new item' });

/** @returns the descriptions of the items on screen, in order */
export async function itemDescriptions(page: Page): Promise<string[]> {
    return page.locator('#item-card-container .item-card .item-description').allTextContents();
}

/** @returns the names of the lists on the home screen */
export async function listNames(page: Page): Promise<string[]> {
    return page.locator('#list-card-container .list-card-title').allTextContents();
}

/** the item modal's controls, found by label as the assignment names them */
export const modal = {
    description: (page: Page) => page.locator('#item-description-input'),
    dateEntered: (page: Page) => page.locator('#item-date-entered-input'),
    priority: (page: Page) => page.getByLabel('Priority', { exact: true }),
    targetDate: (page: Page) => page.getByLabel(/meant to be finished by/),
    completed: (page: Page) => page.getByLabel('Completed', { exact: true }),
    previous: (page: Page) => page.locator('#item-modal').getByRole('button', { name: /Previous/ }),
    next: (page: Page) => page.locator('#item-next-button'),
    ok: (page: Page) => page.locator('#item-ok-button'),
    cancel: (page: Page) => page.locator('#item-cancel-button')
};

export interface ItemModalValues {
    description?: string;
    dateEntered?: string;
    priority?: string;
    targetDate?: string;
    completed?: boolean;
}

/** Fills in the item modal and presses a button. */
export async function fillItemModal(
    page: Page,
    { description, dateEntered, priority, targetDate, completed }: ItemModalValues = {},
    press: 'ok' | 'cancel' | 'next' | 'previous' = 'ok') {
    await expect(page.locator('#item-modal')).toBeVisible();

    if (description !== undefined) await modal.description(page).fill(description);
    if (dateEntered !== undefined) await modal.dateEntered(page).fill(dateEntered);
    if (priority !== undefined) await modal.priority(page).selectOption(priority);
    if (targetDate !== undefined) await modal.targetDate(page).fill(targetDate);
    if (completed !== undefined) await modal.completed(page).setChecked(completed);

    await modal[press](page).click();
}

/**
 * The item modal's heading tells a user where they are while stepping through a
 * list, so it has to carry both the position and the total.
 */
export async function expectHeadingShowsItem(page: Page, position: number, total: number) {
    const heading = page.locator('#item-modal-heading');
    await expect(heading).toHaveText(new RegExp(`\\b${position}\\b`));
    await expect(heading).toHaveText(new RegExp(`\\b${total}\\b`));
}

/** @returns every list the logged in user owns, read through the API */
export async function listsInDatabase(page: Page): Promise<{ id: string; name: string; items: StarterItem[] }[]> {
    const metadata: { id: string }[] = await (await page.request.get('/api/lists')).json();
    return Promise.all(metadata.map(async ({ id }) => (await page.request.get(`/api/lists/${id}`)).json()));
}

/** The message a form shows when it is refused. */
export const formError = (page: Page) => page.locator('form').getByRole('alert');
