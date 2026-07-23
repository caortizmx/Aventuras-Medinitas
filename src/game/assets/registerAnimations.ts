import { ATLAS_ANIMATION_DEFINITIONS, AtlasAnimationDefinition } from './animationDefinitions';

export interface AtlasAnimationRegistrar {
    exists: (key: string) => boolean;
    create: (config: Phaser.Types.Animations.Animation) => unknown;
}

export function registerAtlasAnimations(
    registrar: AtlasAnimationRegistrar,
    definitions: readonly AtlasAnimationDefinition[] = ATLAS_ANIMATION_DEFINITIONS,
): string[] {
    const created: string[] = [];

    for (const definition of definitions) {
        if (registrar.exists(definition.key)) {
            continue;
        }

        registrar.create({
            key: definition.key,
            frames: definition.frames.map((frame) => ({
                key: definition.textureKey,
                frame,
            })),
            frameRate: definition.frameRate,
            repeat: definition.repeat,
        });
        created.push(definition.key);
    }

    return created;
}