import { ASSET_KEYS } from './assetKeys';

export interface PresentationSpritesheetSpec {
    key: string;
    filePath: string;
    frameWidth: number;
    frameHeight: number;
}

export interface PresentationTextureSpec {
    key: string;
    filePath: string;
}

export const PRESENTATION_SPRITESHEETS = {
    enemy: {
        key: ASSET_KEYS.enemy,
        filePath: 'entities/enemy-sheet.png',
        frameWidth: 48,
        frameHeight: 32,
    },
    collectible: {
        key: ASSET_KEYS.collectible,
        filePath: 'collectibles/star-sheet.png',
        frameWidth: 24,
        frameHeight: 24,
    },
    checkpoint: {
        key: ASSET_KEYS.checkpoint,
        filePath: 'props/checkpoint-sheet.png',
        frameWidth: 28,
        frameHeight: 44,
    },
    goal: {
        key: ASSET_KEYS.goal,
        filePath: 'props/goal-sheet.png',
        frameWidth: 88,
        frameHeight: 120,
    },
} as const satisfies Record<string, PresentationSpritesheetSpec>;

export type PresentationSpritesheetId = keyof typeof PRESENTATION_SPRITESHEETS;

export const PRESENTATION_TEXTURES = {
    terrainGround: {
        key: ASSET_KEYS.terrainGround,
        filePath: 'terrain/ground-tile.png',
    },
    terrainPlatform: {
        key: ASSET_KEYS.terrainPlatform,
        filePath: 'terrain/platform-tile.png',
    },
    uiOverlay: {
        key: ASSET_KEYS.uiOverlay,
        filePath: 'ui/pause-overlay.png',
    },
    uiPanel: {
        key: ASSET_KEYS.uiPanel,
        filePath: 'ui/panel-frame.png',
    },
    uiHudPanel: {
        key: ASSET_KEYS.uiHudPanel,
        filePath: 'ui/hud-panel.png',
    },
} as const satisfies Record<string, PresentationTextureSpec>;

export const REQUIRED_PRESENTATION_ASSET_FILES = [
    ...Object.values(PRESENTATION_SPRITESHEETS).map(({ filePath }) => filePath),
    ...Object.values(PRESENTATION_TEXTURES).map(({ filePath }) => filePath),
] as const;
