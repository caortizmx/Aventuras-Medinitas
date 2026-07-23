import {
    LEVEL_MAP_ERROR_PREFIX,
    LEVEL_ONE_LAYER_NAMES,
    REQUIRED_LEVEL_OBJECT_LAYERS,
    REQUIRED_LEVEL_TILE_LAYERS,
    REQUIRED_OBJECT_COUNTS,
} from '../constants/tiledLevel';

export interface TiledObjectLike {
    name?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    properties?: Array<{
        name: string;
        value: unknown;
    }>;
}

export interface TiledLayerLike {
    name: string;
    type: string;
    objects?: TiledObjectLike[];
}

export interface TiledMapLike {
    width?: number;
    height?: number;
    tilewidth?: number;
    tileheight?: number;
    layers?: TiledLayerLike[];
}

export interface LevelPoint {
    x: number;
    y: number;
}

export interface LevelRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ValidatedLevelMapData {
    dimensions: {
        widthPixels: number;
        heightPixels: number;
    };
    playerSpawn: LevelPoint;
    levelGoal: LevelRect;
    checkpoints: Array<LevelPoint & { id: string }>;
    enemySpawns: Array<LevelPoint & {
        patrolLeft: number;
        patrolRight: number;
        patrolSpeed: number;
        avoidLedges: boolean;
    }>;
    collectibleSpawns: LevelPoint[];
    killZones: LevelRect[];
}

export class LevelMapValidationError extends Error {
    constructor(message: string) {
        super(`${LEVEL_MAP_ERROR_PREFIX} ${message}`);
        this.name = 'LevelMapValidationError';
    }
}

function requireLayers(map: TiledMapLike): TiledLayerLike[] {
    if (!map.layers || map.layers.length === 0) {
        throw new LevelMapValidationError('map has no layers');
    }
    return map.layers;
}

function requireFiniteNumber(value: number | undefined, label: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new LevelMapValidationError(`${label} must be a finite number`);
    }
    return value;
}

function findLayer(layers: TiledLayerLike[], name: string): TiledLayerLike | undefined {
    return layers.find((layer) => layer.name === name);
}

function requireLayerType(layer: TiledLayerLike, expectedType: 'tilelayer' | 'objectgroup'): void {
    if (layer.type !== expectedType) {
        throw new LevelMapValidationError(`layer "${layer.name}" must be of type "${expectedType}"`);
    }
}

function layerObjects(layer: TiledLayerLike): TiledObjectLike[] {
    return layer.objects ?? [];
}

function toPoint(object: TiledObjectLike, label: string): LevelPoint {
    return {
        x: requireFiniteNumber(object.x, `${label}.x`),
        y: requireFiniteNumber(object.y, `${label}.y`),
    };
}

function toRect(object: TiledObjectLike, label: string): LevelRect {
    const x = requireFiniteNumber(object.x, `${label}.x`);
    const y = requireFiniteNumber(object.y, `${label}.y`);
    const width = requireFiniteNumber(object.width, `${label}.width`);
    const height = requireFiniteNumber(object.height, `${label}.height`);

    if (width <= 0 || height <= 0) {
        throw new LevelMapValidationError(`${label} must have positive width and height`);
    }

    function getObjectProperty(object: TiledObjectLike, propertyName: string): unknown {
        return object.properties?.find((property) => property.name === propertyName)?.value;
    }

    function getFiniteObjectProperty(
        object: TiledObjectLike,
        propertyName: string,
        fallback: number,
        label: string,
    ): number {
        const value = getObjectProperty(object, propertyName);
        if (value === undefined) {
            return fallback;
        }

        if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw new LevelMapValidationError(`${label} property "${propertyName}" must be a finite number`);
        }

        return value;
    }

    function getBooleanObjectProperty(
        object: TiledObjectLike,
        propertyName: string,
        fallback: boolean,
        label: string,
    ): boolean {
        const value = getObjectProperty(object, propertyName);
        if (value === undefined) {
            return fallback;
        }

        if (typeof value !== 'boolean') {
            throw new LevelMapValidationError(`${label} property "${propertyName}" must be a boolean`);
        }

        return value;
    }

    return { x, y, width, height };
}

export function validateRequiredLayers(map: TiledMapLike): void {
    const layers = requireLayers(map);

    for (const layerName of REQUIRED_LEVEL_TILE_LAYERS) {
        const layer = findLayer(layers, layerName);
        if (!layer) {
            throw new LevelMapValidationError(`missing required layer "${layerName}"`);
        }
        requireLayerType(layer, 'tilelayer');
    }

    for (const layerName of REQUIRED_LEVEL_OBJECT_LAYERS) {
        const layer = findLayer(layers, layerName);
        if (!layer) {
            throw new LevelMapValidationError(`missing required layer "${layerName}"`);
        }
        requireLayerType(layer, 'objectgroup');
    }
}

export function validateRequiredObjects(map: TiledMapLike): void {
    const layers = requireLayers(map);

    for (const [layerName, minCount] of Object.entries(REQUIRED_OBJECT_COUNTS)) {
        const layer = findLayer(layers, layerName);
        if (!layer) {
            throw new LevelMapValidationError(`missing required object layer "${layerName}"`);
        }
        const count = layerObjects(layer).length;
        if (count < minCount) {
            throw new LevelMapValidationError(
                `layer "${layerName}" must contain at least ${minCount} object(s), found ${count}`,
            );
        }
    }
}

