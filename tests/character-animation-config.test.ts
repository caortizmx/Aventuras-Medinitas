import { describe, it, expect } from 'vitest';
import {
    CHARACTER_IDS,
    CHARACTER_SPRITESHEET_SPEC,
    CHARACTER_FALLBACK_CONFIG,
    EXPECTED_CHARACTER_SPRITE_FILES,
    getCharacterAssetKey,
    getMissingCharacterAssetKeys,
} from '../src/game/constants/characterSpriteConfig';
import {
    CHARACTER_ANIMATION_STATES,
    getCharacterAnimationKey,
} from '../src/game/constants/animationKeys';
import {
    getRequiredCharacterAnimationDefinitions,
    registerCharacterAnimations,
} from '../src/game/animations/characterAnimations';
import { CHARACTERS } from '../src/game/data/characters';

describe('character asset configuration', () => {
    it('defines expected sprite sheet files for all characters', () => {
        for (const id of CHARACTER_IDS) {
            expect(EXPECTED_CHARACTER_SPRITE_FILES[id]).toMatch(/^characters\/.+-sheet\.png$/);
        }
    });

    it('maps character configs to centralized asset keys', () => {
        for (const cfg of CHARACTERS) {
            expect(cfg.assetKey).toBe(getCharacterAssetKey(cfg.id));
        }
    });
});

describe('animation key configuration', () => {
    it('includes all required states', () => {
        expect(CHARACTER_ANIMATION_STATES).toEqual([
            'idle',
            'run',
            'jump',
            'fall',
            'hurt',
            'celebrate',
        ]);
    });

    it('builds stable state keys per character', () => {
        expect(getCharacterAnimationKey('emma', 'idle')).toBe('emma-idle');
        expect(getCharacterAnimationKey('israel', 'celebrate')).toBe('israel-celebrate');
    });
});

describe('required animation definitions', () => {
    it('generates one definition per character/state pair', () => {
        const defs = getRequiredCharacterAnimationDefinitions();
        expect(defs).toHaveLength(CHARACTER_IDS.length * CHARACTER_ANIMATION_STATES.length);
    });

    it('matches sprite-sheet frame ranges and counts', () => {
        for (const def of getRequiredCharacterAnimationDefinitions()) {
            const spec = CHARACTER_SPRITESHEET_SPEC.animations[def.state];
            expect(def.start).toBe(spec.start);
            expect(def.end).toBe(spec.end);
            expect(def.end - def.start + 1).toBe(spec.frames);
        }
    });
});

describe('duplicate animation prevention', () => {
    it('does not create duplicate animations when called repeatedly', () => {
        const existing = new Set<string>();
        let createCalls = 0;

        const registrar = {
            exists: (key: string) => existing.has(key),
            create: ({ key }: { key: string }) => {
                createCalls += 1;
                existing.add(key);
            },
            generateFrameNumbers: (_key: string, cfg: { start: number; end: number }) =>
                Array.from({ length: cfg.end - cfg.start + 1 }, (_, i) => cfg.start + i),
        };

        const firstPass = registerCharacterAnimations(registrar);
        const secondPass = registerCharacterAnimations(registrar);

        expect(firstPass.length).toBeGreaterThan(0);
        expect(secondPass).toHaveLength(0);
        expect(createCalls).toBe(firstPass.length);
    });
});

describe('missing asset fallback configuration', () => {
    it('reports missing keys using the centralized asset list', () => {
        const missing = getMissingCharacterAssetKeys((key) => key !== getCharacterAssetKey('orel'));
        expect(missing).toContain(getCharacterAssetKey('orel'));
        expect(missing).not.toContain(getCharacterAssetKey('emma'));
    });

    it('uses fallback texture dimensions aligned to spritesheet layout', () => {
        expect(CHARACTER_FALLBACK_CONFIG.textureWidth).toBe(
            CHARACTER_SPRITESHEET_SPEC.frameWidth * CHARACTER_SPRITESHEET_SPEC.columns,
        );
        expect(CHARACTER_FALLBACK_CONFIG.textureHeight).toBe(
            CHARACTER_SPRITESHEET_SPEC.frameHeight * CHARACTER_SPRITESHEET_SPEC.rows,
        );
    });
});
