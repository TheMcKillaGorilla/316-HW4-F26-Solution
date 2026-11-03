/**
 * auth.spec.ts
 *
 * The splash screen, creating an account, logging in and out, and the pages
 * behind the login refusing anybody who has not.
 */
import { test, expect } from '@playwright/test';
import {
    JOE_EMAIL, JOE_PASSWORD, STARTER_LIST_NAMES, homeView, listCards, logInThroughApi,
    formError, logInThroughForm, registerThroughApi, resetDatabase
} from './support/app';

test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
});

test.describe('the splash screen', () => {
    test('shows the large logo and both ways in', async ({ page }) => {
        await page.goto('/');

        const logo = page.locator('#splash-logo');
        await expect(logo).toBeVisible();
        expect(await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
        expect((await logo.boundingBox())!.width).toBeGreaterThan(200);

        await expect(page.getByRole('link', { name: 'Create Account' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Log In' })).toBeVisible();
    });

    test('leads to the login and sign up forms', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('link', { name: 'Log In' }).click();
        await expect(page).toHaveURL(/\/login$/);

        await page.goto('/');
        await page.getByRole('link', { name: 'Create Account' }).click();
        await expect(page).toHaveURL(/\/register$/);
    });

    test('sends a logged in user straight to their lists', async ({ page }) => {
        await logInThroughApi(page);

        await page.goto('/');

        await expect(page).toHaveURL(/\/lists$/);
    });
});

test.describe('creating an account', () => {
    test('logs the new user in, with no lists of their own yet', async ({ page }) => {
        await page.goto('/register');
        await page.getByLabel('Email').fill('new.student@stonybrook.edu');
        await page.getByLabel('Password', { exact: true }).fill('password316');
        await page.getByLabel('Confirm Password').fill('password316');
        await page.getByRole('button', { name: 'Create Account' }).click();

        await expect(page).toHaveURL(/\/lists$/);
        await expect(page.locator('#home-empty-message')).toContainText('You do not have any lists yet');
    });

    test('refuses two passwords that do not match', async ({ page }) => {
        await page.goto('/register');
        await page.getByLabel('Email').fill('new.student@stonybrook.edu');
        await page.getByLabel('Password', { exact: true }).fill('password316');
        await page.getByLabel('Confirm Password').fill('password317');
        await page.getByRole('button', { name: 'Create Account' }).click();

        await expect(formError(page)).toHaveText('The two passwords do not match.');
        await expect(page).toHaveURL(/\/register$/);
    });

    test('refuses an email address that already has an account', async ({ page }) => {
        await page.goto('/register');
        await page.getByLabel('Email').fill(JOE_EMAIL.toUpperCase());
        await page.getByLabel('Password', { exact: true }).fill('password316');
        await page.getByLabel('Confirm Password').fill('password316');
        await page.getByRole('button', { name: 'Create Account' }).click();

        await expect(formError(page)).toContainText('already an account');
    });
});

test.describe('logging in', () => {
    test('shows the user their lists', async ({ page }) => {
        await logInThroughForm(page, JOE_EMAIL, JOE_PASSWORD);

        await expect(page).toHaveURL(/\/lists$/);
        await expect(listCards(page)).toHaveCount(STARTER_LIST_NAMES.length);
    });

    test('says the same thing for a wrong password as for an unknown email', async ({ page }) => {
        await logInThroughForm(page, JOE_EMAIL, 'not-the-password');
        await expect(formError(page)).toHaveText('Invalid email or password.');

        await logInThroughForm(page, 'nobody@stonybrook.edu', JOE_PASSWORD);
        await expect(formError(page)).toHaveText('Invalid email or password.');
    });

    test('keeps the user logged in across a reload', async ({ page }) => {
        await logInThroughForm(page, JOE_EMAIL, JOE_PASSWORD);
        await expect(homeView(page)).toBeVisible();

        await page.reload();

        await expect(page).toHaveURL(/\/lists$/);
        await expect(listCards(page)).toHaveCount(STARTER_LIST_NAMES.length);
    });

    test('never puts the token where a script on the page could read it', async ({ page, context }) => {
        await logInThroughForm(page, JOE_EMAIL, JOE_PASSWORD);
        await expect(homeView(page)).toBeVisible();

        const token = (await context.cookies()).find((cookie) => cookie.name === 'token');
        expect(token?.httpOnly).toBe(true);
        expect(await page.evaluate(() => document.cookie)).not.toContain('token');
    });
});

test.describe('logging out', () => {
    test('returns to the splash screen, and the lists are no longer reachable', async ({ page }) => {
        await logInThroughForm(page, JOE_EMAIL, JOE_PASSWORD);
        await expect(homeView(page)).toBeVisible();

        await page.getByRole('button', { name: /Account menu/ }).click();
        await page.getByRole('menuitem', { name: 'Log Out' }).click();

        await expect(page).toHaveURL(/\/$/);
        await page.goto('/lists');
        await expect(page).toHaveURL(/\/$/);
    });
});

test.describe('the pages behind the login', () => {
    for (const path of ['/lists', '/account', '/lists/000000000000000000000000']) {
        test(`send a visitor who is not logged in from ${path} to the splash screen`, async ({ page }) => {
            await page.goto(path);
            await expect(page).toHaveURL(/\/$/);
        });
    }

    test('refuse a token the server did not make', async ({ page, context }) => {
        await context.addCookies([{ name: 'token', value: 'forged.token.value', url: 'http://localhost:9100' }]);

        await page.goto('/lists');

        await expect(page).toHaveURL(/\/$/);
    });

    test('show a brand new account the header, with the first letter of its email', async ({ page }) => {
        await registerThroughApi(page, 'zebra@stonybrook.edu');
        await page.goto('/lists');

        await expect(page.getByRole('button', { name: 'Account menu for zebra@stonybrook.edu' }))
            .toContainText('z');
    });
});
