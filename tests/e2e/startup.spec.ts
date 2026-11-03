/**
 * startup.spec.ts
 *
 * What a user sees straight after logging in, in a real browser, against the
 * real server.
 *
 * This catches what no other test can: the page served by Vite, React
 * mounted, the /api proxy forwarding to Express, and Express reading from
 * PostgreSQL. A mistake anywhere in that chain gives a blank or empty page.
 */
import { test, expect } from '@playwright/test';
import {
    openApp, openList, homeView, listView, listCards, listCardNamed, listNames, reload,
    registerThroughApi, resetDatabase, STARTER_LIST_NAMES, STARTER_LIST_SUBTITLES, SAMPLE_LIST_NAME
} from './support/app';

test.describe('the home screen after logging in', () => {
    test('shows the user\'s lists, in order', async ({ page }) => {
        await openApp(page);

        await expect(listCards(page)).toHaveCount(STARTER_LIST_NAMES.length);
        expect(await listNames(page)).toEqual(STARTER_LIST_NAMES);
    });

    test('shows how much of each list is done', async ({ page }) => {
        await openApp(page);

        const subtitles = await page.locator('.list-card-subtitle').allTextContents();
        expect(subtitles).toEqual(STARTER_LIST_SUBTITLES);
    });

    test('lives at /lists, with nothing open on top of it', async ({ page }) => {
        await openApp(page);

        await expect(page).toHaveURL(/\/lists$/);
        await expect(homeView(page)).toBeVisible();
        await expect(listView(page)).toBeHidden();
        await expect(page.locator('#modal-backdrop')).toBeHidden();
    });

    test('shows the Wolfie logo in the header', async ({ page }) => {
        await openApp(page);

        const logo = page.getByRole('link', { name: 'Wolfie Lists, your lists' }).locator('img');
        await expect(logo).toBeVisible();
        expect(await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
            'the logo image failed to load').toBe(true);
    });

    test('loads every page without a console error', async ({ page }) => {
        const problems: string[] = [];
        page.on('console', (message) => {
            if (message.type() === 'error') problems.push(message.text());
        });
        page.on('pageerror', (error) => problems.push(error.message));

        await openApp(page);
        await openList(page, SAMPLE_LIST_NAME);

        expect(problems).toEqual([]);
    });
});

test.describe('a brand new account', () => {
    test('starts with no lists, and an invitation to make one', async ({ page }) => {
        await resetDatabase(page);
        await registerThroughApi(page, 'new.student@stonybrook.edu');

        await page.goto('/lists');

        await expect(page.locator('#home-empty-message')).toContainText('You do not have any lists yet');
        await expect(listCards(page)).toHaveCount(0);
        await expect(page.locator('#add-list-button')).toBeVisible();
    });
});

test.describe('what crosses the network', () => {
    test('the home screen asks who is logged in, then for metadata, and nothing else', async ({ page }) => {
        const requests: string[] = [];
        page.on('request', (request) => {
            const { pathname } = new URL(request.url());
            if (pathname.startsWith('/api/')) requests.push(`${request.method()} ${pathname}`);
        });

        await openApp(page);

        expect([...new Set(requests)]).toEqual(['GET /api/users/me', 'GET /api/lists']);
    });

    test('the metadata carries counts, never items', async ({ page }) => {
        await openApp(page);

        const metadata: object[] = await (await page.request.get('/api/lists')).json();
        for (const list of metadata) {
            expect(Object.keys(list).sort()).toEqual(['completedCount', 'id', 'itemCount', 'name']);
        }
    });

    test('a list\'s items are fetched only when it is opened', async ({ page }) => {
        await openApp(page);

        const [response] = await Promise.all([
            page.waitForResponse((r) => /\/api\/lists\/[^/]+$/.test(new URL(r.url()).pathname)),
            openList(page, SAMPLE_LIST_NAME)
        ]);

        expect((await response.json()).name).toBe(SAMPLE_LIST_NAME);
    });

    test('a server that cannot be reached is reported, not shown as an empty home screen', async ({ page }) => {
        await openApp(page);

        // from now on asking for the lists fails as if the server were off
        await page.route((url) => url.pathname === '/api/lists', (route) => route.abort());
        await page.reload();

        await expect(page.locator('#alert-modal-title')).toHaveText('Your Lists Could Not Be Loaded');
        await expect(listCards(page)).toHaveCount(0);
    });
});

test.describe('deleted lists', () => {
    test('stay deleted after a reload', async ({ page }) => {
        await openApp(page);
        await listCardNamed(page, SAMPLE_LIST_NAME).locator('[data-action="delete-list"]').click();
        await page.locator('#confirm-accept-button').click();
        await expect(listCards(page)).toHaveCount(STARTER_LIST_NAMES.length - 1);

        await reload(page);

        await expect(listCards(page)).toHaveCount(STARTER_LIST_NAMES.length - 1);
        expect(await listNames(page)).not.toContain(SAMPLE_LIST_NAME);
    });

    test('are not replaced by the examples when every list is gone', async ({ page }) => {
        await openApp(page);

        for (const name of STARTER_LIST_NAMES) {
            await listCardNamed(page, name).locator('[data-action="delete-list"]').click();
            await page.locator('#confirm-accept-button').click();
        }
        await expect(page.locator('#home-empty-message')).toContainText('do not have any lists');

        await reload(page);

        await expect(page.locator('#home-empty-message')).toContainText('do not have any lists');
        await expect(listCards(page)).toHaveCount(0);
    });
});
