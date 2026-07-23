import { describe, expect, it } from 'vitest';
import {
    BACKGROUND_LAYERS,
    resolveTerrainVisual,
    shouldShowDebugUi,
    TERRAIN_VISUAL_MAPPINGS,
} from '../src/game/assets/environmentVisualConfig';
import { RENDER_DEPTHS } from '../src/game/constants/renderDepths';

describe('environment visual configuration', () => {
    it('has one unique atlas frame for every terrain type', () => {
        const frames = Object.values(TERRAIN_VISUAL_MAPPINGS).map(({ frame }) => frame);
        expect(frames).toHaveLength(2);
        expect(new Set(frames).size).toBe(frames.length);
        expect(resolveTerrainVisual('ground')).toBe(TERRAIN_VISUAL_MAPPINGS.ground);
        expect(resolveTerrainVisual('platform')).toBe(TERRAIN_VISUAL_MAPPINGS.platform);
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
