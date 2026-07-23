import { describe, expect, it } from 'vitest';
import {
    PRESENTATION_SPRITESHEETS,
    PRESENTATION_TEXTURES,
    REQUIRED_PRESENTATION_ASSET_FILES,
} from '../src/game/constants/presentationAssetConfig';
import { PRESENTATION_ANIMATION_KEYS } from '../src/game/constants/presentationAnimationKeys';
import {
    getPresentationAnimationDefinitions,
    PresentationAnimationRegistrar,
    registerPresentationAnimations,
} from '../src/game/animations/presentationAnimations';

describe('presentation asset configuration', () => {
    it('defines stable spritesheet paths and dimensions', () => {
        for (const spec of Object.values(PRESENTATION_SPRITESHEETS)) {
            expect(spec.filePath).toMatch(/^(entities|collectibles|props)\/.+\.png$/);
            expect(spec.frameWidth).toBeGreaterThan(0);
            expect(spec.frameHeight).toBeGreaterThan(0);
        }
    });

    it('defines stable texture paths', () => {
        for (const texture of Object.values(PRESENTATION_TEXTURES)) {
            expect(texture.filePath).toMatch(/^(terrain|ui)\/.+\.png$/);
        }
    });

    it('exports all required asset file paths', () => {
        expect(REQUIRED_PRESENTATION_ASSET_FILES.length).toBe(
            Object.keys(PRESENTATION_SPRITESHEETS).length + Object.keys(PRESENTATION_TEXTURES).length,
        );
    });
});

describe('presentation animations', () => {
    it('uses centralized animation keys', () => {
        const defs = getPresentationAnimationDefinitions();
        const keys = defs.map((def) => def.key);

        expect(keys).toContain(PRESENTATION_ANIMATION_KEYS.enemyPatrol);
        expect(keys).toContain(PRESENTATION_ANIMATION_KEYS.collectiblePulse);
        expect(keys).toContain(PRESENTATION_ANIMATION_KEYS.checkpointIdle);
        expect(keys).toContain(PRESENTATION_ANIMATION_KEYS.checkpointActive);
        expect(keys).toContain(PRESENTATION_ANIMATION_KEYS.goalIdle);
    });

    it('registers once and prevents duplicates on subsequent calls', () => {
        const existing = new Set<string>();
        let createCalls = 0;

        const registrar: PresentationAnimationRegistrar = {
            exists: (key: string) => existing.has(key),
            create: ({ key }) => {
                createCalls += 1;
                if (key) {
                    existing.add(key);
                }
            },
            generateFrameNumbers: (_textureKey: string, cfg: { start: number; end: number }) => {
                return Array.from({ length: cfg.end - cfg.start + 1 }, (_, i) => ({
                    key: `frame-${cfg.start + i}`,
                    frame: cfg.start + i,
                }));
            },
        };

        const firstPass = registerPresentationAnimations(registrar);
        const secondPass = registerPresentationAnimations(registrar);

        expect(firstPass.length).toBeGreaterThan(0);
        expect(secondPass).toHaveLength(0);
        expect(createCalls).toBe(firstPass.length);
    });
});
