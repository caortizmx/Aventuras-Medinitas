import { ATLAS_KEYS, AtlasKey } from './assetKeys';

export interface AtlasAssetPaths {
    textureURL: string;
    atlasURL: string;
}

const GAME_ASSET_ROOT = '/assets/game';

export const ATLAS_PATHS: Readonly<Record<AtlasKey, AtlasAssetPaths>> = {
    [ATLAS_KEYS.emma]: {
        textureURL: `${GAME_ASSET_ROOT}/atlases/characters/emma/emma_atlas.png`,
        atlasURL: `${GAME_ASSET_ROOT}/atlases/characters/emma/emma_atlas.json`,
    },
    [ATLAS_KEYS.orel]: {
        textureURL: `${GAME_ASSET_ROOT}/atlases/characters/orel/orel_atlas.png`,
        atlasURL: `${GAME_ASSET_ROOT}/atlases/characters/orel/orel_atlas.json`,
    },
    [ATLAS_KEYS.israel]: {
        textureURL: `${GAME_ASSET_ROOT}/atlases/characters/israel/israel_atlas.png`,
        atlasURL: `${GAME_ASSET_ROOT}/atlases/characters/israel/israel_atlas.json`,
    },
    [ATLAS_KEYS.gameplay]: {
        textureURL: `${GAME_ASSET_ROOT}/atlases/gameplay/gameplay_assets_atlas.png`,
        atlasURL: `${GAME_ASSET_ROOT}/atlases/gameplay/gameplay_assets_atlas.json`,
    },
    [ATLAS_KEYS.environment]: {
        textureURL: `${GAME_ASSET_ROOT}/atlases/environment/environment_atlas.png`,
        atlasURL: `${GAME_ASSET_ROOT}/atlases/environment/environment_atlas.json`,
    },
};

export const ATLAS_MANIFEST_PATH = `${GAME_ASSET_ROOT}/manifests/atlas_manifest.json`;
export const ANIMATIONS_MANIFEST_PATH = `${GAME_ASSET_ROOT}/manifests/animations_manifest.json`;