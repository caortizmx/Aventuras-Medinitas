export const PRESENTATION_ANIMATION_KEYS = {
    enemyPatrol: 'enemy-patrol',
    collectiblePulse: 'collectible-pulse',
    checkpointIdle: 'checkpoint-idle',
    checkpointActive: 'checkpoint-active',
    goalIdle: 'goal-idle',
} as const;

export type PresentationAnimationKey =
    (typeof PRESENTATION_ANIMATION_KEYS)[keyof typeof PRESENTATION_ANIMATION_KEYS];
