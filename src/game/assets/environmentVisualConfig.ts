import { ATLAS_KEYS } from './assetKeys';

export const ENVIRONMENT_VISUALS = {
    atlasKey: ATLAS_KEYS.environment,
    sky: 'background_sky_clouds',
    farMountains: 'background_mountains_far',
    hills: 'background_hills_foliage_combined',
    fallbackGround: 'terrain_grass_top_00',
    fallbackPlatform: 'platform_wood_00',
} as const;