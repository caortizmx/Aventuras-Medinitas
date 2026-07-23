import {
    CHARACTER_ANIMATION_STATES,
    CharacterAnimationState,
} from '../constants/animationKeys';
import { CHARACTER_IDS, CharacterId } from '../constants/characterSpriteConfig';
import { ATLAS_KEYS } from './assetKeys';
import { GAMEPLAY_ANIMATION_KEYS, getAtlasCharacterAnimationKey } from './animationKeys';
import { CHARACTER_VISUALS } from './characterVisualConfig';

export interface AtlasAnimationDefinition {
    key: string;
    textureKey: string;
    frames: readonly string[];
    frameRate: number;
    repeat: number;
}

const CHARACTER_FRAME_RATES: Record<CharacterAnimationState, number> = {
    idle: 6,
    run: 12,
    jump: 10,
    fall: 10,
    hurt: 12,
    celebrate: 10,
};

const CHARACTER_REPEATS: Record<CharacterAnimationState, number> = {
    idle: -1,
    run: -1,
    jump: 0,
    fall: -1,
    hurt: 0,
    celebrate: -1,
};

const numberedFrames = (prefix: string, count: number): string[] =>
    Array.from({ length: count }, (_, index) => `${prefix}_${String(index).padStart(2, '0')}`);

const characterDefinition = (
    characterId: CharacterId,
    state: CharacterAnimationState,
): AtlasAnimationDefinition => ({
    key: getAtlasCharacterAnimationKey(characterId, state),
    textureKey: CHARACTER_VISUALS[characterId].atlasKey,
    frames: numberedFrames(`${characterId}_${state}`, 6),
    frameRate: CHARACTER_FRAME_RATES[state],
    repeat: CHARACTER_REPEATS[state],
});

export const CHARACTER_ATLAS_ANIMATIONS: readonly AtlasAnimationDefinition[] =
    CHARACTER_IDS.flatMap((characterId) =>
        CHARACTER_ANIMATION_STATES.map((state) => characterDefinition(characterId, state)),
    );

export const GAMEPLAY_ATLAS_ANIMATIONS: readonly AtlasAnimationDefinition[] = [
    {
        key: GAMEPLAY_ANIMATION_KEYS.enemySmallWalk,
        textureKey: ATLAS_KEYS.gameplay,
        frames: numberedFrames('enemy_small_walk', 7),
        frameRate: 9,
        repeat: -1,
    },
    {
        key: GAMEPLAY_ANIMATION_KEYS.enemyLargeWalk,
        textureKey: ATLAS_KEYS.gameplay,
        frames: numberedFrames('enemy_large_walk', 6),
        frameRate: 8,
        repeat: -1,
    },
    {
        key: GAMEPLAY_ANIMATION_KEYS.collectibleGem,
        textureKey: ATLAS_KEYS.gameplay,
        frames: numberedFrames('collectible_gem', 8),
        frameRate: 10,
        repeat: -1,
    },
    {
        key: GAMEPLAY_ANIMATION_KEYS.checkpointIdle,
        textureKey: ATLAS_KEYS.gameplay,
        frames: numberedFrames('checkpoint', 3),
        frameRate: 5,
        repeat: -1,
    },
    {
        key: GAMEPLAY_ANIMATION_KEYS.checkpointActive,
        textureKey: ATLAS_KEYS.gameplay,
        frames: numberedFrames('checkpoint', 6).slice(3),
        frameRate: 10,
        repeat: -1,
    },
    {
        key: GAMEPLAY_ANIMATION_KEYS.goalPortal,
        textureKey: ATLAS_KEYS.gameplay,
        frames: numberedFrames('goal_portal', 6),
        frameRate: 8,
        repeat: -1,
    },
];

export const ATLAS_ANIMATION_DEFINITIONS: readonly AtlasAnimationDefinition[] = [
    ...CHARACTER_ATLAS_ANIMATIONS,
    ...GAMEPLAY_ATLAS_ANIMATIONS,
];