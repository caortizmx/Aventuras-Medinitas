import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_ATLAS_KEYS } from '../src/game/assets/assetKeys';
import { ATLAS_PATHS } from '../src/game/assets/assetPaths';
import { ATLAS_ANIMATION_DEFINITIONS } from '../src/game/assets/animationDefinitions';
import { registerAtlasAnimations } from '../src/game/assets/registerAnimations';

describe('atlas runtime configuration', () => {
    it('uses rooted public URLs for all five atlas pairs', () => {
        expect(REQUIRED_ATLAS_KEYS).toHaveLength(5);
        for (const key of REQUIRED_ATLAS_KEYS) {
            expect(ATLAS_PATHS[key].textureURL).toMatch(/^\/assets\/game\/.+\.png$/);
            expect(ATLAS_PATHS[key].atlasURL).toMatch(/^\/assets\/game\/.+\.json$/);
        }
    });

    it('registers explicit frames idempotently and in definition order', () => {
        const existing = new Set<string>();
        const create = vi.fn((config: Phaser.Types.Animations.Animation) => {
            if (config.key) existing.add(config.key);
        });
        const registrar = { exists: (key: string) => existing.has(key), create };

        expect(registerAtlasAnimations(registrar)).toEqual(
            ATLAS_ANIMATION_DEFINITIONS.map(({ key }) => key),
        );
        expect(registerAtlasAnimations(registrar)).toEqual([]);
        expect(create).toHaveBeenCalledTimes(ATLAS_ANIMATION_DEFINITIONS.length);
    });
});
