import { ATLAS_KEYS } from './assetKeys';

export const GAMEPLAY_VISUALS = {
    enemySmall: {
        atlasKey: ATLAS_KEYS.gameplay,
        frame: 'enemy_small_walk_00',
        displayWidth: 48,
        displayHeight: 36,
        bodyWidth: 42,
        bodyHeight: 28,
    },
    enemyLarge: {
        atlasKey: ATLAS_KEYS.gameplay,
        frame: 'enemy_large_walk_00',
        displayWidth: 72,
        displayHeight: 54,
        bodyWidth: 42,
        bodyHeight: 28,
    },
    collectible: { atlasKey: ATLAS_KEYS.gameplay, frame: 'collectible_gem_00', displaySize: 30 },
    checkpoint: { atlasKey: ATLAS_KEYS.gameplay, frame: 'checkpoint_00', displayWidth: 40, displayHeight: 60 },
    goal: { atlasKey: ATLAS_KEYS.gameplay, frame: 'goal_portal_00' },
} as const;

export const PROP_VISUALS = [
    { frame: 'prop_bush', xRatio: 0.10, yOffset: 4, depth: 2 },
    { frame: 'prop_signpost', xRatio: 0.22, yOffset: 2, depth: 3 },
    { frame: 'prop_flowers', xRatio: 0.36, yOffset: 3, depth: 3 },
    { frame: 'prop_crate', xRatio: 0.51, yOffset: 2, depth: 3 },
    { frame: 'prop_boulder', xRatio: 0.68, yOffset: 3, depth: 2 },
    { frame: 'prop_lantern_post', xRatio: 0.84, yOffset: 2, depth: 3 },
] as const;