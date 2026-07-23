import { ATLAS_KEYS } from './assetKeys';
import { RENDER_DEPTHS } from '../constants/renderDepths';

export const ENVIRONMENT_VISUALS = {
    atlasKey: ATLAS_KEYS.environment,
    sky: 'background_sky_clouds',
    farMountains: 'background_mountains_far',
    hills: 'background_hills_foliage_combined',
    fallbackGround: 'terrain_grass_top_00',
    fallbackPlatform: 'platform_wood_00',
} as const;

export type TerrainVisualType = 'ground' | 'platform';

export interface TerrainVisualMapping {
    frame: string;
    depth: number;
    originX: number;
    originY: number;
    visualOffsetX: number;
    visualOffsetY: number;
    tileableHorizontally: boolean;
    minimumWidth: number;
}

export const TERRAIN_VISUAL_MAPPINGS: Readonly<Record<TerrainVisualType, TerrainVisualMapping>> = {
    ground: {
        frame: 'terrain_grass_top_00',
        depth: RENDER_DEPTHS.terrain,
        originX: 0,
        originY: 0,
        visualOffsetX: 0,
        visualOffsetY: 0,
        tileableHorizontally: true,
        minimumWidth: 32,
    },
    platform: {
        frame: 'platform_wood_00',
        depth: RENDER_DEPTHS.terrain + 1,
        originX: 0.5,
        originY: 0,
        visualOffsetX: 0,
        visualOffsetY: -8,
        tileableHorizontally: false,
        minimumWidth: 64,
    },
};

export interface BackgroundLayerConfig {
    id: 'sky' | 'mountains' | 'hills';
    frame: string;
    depth: number;
    scrollFactor: number;
    heightRatio: number;
    bottomRatio: number;
}

export const BACKGROUND_LAYERS: readonly BackgroundLayerConfig[] = [
    {
        id: 'sky',
        frame: ENVIRONMENT_VISUALS.sky,
        depth: RENDER_DEPTHS.backgroundSky,
        scrollFactor: 0.02,
        heightRatio: 1,
        bottomRatio: 1,
    },
    {
        id: 'mountains',
        frame: ENVIRONMENT_VISUALS.farMountains,
        depth: RENDER_DEPTHS.backgroundMountains,
        scrollFactor: 0.16,
        heightRatio: 0.46,
        bottomRatio: 0.78,
    },
    {
        id: 'hills',
        frame: ENVIRONMENT_VISUALS.hills,
        depth: RENDER_DEPTHS.backgroundHills,
        scrollFactor: 0.34,
        heightRatio: 0.54,
        bottomRatio: 1,
    },
] as const;

export function resolveTerrainVisual(type: string): TerrainVisualMapping | undefined {
    return type === 'ground' || type === 'platform'
        ? TERRAIN_VISUAL_MAPPINGS[type]
        : undefined;
}

export function shouldShowDebugUi(isDevelopment: boolean, explicitlyEnabled: boolean): boolean {
    return isDevelopment && explicitlyEnabled;
}