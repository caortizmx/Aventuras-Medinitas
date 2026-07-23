import { CharacterId } from '../constants/characterSpriteConfig';
import { CharacterAnimationState } from '../constants/animationKeys';

export const getAtlasCharacterAnimationKey = (
    characterId: CharacterId,
    state: CharacterAnimationState,
): string => `${characterId}-${state}`;

export const GAMEPLAY_ANIMATION_KEYS = {
    enemySmallWalk: 'enemy-small-walk',
    enemyLargeWalk: 'enemy-large-walk',
    collectibleGem: 'collectible-pulse',
    checkpointIdle: 'checkpoint-idle',
    checkpointActive: 'checkpoint-active',
    goalPortal: 'goal-idle',
} as const;