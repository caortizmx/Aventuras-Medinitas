import { PRESENTATION_ANIMATION_KEYS } from '../constants/presentationAnimationKeys';
import { PRESENTATION_SPRITESHEETS } from '../constants/presentationAssetConfig';

export interface PresentationAnimationRegistrar {
    exists: (key: string) => boolean;
    create: (config: Phaser.Types.Animations.Animation) => unknown;
    generateFrameNumbers: (
        key: string,
        config: { start: number; end: number },
    ) => Phaser.Types.Animations.AnimationFrame[];
}

interface PresentationAnimationDefinition {
    key: string;
    textureKey: string;
    start: number;
    end: number;
    frameRate: number;
    repeat: number;
}

const PRESENTATION_ANIMATION_DEFINITIONS: readonly PresentationAnimationDefinition[] = [
    {
        key: PRESENTATION_ANIMATION_KEYS.enemyPatrol,
        textureKey: PRESENTATION_SPRITESHEETS.enemy.key,
        start: 0,
        end: 3,
        frameRate: 8,
        repeat: -1,
    },
    {
        key: PRESENTATION_ANIMATION_KEYS.collectiblePulse,
        textureKey: PRESENTATION_SPRITESHEETS.collectible.key,
        start: 0,
        end: 5,
        frameRate: 10,
        repeat: -1,
    },
    {
        key: PRESENTATION_ANIMATION_KEYS.checkpointIdle,
        textureKey: PRESENTATION_SPRITESHEETS.checkpoint.key,
        start: 0,
        end: 3,
        frameRate: 5,
        repeat: -1,
    },
    {
        key: PRESENTATION_ANIMATION_KEYS.checkpointActive,
        textureKey: PRESENTATION_SPRITESHEETS.checkpoint.key,
        start: 4,
        end: 7,
        frameRate: 10,
        repeat: -1,
    },
    {
        key: PRESENTATION_ANIMATION_KEYS.goalIdle,
        textureKey: PRESENTATION_SPRITESHEETS.goal.key,
        start: 0,
        end: 5,
        frameRate: 8,
        repeat: -1,
    },
] as const;

export function registerPresentationAnimations(registrar: PresentationAnimationRegistrar): string[] {
    const created: string[] = [];

    for (const def of PRESENTATION_ANIMATION_DEFINITIONS) {
        if (registrar.exists(def.key)) {
            continue;
        }

        registrar.create({
            key: def.key,
            frames: registrar.generateFrameNumbers(def.textureKey, {
                start: def.start,
                end: def.end,
            }),
            frameRate: def.frameRate,
            repeat: def.repeat,
        });
        created.push(def.key);
    }

    return created;
}

export function getPresentationAnimationDefinitions(): readonly PresentationAnimationDefinition[] {
    return PRESENTATION_ANIMATION_DEFINITIONS;
}
