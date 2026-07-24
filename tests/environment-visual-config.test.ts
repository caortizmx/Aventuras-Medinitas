import { describe, expect, it } from 'vitest';
import {
    BACKGROUND_LAYERS,
    resolveTerrainVisual,
    shouldShowDebugUi,
    TERRAIN_VISUAL_MAPPINGS,
} from '../src/game/assets/environmentVisualConfig';
import { RENDER_DEPTHS } from '../src/game/constants/renderDepths';
import environmentAtlasRaw from '../public/assets/game/atlases/environment/environment_atlas.json?raw';

describe('environment visual configuration', () => {
    it('has explicit existing-art terrain mappings for both themes', () => {
        const frames = Object.values(TERRAIN_VISUAL_MAPPINGS)
            .flatMap((theme) => Object.values(theme).map(({ frame }) => frame));
        expect(frames).toEqual(expect.arrayContaining([
            'terrain_grass_top_00',
            'platform_wood_00',
            'terrain_stone_00',
            'platform_wood_01',
        ]));
        expect(resolveTerrainVisual('ground', 'green-valley'))
            .toBe(TERRAIN_VISUAL_MAPPINGS['green-valley'].ground);
        expect(resolveTerrainVisual('platform', 'mountain-ruins'))
            .toBe(TERRAIN_VISUAL_MAPPINGS['mountain-ruins'].platform);
        expect(TERRAIN_VISUAL_MAPPINGS['mountain-ruins'].ground.alternateFrames)
            .toContain('terrain_dirt_cliff_00');
        const atlas = JSON.parse(environmentAtlasRaw) as { frames: Record<string, unknown> };
        for (const frame of frames) {
            expect(atlas.frames[frame]).toBeDefined();
        }
        expect(atlas.frames.terrain_dirt_cliff_00).toBeDefined();
    });

    it('returns no production placeholder for an unknown terrain type', () => {
        expect(resolveTerrainVisual('missing-terrain')).toBeUndefined();
    });

    it('defines one horizontally composed background layer per visual region', () => {
        expect(BACKGROUND_LAYERS.map(({ id }) => id)).toEqual(['sky', 'mountains', 'hills']);
        expect(new Set(BACKGROUND_LAYERS.map(({ frame }) => frame)).size).toBe(BACKGROUND_LAYERS.length);
        for (const layer of BACKGROUND_LAYERS) {
            expect(layer.heightRatio).toBeGreaterThan(0);
            expect(layer.heightRatio).toBeLessThanOrEqual(1);
            expect(layer.scrollFactor).toBeGreaterThanOrEqual(0);
            expect(layer.scrollFactor).toBeLessThan(1);
        }
    });

    it('keeps rendering depths in back-to-front order', () => {
        expect(RENDER_DEPTHS.backgroundSky).toBeLessThan(RENDER_DEPTHS.backgroundMountains);
        expect(RENDER_DEPTHS.backgroundMountains).toBeLessThan(RENDER_DEPTHS.backgroundHills);
        expect(RENDER_DEPTHS.backgroundHills).toBeLessThan(RENDER_DEPTHS.terrain);
        expect(RENDER_DEPTHS.terrain).toBeLessThan(RENDER_DEPTHS.player);
        expect(RENDER_DEPTHS.player).toBeLessThan(RENDER_DEPTHS.hud);
        expect(RENDER_DEPTHS.hud).toBeLessThan(RENDER_DEPTHS.modal);
    });

    it('shows debug UI only in development when explicitly enabled', () => {
        expect(shouldShowDebugUi(true, true)).toBe(true);
        expect(shouldShowDebugUi(true, false)).toBe(false);
        expect(shouldShowDebugUi(false, true)).toBe(false);
        expect(shouldShowDebugUi(false, false)).toBe(false);
    });
});
