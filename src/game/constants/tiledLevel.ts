export const LEVEL_ONE_MAP_ASSET_KEY = 'level-one-map';
export const LEVEL_ONE_TILESET_ASSET_KEY = 'level-one-tiles';

export const LEVEL_ONE_MAP_PATH = 'maps/level-one.json';
export const LEVEL_TWO_MAP_PATH = 'maps/level-two.json';
export const LEVEL_ONE_TILESET_IMAGE_PATH = 'tiles/level-one-tiles.png';

export const LEVEL_ONE_TILESET_NAME = 'level-one-tileset';
// One 768px viewport plus 432px of extra fall distance keeps kill triggers
// active until the physics world's padded lower boundary.
export const LEVEL_WORLD_BOTTOM_PADDING = 1200;

export const LEVEL_ONE_LAYER_NAMES = {
    background: 'Background',
    ground: 'Ground',
    platforms: 'Platforms',
    decorationBehind: 'DecorationBehind',
    decorationFront: 'DecorationFront',
    collision: 'Collision',
    playerSpawn: 'PlayerSpawn',
    checkpoints: 'Checkpoints',
    enemySpawns: 'EnemySpawns',
    collectibleSpawns: 'CollectibleSpawns',
    levelGoal: 'LevelGoal',
    killZones: 'KillZones',
} as const;

export const REQUIRED_LEVEL_TILE_LAYERS: readonly string[] = [
    LEVEL_ONE_LAYER_NAMES.background,
    LEVEL_ONE_LAYER_NAMES.ground,
    LEVEL_ONE_LAYER_NAMES.platforms,
    LEVEL_ONE_LAYER_NAMES.decorationBehind,
    LEVEL_ONE_LAYER_NAMES.decorationFront,
    LEVEL_ONE_LAYER_NAMES.collision,
];

export const REQUIRED_LEVEL_OBJECT_LAYERS: readonly string[] = [
    LEVEL_ONE_LAYER_NAMES.playerSpawn,
    LEVEL_ONE_LAYER_NAMES.checkpoints,
    LEVEL_ONE_LAYER_NAMES.enemySpawns,
    LEVEL_ONE_LAYER_NAMES.collectibleSpawns,
    LEVEL_ONE_LAYER_NAMES.levelGoal,
    LEVEL_ONE_LAYER_NAMES.killZones,
];

export const REQUIRED_OBJECT_COUNTS: Readonly<Record<string, number>> = {
    [LEVEL_ONE_LAYER_NAMES.playerSpawn]: 1,
    [LEVEL_ONE_LAYER_NAMES.checkpoints]: 1,
    [LEVEL_ONE_LAYER_NAMES.enemySpawns]: 1,
    [LEVEL_ONE_LAYER_NAMES.collectibleSpawns]: 3,
    [LEVEL_ONE_LAYER_NAMES.levelGoal]: 1,
    [LEVEL_ONE_LAYER_NAMES.killZones]: 1,
};

export const LEVEL_ONE_COLLECTIBLE_TARGET_COUNT = 27;

export const LEVEL_MAP_ERROR_PREFIX = '[LevelOne:TiledMapInvalid]';
