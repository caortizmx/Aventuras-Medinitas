import { expect, Page, test } from '@playwright/test';
import { BACKGROUND_LAYERS } from '../../src/game/assets/environmentVisualConfig';

const LANDSCAPE_VIEWPORTS = [
    { width: 1600, height: 900 },
    { width: 1280, height: 720 },
    { width: 844, height: 390 },
    { width: 932, height: 430 },
] as const;

async function waitForScene(page: Page, key: string): Promise<void> {
    await page.waitForFunction((sceneKey) => {
        const game = window.__PHASER_GAME__;
        return game?.scene.isActive(sceneKey) === true;
    }, key);
}

test('Preloader uses the logo loaded by Boot and keeps loading UI visible', async ({ page }) => {
    await page.route('**/assets/game/**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.continue();
    });
    await page.goto('/');
    await page.waitForFunction(() => {
        const scene = window.__PHASER_GAME__?.scene.getScene('Preloader');
        return scene?.children.list.some((child) => (
            child.type === 'Image'
            && (child as Phaser.GameObjects.Image).texture.key === 'logo'
        )) === true;
    });

    const state = await page.evaluate(() => {
        const game = window.__PHASER_GAME__!;
        const scene = game.scene.getScene('Preloader');
        const logo = scene.children.list.find((child) => (
            child.type === 'Image'
            && (child as Phaser.GameObjects.Image).texture.key === 'logo'
        )) as Phaser.GameObjects.Image | undefined;
        const loadingText = scene.children.list
            .filter((child): child is Phaser.GameObjects.Text => child.type === 'Text')
            .map((text) => text.text);
        const bounds = logo?.getBounds();
        return {
            logoLoaded: game.textures.exists('logo'),
            logoVisible: logo?.visible === true,
            logoBounds: bounds
                ? { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom }
                : undefined,
            cameraWidth: scene.cameras.main.width,
            cameraHeight: scene.cameras.main.height,
            loadingText,
        };
    });

    expect(state.logoLoaded).toBe(true);
    expect(state.logoVisible).toBe(true);
    expect(state.logoBounds?.left).toBeGreaterThanOrEqual(0);
    expect(state.logoBounds?.top).toBeGreaterThanOrEqual(0);
    expect(state.logoBounds?.right).toBeLessThanOrEqual(state.cameraWidth);
    expect(state.logoBounds?.bottom).toBeLessThanOrEqual(state.cameraHeight);
    expect(state.loadingText.some((text) => text.endsWith('%'))).toBe(true);
});

for (const viewport of LANDSCAPE_VIEWPORTS) {
    test(`menu and loading composition fits ${viewport.width}x${viewport.height}`, async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', (message) => {
            if (message.type() === 'error') consoleErrors.push(message.text());
        });
        await page.setViewportSize(viewport);
        await page.goto('/');
        await waitForScene(page, 'MainMenu');

        const state = await page.evaluate(() => {
            const scene = window.__PHASER_GAME__!.scene.getScene('MainMenu');
            const camera = scene.cameras.main;
            const objects = scene.children.list
                .filter((child) => (
                    child.type === 'Text'
                    || (child.type === 'Image' && (child as Phaser.GameObjects.Image).texture.key === 'logo')
                ))
                .map((child) => (child as Phaser.GameObjects.Image | Phaser.GameObjects.Text).getBounds())
                .map(({ left, top, right, bottom }) => ({ left, top, right, bottom }));
            return { width: camera.width, height: camera.height, objects };
        });

        for (const bounds of state.objects) {
            expect(bounds.left).toBeGreaterThanOrEqual(-1);
            expect(bounds.top).toBeGreaterThanOrEqual(-1);
            expect(bounds.right).toBeLessThanOrEqual(state.width + 1);
            expect(bounds.bottom).toBeLessThanOrEqual(state.height + 1);
        }
        expect(consoleErrors).toEqual([]);
    });

    test(`Game Over actions fit ${viewport.width}x${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto('/');
        await waitForScene(page, 'MainMenu');
        await page.evaluate(() => {
            window.__PHASER_GAME__!.scene.start('GameOver', {
                reason: 'All lives lost',
                lives: 0,
                score: 12345,
                collectibleCount: 3,
                totalCollectibles: 3,
                characterId: 'emma',
            });
        });
        await waitForScene(page, 'GameOver');

        const state = await page.evaluate(() => {
            const scene = window.__PHASER_GAME__!.scene.getScene('GameOver');
            const camera = scene.cameras.main;
            const labels = scene.children.list
                .filter((child): child is Phaser.GameObjects.Text => child.type === 'Text')
                .map((text) => ({ text: text.text, bounds: text.getBounds() }));
            return {
                width: camera.width,
                height: camera.height,
                labels: labels.map(({ text, bounds }) => ({
                    text,
                    left: bounds.left,
                    top: bounds.top,
                    right: bounds.right,
                    bottom: bounds.bottom,
                })),
            };
        });

        expect(state.labels.map(({ text }) => text)).toEqual(expect.arrayContaining(['Game Over', 'Retry', 'Main Menu']));
        for (const label of state.labels) {
            expect(label.left).toBeGreaterThanOrEqual(0);
            expect(label.top).toBeGreaterThanOrEqual(0);
            expect(label.right).toBeLessThanOrEqual(state.width);
            expect(label.bottom).toBeLessThanOrEqual(state.height);
        }
    });
}

test('gameplay uses atlas terrain and coherent backgrounds without default debug visuals', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await waitForScene(page, 'MainMenu');
    await page.evaluate(() => {
        window.__PHASER_GAME__!.scene.start('LevelOne', { characterId: 'emma' });
    });
    await waitForScene(page, 'LevelOne');

    const backgroundFrames = BACKGROUND_LAYERS.map(({ frame }) => frame);
    const state = await page.evaluate((expectedBackgroundFrames) => {
        const scene = window.__PHASER_GAME__!.scene.getScene('LevelOne');
        const children = scene.children.list;
        const text = children
            .filter((child): child is Phaser.GameObjects.Text => child.type === 'Text')
            .map((child) => child.text);
        const backgrounds = children.filter((child) => (
            child.type === 'TileSprite'
            && expectedBackgroundFrames.includes((child as Phaser.GameObjects.TileSprite).frame.name)
        )) as Phaser.GameObjects.TileSprite[];
        const terrain = children.filter((child) => (
            child.type === 'Image'
            || child.type === 'TileSprite'
        ) && ['terrain_grass_top_00', 'platform_wood_00']
            .includes((child as Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite).frame.name));
        const tileLayers = children
            .filter((child): child is Phaser.Tilemaps.TilemapLayer => child.type === 'TilemapLayer')
            .map((layer) => ({ name: layer.layer.name, visible: layer.visible }));

        return {
            text,
            backgroundCount: backgrounds.length,
            backgroundHeights: backgrounds.map((layer) => layer.displayHeight),
            terrainCount: terrain.length,
            tileLayers,
        };
    }, backgroundFrames);

    expect(state.text.some((value) => value.includes('gravity'))).toBe(false);
    expect(state.backgroundCount).toBe(3);
    expect(state.backgroundHeights.every((height) => height <= 450)).toBe(true);
    expect(state.terrainCount).toBeGreaterThan(0);
    expect(state.tileLayers.every(({ visible }) => visible === false)).toBe(true);
});
