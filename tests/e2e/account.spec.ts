/**
 * account.spec.ts
 *
 * The account page at /account: choosing an avatar, changing the password,
 * and the menu in the header that leads there and logs out.
 *
 * An avatar is the one place the application sends a file rather than JSON,
 * and setInputFiles is how a test chooses one: it hands the file to the
 * <input type="file"> exactly as the operating system's file picker would.
 */
import { writeFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import {
    AVATAR_FILE, JOE_EMAIL, JOE_PASSWORD, openApp, homeView, formError,
    logInThroughForm, logOutThroughApi, resetDatabase
} from './support/app';

/** the avatar in the header, which is a picture once one has been uploaded */
const headerAvatarImage = (page: Page) => page.locator('#account-menu-button img');

/** Fills in and submits the change password form. */
async function changePassword(page: Page, current: string, newPassword: string, confirm = newPassword) {
    await page.getByLabel('Current Password').fill(current);
    await page.getByLabel('New Password', { exact: true }).fill(newPassword);
    await page.getByLabel('Confirm New Password').fill(confirm);
    await page.getByRole('button', { name: 'Change Password' }).click();
}

test.describe('getting to the account page', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
    });

    test('is through the menu under the avatar, which shows who is logged in', async ({ page }) => {
        await page.getByRole('button', { name: /Account menu/ }).click();
        await expect(page.locator('#account-menu-email')).toHaveText(JOE_EMAIL);

        await page.getByRole('menuitem', { name: 'Account Settings' }).click();

        await expect(page).toHaveURL(/\/account$/);
        await expect(page.locator('#account-email')).toHaveText(JOE_EMAIL);
    });

    test('has a way back to the lists', async ({ page }) => {
        await page.goto('/account');

        await page.getByRole('link', { name: /Back to your lists/ }).click();

        await expect(page).toHaveURL(/\/lists$/);
        await expect(homeView(page)).toBeVisible();
    });

    test('closes the menu on Escape', async ({ page }) => {
        await page.getByRole('button', { name: /Account menu/ }).click();
        await expect(page.locator('#account-menu')).toBeVisible();

        await page.keyboard.press('Escape');

        await expect(page.locator('#account-menu')).toBeHidden();
    });
});

test.describe('the avatar', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
        await page.goto('/account');
    });

    test('starts as the first letter of the email', async ({ page }) => {
        await expect(headerAvatarImage(page)).toHaveCount(0);
        await expect(page.locator('#account-menu-button')).toContainText(JOE_EMAIL.charAt(0));
    });

    test('appears in the header as soon as a picture is chosen', async ({ page }) => {
        await page.locator('#avatar-input').setInputFiles(AVATAR_FILE);

        await expect(headerAvatarImage(page)).toBeVisible();
        // the picture really came back from the server, not just a broken link
        await expect.poll(() => headerAvatarImage(page)
            .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    });

    test('is kept by the server, and is still there after a reload', async ({ page }) => {
        await page.locator('#avatar-input').setInputFiles(AVATAR_FILE);
        await expect(headerAvatarImage(page)).toBeVisible();

        await page.goto('/lists');

        await expect(headerAvatarImage(page)).toBeVisible();
        await expect.poll(() => headerAvatarImage(page)
            .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    });

    test('refuses a file that is not a picture, before sending it', async ({ page }, testInfo) => {
        const textFile = testInfo.outputPath('not-a-picture.txt');
        writeFileSync(textFile, 'Wolfie is a seawolf, not an image.');

        const uploads: string[] = [];
        page.on('request', (request) => {
            if (new URL(request.url()).pathname === '/api/users/me/avatar') uploads.push(request.method());
        });
        await page.locator('#avatar-input').setInputFiles(textFile);

        await expect(page.getByText('An avatar must be a PNG, JPEG or WebP image.')).toBeVisible();
        await expect(headerAvatarImage(page)).toHaveCount(0);
        expect(uploads).toEqual([]);
    });

    test('is refused by the server too, which cannot trust the browser to check', async ({ page }) => {
        const response = await page.request.put('/api/users/me/avatar', {
            multipart: {
                avatar: { name: 'not-a-picture.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') }
            }
        });

        expect(response.status()).toBe(400);
    });
});

test.describe('choosing an avatar while creating an account', () => {
    test('uploads it once the account exists', async ({ page }) => {
        await resetDatabase(page);
        await page.goto('/register');

        await page.locator('#avatar-input').setInputFiles(AVATAR_FILE);
        await page.getByLabel('Email').fill('new.student@stonybrook.edu');
        await page.getByLabel('Password', { exact: true }).fill('password316');
        await page.getByLabel('Confirm Password').fill('password316');
        await page.getByRole('button', { name: 'Create Account' }).click();

        await expect(page).toHaveURL(/\/lists$/);
        await expect(headerAvatarImage(page)).toBeVisible();
        const me = await (await page.request.get('/api/users/me')).json();
        expect(me.avatarUrl).not.toBeNull();
    });
});

test.describe('changing the password', () => {
    const NEW_PASSWORD = 'wolfie-rules-316';

    test.beforeEach(async ({ page }) => {
        await openApp(page);
        await page.goto('/account');
    });

    test('refuses a wrong current password', async ({ page }) => {
        await changePassword(page, 'not-the-password', NEW_PASSWORD);

        await expect(formError(page)).toHaveText('The current password is not correct.');
        await expect(page.locator('#password-form').getByRole('status')).toHaveCount(0);
    });

    test('refuses two new passwords that do not match', async ({ page }) => {
        await changePassword(page, JOE_PASSWORD, NEW_PASSWORD, `${NEW_PASSWORD}!`);

        await expect(formError(page)).toHaveText('The two new passwords do not match.');
    });

    test('refuses a new password that is too short', async ({ page }) => {
        await changePassword(page, JOE_PASSWORD, 'short');

        await expect(formError(page)).toContainText('at least');
    });

    test('says so when it works, and empties the form', async ({ page }) => {
        await changePassword(page, JOE_PASSWORD, NEW_PASSWORD);

        await expect(page.locator('#password-form').getByRole('status'))
            .toHaveText('Your password has been changed.');
        await expect(formError(page)).toHaveCount(0);
        await expect(page.getByLabel('Current Password')).toHaveValue('');
    });

    test('lets the user in with the new password, and no longer with the old one', async ({ page }) => {
        await changePassword(page, JOE_PASSWORD, NEW_PASSWORD);
        await expect(page.locator('#password-form').getByRole('status')).toBeVisible();
        await logOutThroughApi(page);

        await logInThroughForm(page, JOE_EMAIL, JOE_PASSWORD);
        await expect(formError(page)).toHaveText('Invalid email or password.');

        await logInThroughForm(page, JOE_EMAIL, NEW_PASSWORD);
        await expect(page).toHaveURL(/\/lists$/);
    });
});

test.describe('logging out from the account page', () => {
    test('returns to the splash screen, and the account page is no longer reachable', async ({ page }) => {
        await openApp(page);
        await page.goto('/account');

        await page.getByRole('button', { name: /Account menu/ }).click();
        await page.getByRole('menuitem', { name: 'Log Out' }).click();

        await expect(page).toHaveURL(/\/$/);
        await page.goto('/account');
        await expect(page).toHaveURL(/\/$/);
    });
});
