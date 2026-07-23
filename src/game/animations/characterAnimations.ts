import {
    CharacterId,
    CHARACTER_IDS,
    CHARACTER_SPRITESHEET_SPEC,
    getCharacterAssetKey,
} from '../constants/characterSpriteConfig';
import {
    CharacterAnimationState,
    CHARACTER_ANIMATION_STATES,
    getCharacterAnimationKey,
} from '../constants/animationKeys';

export interface CharacterAnimationDefinition {
    characterId: CharacterId;
    state: CharacterAnimationState;
    key: string;
    textureKey: string;
    start: number;
    end: number;
    frameRate: number;
    repeat: number;
}

export interface AnimationRegistrar {
    exists: (key: string) => boolean;
    create: (config: {
        key: string;
        frames: unknown;
        frameRate: number;
        repeat: number;
    }) => unknown;
    generateFrameNumbers: (
        key: string,
        config: { start: number; end: number },
    ) => unknown;
}

export function getRequiredCharacterAnimationDefinitions(): CharacterAnimationDefinition[] {
    return CHARACTER_IDS.flatMap((characterId) =>
        CHARACTER_ANIMATION_STATES.map((state) => {
            const slice = CHARACTER_SPRITESHEET_SPEC.animations[state];
            return {
                characterId,
                state,
                key:        getCharacterAnimationKey(characterId, state),
                textureKey: getCharacterAssetKey(characterId),
                start:      slice.start,
                end:        slice.end,
                frameRate:  slice.frameRate,
                repeat:     slice.repeat,
            };
        }),
    );
}

export function registerCharacterAnimations(registrar: AnimationRegistrar): string[] {
    const created: string[] = [];

    for (const def of getRequiredCharacterAnimationDefinitions()) {
        if (registrar.exists(def.key)) {
            continue;
        }

        registrar.create({
            key: def.key,
            frames: registrar.generateFrameNumbers(def.textureKey, {
                start: def.start,
                end:   def.end,
            }),
            frameRate: def.frameRate,
            repeat:    def.repeat,
        });
        created.push(def.key);
    }

    return created;
}
