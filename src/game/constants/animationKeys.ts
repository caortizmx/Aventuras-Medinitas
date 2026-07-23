import { CharacterId } from './characterSpriteConfig';

export const CHARACTER_ANIMATION_STATES = [
    'idle',
    'run',
    'jump',
    'fall',
    'hurt',
    'celebrate',
] as const;

export type CharacterAnimationState = typeof CHARACTER_ANIMATION_STATES[number];

export function getCharacterAnimationKey(
    characterId: CharacterId,
    state: CharacterAnimationState,
): string {
    return `${characterId}-${state}`;
}