export function getPlayerSpawn(map: TiledMapLike): LevelPoint {
    const layers = requireLayers(map);
    const layer = findLayer(layers, LEVEL_ONE_LAYER_NAMES.playerSpawn);
    if (!layer) {
        throw new LevelMapValidationError(`missing required object layer "${LEVEL_ONE_LAYER_NAMES.playerSpawn}"`);
    }

    const [firstSpawn] = layerObjects(layer);
    if (!firstSpawn) {
        throw new LevelMapValidationError('player spawn object is missing');
    }

    return toPoint(firstSpawn, 'player spawn');
}

export function getLevelGoal(map: TiledMapLike): LevelRect {
    const layers = requireLayers(map);
    const layer = findLayer(layers, LEVEL_ONE_LAYER_NAMES.levelGoal);
    if (!layer) {
        throw new LevelMapValidationError(`missing required object layer "${LEVEL_ONE_LAYER_NAMES.levelGoal}"`);
    }

    const [goal] = layerObjects(layer);
    if (!goal) {
        throw new LevelMapValidationError('level goal object is missing');
    }

    return toRect(goal, 'level goal');
}

export function getKillZones(map: TiledMapLike): LevelRect[] {
    const layers = requireLayers(map);
    const layer = findLayer(layers, LEVEL_ONE_LAYER_NAMES.killZones);
    if (!layer) {
        throw new LevelMapValidationError(`missing required object layer "${LEVEL_ONE_LAYER_NAMES.killZones}"`);
    }

    const zones = layerObjects(layer).map((zone, index) => toRect(zone, `kill zone ${index + 1}`));
    if (zones.length === 0) {
        throw new LevelMapValidationError('at least one kill zone object is required');
    }

    return zones;
}

function getObjectPoints(map: TiledMapLike, layerName: string): LevelPoint[] {
    const layers = requireLayers(map);
    const layer = findLayer(layers, layerName);
    if (!layer) {
        throw new LevelMapValidationError(`missing required object layer "${layerName}"`);
    }

    function getCheckpoints(map: TiledMapLike): Array<LevelPoint & { id: string }> {
        const layers = requireLayers(map);
        const layer = findLayer(layers, LEVEL_ONE_LAYER_NAMES.checkpoints);
        if (!layer) {
            throw new LevelMapValidationError(`missing required object layer "${LEVEL_ONE_LAYER_NAMES.checkpoints}"`);
        }

        return layerObjects(layer).map((object, index) => ({
            ...toPoint(object, `checkpoint ${index + 1}`),
            id: object.name && object.name.trim().length > 0 ? object.name : `checkpoint-${index + 1}`,
        }));
    }

    function getEnemySpawns(map: TiledMapLike): Array<LevelPoint & {
        patrolLeft: number;
        patrolRight: number;
        patrolSpeed: number;
        avoidLedges: boolean;
    }> {
        const layers = requireLayers(map);
        const layer = findLayer(layers, LEVEL_ONE_LAYER_NAMES.enemySpawns);
        if (!layer) {
            throw new LevelMapValidationError(`missing required object layer "${LEVEL_ONE_LAYER_NAMES.enemySpawns}"`);
        }

        return layerObjects(layer).map((object, index) => {
            const spawn = toPoint(object, `enemy spawn ${index + 1}`);
            const label = `enemy spawn ${index + 1}`;

            const patrolLeft = getFiniteObjectProperty(object, 'patrolLeft', spawn.x - 160, label);
            const patrolRight = getFiniteObjectProperty(object, 'patrolRight', spawn.x + 160, label);
            const patrolSpeed = getFiniteObjectProperty(object, 'patrolSpeed', 90, label);
            const avoidLedges = getBooleanObjectProperty(object, 'avoidLedges', true, label);

            if (patrolLeft >= patrolRight) {
                throw new LevelMapValidationError(`${label} patrolLeft must be less than patrolRight`);
            }
            if (patrolSpeed <= 0) {
                throw new LevelMapValidationError(`${label} patrolSpeed must be greater than zero`);
            }

            return {
                ...spawn,
                patrolLeft,
                patrolRight,
                patrolSpeed,
                avoidLedges,
            };
        });
    }

    return layerObjects(layer).map((object, index) => toPoint(object, `${layerName} object ${index + 1}`));
}

export function validateAndExtractLevelMapData(map: TiledMapLike): ValidatedLevelMapData {
    validateRequiredLayers(map);
    validateRequiredObjects(map);

    const width = requireFiniteNumber(map.width, 'map.width');
    const height = requireFiniteNumber(map.height, 'map.height');
    const tileWidth = requireFiniteNumber(map.tilewidth, 'map.tilewidth');
    const tileHeight = requireFiniteNumber(map.tileheight, 'map.tileheight');

    return {
        dimensions: {
            widthPixels: width * tileWidth,
            heightPixels: height * tileHeight,
        },
        playerSpawn: getPlayerSpawn(map),
        levelGoal: getLevelGoal(map),
        checkpoints: getCheckpoints(map),
        enemySpawns: getEnemySpawns(map),
        collectibleSpawns: getObjectPoints(map, LEVEL_ONE_LAYER_NAMES.collectibleSpawns),
        killZones: getKillZones(map),
    };
}
