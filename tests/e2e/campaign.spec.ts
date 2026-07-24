import { expect, test } from '@playwright/test';

const waitForMenu = async (page: import('@playwright/test').Page): Promise<void> => {
    await page.waitForFunction(() => window.__CAMPAIGN_TEST__?.getState().currentScene === 'MainMenu');
};

const waitForLevel = async (
    page: import('@playwright/test').Page,
    levelId: 'level-1' | 'level-2',
): Promise<void> => {
    await page.waitForFunction(
        (id) => window.__CAMPAIGN_TEST__?.getState().level?.levelId === id,
        levelId,
    );
};

test('selects, resumes, restarts, replays, and completes the campaign', async ({ page }) => {
    const requestFailures: string[] = [];
    const responseFailures: string[] = [];
    const consoleErrors: string[] = [];
    page.on('requestfailed', (request) => requestFailures.push(request.url()));
    page.on('response', (response) => {
        if (response.status() >= 400) responseFailures.push(`${response.status()} ${response.url()}`);
    });
    page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/?campaignTest=1');
    await waitForMenu(page);
    await page.evaluate(() => window.__CAMPAIGN_TEST__?.showLevelSelect());
    await page.waitForFunction(() => window.__CAMPAIGN_TEST__?.getState().currentScene === 'LevelSelect');
    expect(await page.evaluate(() => window.__CAMPAIGN_TEST__?.startLevel('level-2'))).toBe(false);
    await page.keyboard.press('Enter');
    await waitForLevel(page, 'level-1');

    const levelOne = await page.evaluate(() => window.__CAMPAIGN_TEST__!.getState());
    expect(levelOne.level).toMatchObject({
        levelId: 'level-1',
        collectibles: 27,
        enemies: { small: 7, large: 2 },
    });
    expect(levelOne.level?.checkpoints).toHaveLength(2);
    expect(levelOne.level?.enemyIds.every((id) => id.startsWith('level-one-enemy'))).toBe(true);
    expect(await page.locator('[data-testid="mobile-controls-root"]').count()).toBe(1);
    await expect(page.locator('[data-testid="mobile-left"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-right"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-jump"]')).toBeVisible();

    const checkpointId = levelOne.level!.checkpoints[1]!;
    expect(await page.evaluate((id) => window.__CAMPAIGN_TEST__?.activateCheckpoint(id), checkpointId)).toBe(true);
    const persisted = (await page.evaluate(() => window.__CAMPAIGN_TEST__!.getState()))
        .persistedCheckpoints['level-1'];
    expect(persisted).toEqual({ checkpointId, x: 8960, y: 648 });

    await page.reload();
    await waitForMenu(page);
    expect((await page.evaluate(() => window.__CAMPAIGN_TEST__!.getState())).currentLevelId).toBe('level-1');
    expect(await page.evaluate(() => window.__CAMPAIGN_TEST__?.startLevel('level-1'))).toBe(true);
    await waitForLevel(page, 'level-1');
    const resumed = await page.evaluate(() => window.__CAMPAIGN_TEST__!.getState());
    expect(resumed.level?.activeCheckpoint).toBe(checkpointId);
    expect(resumed.level?.playerPosition.x).toBe(8960);

    expect(await page.evaluate(() => window.__CAMPAIGN_TEST__?.restartLevel())).toBe(true);
    await page.waitForFunction(() => {
        const state = window.__CAMPAIGN_TEST__?.getState();
        return state?.level?.levelId === 'level-1' && !state.level.activeCheckpoint;
    });
    expect((await page.evaluate(() => window.__CAMPAIGN_TEST__!.getState()))
        .persistedCheckpoints['level-1']).toBeUndefined();

    expect(await page.evaluate((id) => window.__CAMPAIGN_TEST__?.activateCheckpoint(id), checkpointId)).toBe(true);
    expect(await page.evaluate(() => window.__CAMPAIGN_TEST__?.completeLevel())).toBe(true);
    await page.waitForFunction(() => window.__CAMPAIGN_TEST__?.getState().currentScene === 'LevelComplete');
    expect((await page.evaluate(() => window.__CAMPAIGN_TEST__!.getState()))
        .persistedCheckpoints['level-1']).toBeUndefined();

    // Replay level one once before continuing.
    expect(await page.evaluate(() => window.__CAMPAIGN_TEST__?.startLevel('level-1'))).toBe(true);
    await waitForLevel(page, 'level-1');
    expect(await page.evaluate(() => window.__CAMPAIGN_TEST__?.completeLevel())).toBe(true);
    await page.waitForFunction(() => window.__CAMPAIGN_TEST__?.getState().currentScene === 'LevelComplete');

    expect(await page.evaluate(() => window.__CAMPAIGN_TEST__?.startLevel('level-2'))).toBe(true);
    await waitForLevel(page, 'level-2');
    expect((await page.evaluate(() => window.__CAMPAIGN_TEST__!.getState())).level).toMatchObject({
        levelId: 'level-2',
        collectibles: 33,
        enemies: { small: 9, large: 3 },
    });
    expect(await page.evaluate(() => window.__CAMPAIGN_TEST__?.completeLevel())).toBe(true);
    await page.waitForFunction(() => window.__CAMPAIGN_TEST__?.getState().campaignComplete === true);

    const completed = await page.evaluate(() => window.__CAMPAIGN_TEST__!.getState());
    expect(completed.unlockedLevel).toBe(2);
    expect(completed.currentLevelId).toBe('level-2');
    expect(completed.timing.automatedElapsedMs).toBeGreaterThanOrEqual(0);
    expect(completed.timing.manualPlaythrough).toBe('pending');
    expect(requestFailures).toEqual([]);
    expect(responseFailures).toEqual([]);
    expect(consoleErrors).toEqual([]);
});

test('rejects an invalid persisted checkpoint and falls back to spawn', async ({ page }) => {
    await page.goto('/?campaignTest=1');
    await waitForMenu(page);
    await page.evaluate(() => {
        localStorage.setItem('aventuras_save_data_v1', JSON.stringify({
            schemaVersion: 2,
            selectedCharacterId: 'emma',
            unlockedLevel: 1,
            currentLevelId: 'level-1',
            bestScores: {},
            bestCollectibleCounts: {},
            checkpoints: {
                'level-1': { checkpointId: 'level-1-checkpoint-1', x: 999, y: 999 },
            },
            settings: { soundEnabled: true },
        }));
    });
    await page.reload();
    await waitForMenu(page);
    expect(await page.evaluate(() => window.__CAMPAIGN_TEST__?.startLevel('level-1'))).toBe(true);
    await waitForLevel(page, 'level-1');

    const state = await page.evaluate(() => window.__CAMPAIGN_TEST__!.getState());
    expect(state.level?.activeCheckpoint).toBeUndefined();
    expect(state.level?.playerPosition.x).toBe(160);
    expect(state.persistedCheckpoints['level-1']).toBeUndefined();
});
