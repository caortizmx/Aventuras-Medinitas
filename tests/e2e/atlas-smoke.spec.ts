import { expect, test } from '@playwright/test';

test('loads every required atlas frame and animation in Phaser', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/atlas-smoke');
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForFunction(() => window.__ATLAS_SMOKE__ !== undefined);

    const result = await page.evaluate(() => window.__ATLAS_SMOKE__);
    expect(result).toEqual({ ok: true, errors: [] });
    expect(consoleErrors).toEqual([]);
});
