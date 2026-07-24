import {
    LEVEL_MAP_ERROR_PREFIX,
    LEVEL_ONE_LAYER_NAMES,
    REQUIRED_LEVEL_OBJECT_LAYERS,
    REQUIRED_LEVEL_TILE_LAYERS,
    REQUIRED_OBJECT_COUNTS,
    LEVEL_WORLD_BOTTOM_PADDING,
} from '../constants/tiledLevel';
import { LevelDefinition } from '../constants/campaign';
import { GRAVITY, JUMP_FORCE, PLAYER_SPEED } from '../constants/gameValues';
import { TERRAIN_VISUAL_MAPPINGS } from '../assets/environmentVisualConfig';

export interface TiledObjectLike {
    name?: string;
    type?: string;
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
    data?: number[];
}

export interface TiledMapLike {
    width?: number;
    height?: number;
    tilewidth?: number;
    tileheight?: number;
    layers?: TiledLayerLike[];
    properties?: Array<{
        name: string;
        value: unknown;
    }>;
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
    checkpoints: Array<LevelPoint & { id: string; order: number; respawnOffsetY: number }>;
    enemySpawns: Array<LevelPoint & {
        id: string;
        order: number;
        patrolLeft: number;
        patrolRight: number;
        patrolSpeed: number;
        avoidLedges: boolean;
        visualVariant: 'small' | 'large';
    }>;
    collectibleSpawns: Array<LevelPoint & { id: string; order: number }>;
    killZones: LevelRect[];
    warnings: string[];
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

    return { x, y, width, height };
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

function getRequiredStringProperty(
    object: TiledObjectLike,
    propertyName: string,
    label: string,
): string {
    const value = getObjectProperty(object, propertyName);
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new LevelMapValidationError(`${label} property "${propertyName}" must be a non-empty string`);
    }
    return value;
}

function getRequiredOrder(object: TiledObjectLike, label: string): number {
    const value = getFiniteObjectProperty(object, 'order', Number.NaN, label);
    if (!Number.isInteger(value) || value <= 0) {
        throw new LevelMapValidationError(`${label} property "order" must be a positive integer`);
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

function getEnemyVariant(object: TiledObjectLike, label: string): 'small' | 'large' {
    const value = getObjectProperty(object, 'visualVariant');
    if (value === 'small' || value === 'large') {
        return value;
    }
    if (value === undefined) {
        return 'small';
    }
    throw new LevelMapValidationError(`${label} property "visualVariant" must be "small" or "large"`);
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

function getCollectibles(map: TiledMapLike): Array<LevelPoint & { id: string; order: number }> {
    const layers = requireLayers(map);
    const layer = findLayer(layers, LEVEL_ONE_LAYER_NAMES.collectibleSpawns);
    if (!layer) {
        throw new LevelMapValidationError(
            `missing required object layer "${LEVEL_ONE_LAYER_NAMES.collectibleSpawns}"`,
        );
    }

    return layerObjects(layer).map((object, index) => {
        const label = `collectible ${index + 1}`;
        if (object.type !== undefined && object.type !== 'collectible') {
            throw new LevelMapValidationError(`${label} type must be "collectible"`);
        }
        return {
            ...toPoint(object, label),
            id: typeof getObjectProperty(object, 'collectibleId') === 'string'
                ? getRequiredStringProperty(object, 'collectibleId', label)
                : object.name?.trim() || `collectible-${index + 1}`,
            order: getObjectProperty(object, 'order') === undefined
                ? index + 1
                : getRequiredOrder(object, label),
        };
    }).sort((a, b) => a.order - b.order);
}

function getCheckpoints(map: TiledMapLike): Array<
LevelPoint & { id: string; order: number; respawnOffsetY: number }
> {
    const layers = requireLayers(map);
    const layer = findLayer(layers, LEVEL_ONE_LAYER_NAMES.checkpoints);
    if (!layer) {
        throw new LevelMapValidationError(`missing required object layer "${LEVEL_ONE_LAYER_NAMES.checkpoints}"`);
    }

    return layerObjects(layer).map((object, index) => {
        const label = `checkpoint ${index + 1}`;
        if (object.type !== undefined && object.type !== 'checkpoint') {
            throw new LevelMapValidationError(`${label} type must be "checkpoint"`);
        }
        return {
            ...toPoint(object, label),
            id: typeof getObjectProperty(object, 'checkpointId') === 'string'
                ? getRequiredStringProperty(object, 'checkpointId', label)
                : object.name?.trim() || `checkpoint-${index + 1}`,
            order: getObjectProperty(object, 'order') === undefined
                ? index + 1
                : getRequiredOrder(object, label),
            respawnOffsetY: getFiniteObjectProperty(object, 'respawnOffsetY', -8, label),
        };
    }).sort((a, b) => a.order - b.order);
}

function getEnemySpawns(map: TiledMapLike): Array<LevelPoint & {
    id: string;
    order: number;
    patrolLeft: number;
    patrolRight: number;
    patrolSpeed: number;
    avoidLedges: boolean;
    visualVariant: 'small' | 'large';
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

        const visualVariant = getEnemyVariant(object, label);
        if (object.type !== undefined && object.type !== visualVariant) {
            throw new LevelMapValidationError(`${label} type must match visualVariant`);
        }
        return {
            ...spawn,
            id: typeof getObjectProperty(object, 'enemyId') === 'string'
                ? getRequiredStringProperty(object, 'enemyId', label)
                : object.name?.trim() || `enemy-${index + 1}`,
            order: getObjectProperty(object, 'order') === undefined
                ? index + 1
                : getRequiredOrder(object, label),
            patrolLeft,
            patrolRight,
            patrolSpeed,
            avoidLedges,
            visualVariant,
        };
    }).sort((a, b) => a.order - b.order);
}

function validateUniqueIds(
    values: Array<{ id: string }>,
    label: string,
    levelId: string,
): void {
    if (new Set(values.map(({ id }) => id)).size !== values.length) {
        throw new LevelMapValidationError(`${levelId} ${label} ids must be unique`);
    }
}

function validateOrdered(
    values: Array<{ order: number; x: number }>,
    label: string,
    levelId: string,
): void {
    values.forEach(({ order }, index) => {
        if (order !== index + 1) {
            throw new LevelMapValidationError(`${levelId} ${label} order must be contiguous from 1`);
        }
    });
    for (let index = 1; index < values.length; index += 1) {
        if ((values[index]?.x ?? 0) <= (values[index - 1]?.x ?? 0)) {
            throw new LevelMapValidationError(`${levelId} ${label} order must progress left to right`);
        }
    }
}

function buildCollisionQueries(map: TiledMapLike) {
    const tileWidth = map.tilewidth ?? 0;
    const tileHeight = map.tileheight ?? 0;
    const mapWidth = map.width ?? 0;
    const mapHeight = map.height ?? 0;
    const collision = map.layers?.find(({ name }) => name === LEVEL_ONE_LAYER_NAMES.collision)?.data ?? [];
    const tileAt = (column: number, row: number): number =>
        column >= 0 && column < mapWidth && row >= 0 && row < mapHeight
            ? collision[row * mapWidth + column] ?? 0
            : 0;
    const pointInCollision = ({ x, y }: LevelPoint): boolean =>
        tileAt(Math.floor(x / tileWidth), Math.floor(y / tileHeight)) > 0;
    const rectOverlapsCollision = (rect: LevelRect): boolean => {
        const minColumn = Math.max(0, Math.floor(rect.x / tileWidth));
        const maxColumn = Math.min(mapWidth - 1, Math.ceil((rect.x + rect.width) / tileWidth) - 1);
        const minRow = Math.max(0, Math.floor(rect.y / tileHeight));
        const maxRow = Math.min(mapHeight - 1, Math.ceil((rect.y + rect.height) / tileHeight) - 1);
        for (let row = minRow; row <= maxRow; row += 1) {
            for (let column = minColumn; column <= maxColumn; column += 1) {
                if (tileAt(column, row) > 0) {
                    return true;
                }
            }
        }
        return false;
    };
    const hasSurfaceAt = (x: number, y: number): boolean =>
        tileAt(Math.floor(x / tileWidth), Math.floor((y + 1) / tileHeight)) > 0;
    const nearestSurfaceBelow = (point: LevelPoint): number | undefined => {
        const column = Math.floor(point.x / tileWidth);
        for (let row = Math.floor(point.y / tileHeight); row < mapHeight; row += 1) {
            if (tileAt(column, row) > 0) {
                return row * tileHeight;
            }
        }
        return undefined;
    };
    return { pointInCollision, rectOverlapsCollision, hasSurfaceAt, nearestSurfaceBelow, tileAt };
}

function pointInRect(point: LevelPoint, rect: LevelRect): boolean {
    return point.x >= rect.x && point.x <= rect.x + rect.width
        && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function buildJumpWarnings(map: TiledMapLike, data: ValidatedLevelMapData): string[] {
    const warnings: string[] = [];
    const maxJumpHeight = (Math.abs(JUMP_FORCE) ** 2) / (2 * GRAVITY);
    const maxJumpDistance = PLAYER_SPEED * ((2 * Math.abs(JUMP_FORCE)) / GRAVITY);
    const queries = buildCollisionQueries(map);
    for (const point of [...data.checkpoints, ...data.collectibleSpawns]) {
        const surfaceY = queries.nearestSurfaceBelow(point);
        if (surfaceY !== undefined && surfaceY - point.y > maxJumpHeight) {
            warnings.push(`object at (${point.x}, ${point.y}) is above the ${Math.round(maxJumpHeight)}px jump height`);
        }
    }

    const groundRow = (map.height ?? 1) - 2;
    let gapStart: number | undefined;
    for (let column = 0; column <= (map.width ?? 0); column += 1) {
        const empty = column < (map.width ?? 0) && queries.tileAt(column, groundRow) === 0;
        if (empty && gapStart === undefined) {
            gapStart = column;
        } else if (!empty && gapStart !== undefined) {
            const gapWidth = (column - gapStart) * (map.tilewidth ?? 0);
            if (gapStart > 0 && column < (map.width ?? 0) && gapWidth > maxJumpDistance) {
                warnings.push(`ground gap ${gapWidth}px exceeds ${Math.round(maxJumpDistance)}px jump distance`);
            }
            gapStart = undefined;
        }
    }
    return warnings;
}

function validateConfiguredMap(
    map: TiledMapLike,
    data: ValidatedLevelMapData,
    level: LevelDefinition,
): void {
    const objectCount = (name: string): number =>
        map.layers?.find((layer) => layer.name === name)?.objects?.length ?? 0;
    const expectedObjects: Array<[string, number, number]> = [
        [LEVEL_ONE_LAYER_NAMES.playerSpawn, 1, objectCount(LEVEL_ONE_LAYER_NAMES.playerSpawn)],
        [LEVEL_ONE_LAYER_NAMES.checkpoints, level.checkpointCount, data.checkpoints.length],
        [LEVEL_ONE_LAYER_NAMES.enemySpawns,
            level.enemyCounts.small + level.enemyCounts.large, data.enemySpawns.length],
        [LEVEL_ONE_LAYER_NAMES.collectibleSpawns, level.collectibleCount, data.collectibleSpawns.length],
        [LEVEL_ONE_LAYER_NAMES.levelGoal, 1, objectCount(LEVEL_ONE_LAYER_NAMES.levelGoal)],
    ];
    for (const [name, expected, actual] of expectedObjects) {
        if (actual !== expected) {
            throw new LevelMapValidationError(
                `${level.id} layer "${name}" must contain exactly ${expected} object(s), found ${actual}`,
            );
        }
    }

    const variantCounts = data.enemySpawns.reduce((counts, enemy) => {
        counts[enemy.visualVariant] += 1;
        return counts;
    }, { small: 0, large: 0 });
    if (variantCounts.small !== level.enemyCounts.small || variantCounts.large !== level.enemyCounts.large) {
        throw new LevelMapValidationError(
            `${level.id} enemies must include exactly ${level.enemyCounts.small} small and `
            + `${level.enemyCounts.large} large`,
        );
    }

    validateUniqueIds(data.checkpoints, 'checkpoint', level.id);
    validateUniqueIds(data.enemySpawns, 'enemy', level.id);
    validateUniqueIds(data.collectibleSpawns, 'collectible', level.id);
    validateOrdered(data.checkpoints, 'checkpoint', level.id);
    validateOrdered(data.enemySpawns, 'enemy', level.id);
    validateOrdered(data.collectibleSpawns, 'collectible', level.id);
    const metadataLayers: Array<[string, string, string]> = [
        [LEVEL_ONE_LAYER_NAMES.checkpoints, 'checkpoint', 'checkpointId'],
        [LEVEL_ONE_LAYER_NAMES.enemySpawns, 'enemy', 'enemyId'],
        [LEVEL_ONE_LAYER_NAMES.collectibleSpawns, 'collectible', 'collectibleId'],
    ];
    for (const [layerName, kind, idProperty] of metadataLayers) {
        const objects = map.layers?.find(({ name }) => name === layerName)?.objects ?? [];
        objects.forEach((object, index) => {
            const label = `${kind} ${index + 1}`;
            getRequiredStringProperty(object, idProperty, label);
            getRequiredOrder(object, label);
            if (kind !== 'enemy' && object.type !== kind) {
                throw new LevelMapValidationError(`${level.id} ${label} type must be "${kind}"`);
            }
            if (kind === 'checkpoint') {
                getFiniteObjectProperty(object, 'respawnOffsetY', Number.NaN, label);
            }
        });
    }

    const { widthPixels, heightPixels } = data.dimensions;
    const validatePointBounds = (point: LevelPoint, label: string): void => {
        if (point.x < 0 || point.x > widthPixels || point.y < 0 || point.y > heightPixels) {
            throw new LevelMapValidationError(`${level.id} ${label} is outside map bounds`);
        }
    };
    validatePointBounds(data.playerSpawn, 'player spawn');
    data.checkpoints.forEach((point, index) => validatePointBounds(point, `checkpoint ${index + 1}`));
    data.enemySpawns.forEach((point, index) => validatePointBounds(point, `enemy ${index + 1}`));
    data.collectibleSpawns.forEach((point, index) => validatePointBounds(point, `collectible ${index + 1}`));
    data.enemySpawns.forEach((enemy, index) => {
        if (enemy.patrolLeft < 0 || enemy.patrolRight > widthPixels) {
            throw new LevelMapValidationError(`${level.id} enemy ${index + 1} patrol is outside map bounds`);
        }
    });
    const collision = buildCollisionQueries(map);
    data.checkpoints.forEach((checkpoint, index) => {
        const respawn = { x: checkpoint.x, y: checkpoint.y + checkpoint.respawnOffsetY };
        if (collision.pointInCollision(respawn)
            || data.killZones.some((zone) => pointInRect(respawn, zone))) {
            throw new LevelMapValidationError(
                `${level.id} checkpoint ${index + 1} respawn overlaps collision or a kill zone`,
            );
        }
    });
    const validateRectBounds = (rect: LevelRect, label: string): void => {
        if (rect.x < 0 || rect.y < 0
            || rect.x + rect.width > widthPixels
            || rect.y + rect.height > heightPixels + LEVEL_WORLD_BOTTOM_PADDING) {
            throw new LevelMapValidationError(`${level.id} ${label} is outside map bounds`);
        }
    };
    validateRectBounds(data.levelGoal, 'level goal');
    data.killZones.forEach((zone, index) => validateRectBounds(zone, `kill zone ${index + 1}`));

    if (collision.pointInCollision({ x: data.playerSpawn.x, y: data.playerSpawn.y - 1 })
        || data.killZones.some((zone) => pointInRect(data.playerSpawn, zone))) {
        throw new LevelMapValidationError(`${level.id} player spawn overlaps collision or a kill zone`);
    }
    data.killZones.forEach((zone, index) => {
        if (collision.rectOverlapsCollision(zone)) {
            throw new LevelMapValidationError(`${level.id} kill zone ${index + 1} overlaps collision terrain`);
        }
    });
    data.enemySpawns.forEach((enemy, index) => {
        if (collision.pointInCollision({ x: enemy.x, y: enemy.y - 1 })
            || data.killZones.some((zone) => pointInRect(enemy, zone))) {
            throw new LevelMapValidationError(`${level.id} enemy ${index + 1} overlaps collision or a kill zone`);
        }
    });
    for (let left = 0; left < data.enemySpawns.length; left += 1) {
        for (let right = left + 1; right < data.enemySpawns.length; right += 1) {
            const a = data.enemySpawns[left]!;
            const b = data.enemySpawns[right]!;
            if (Math.abs(a.x - b.x) < 72 && Math.abs(a.y - b.y) < 54) {
                throw new LevelMapValidationError(`${level.id} enemy spawn bodies overlap`);
            }
        }
    }
    data.collectibleSpawns.forEach((collectible, index) => {
        const collectibleBody = {
            x: collectible.x - 10,
            y: collectible.y - 10,
            width: 20,
            height: 20,
        };
        if (collision.rectOverlapsCollision(collectibleBody)
            || data.killZones.some((zone) => pointInRect(collectible, zone))) {
            throw new LevelMapValidationError(`${level.id} collectible ${index + 1} overlaps collision or a kill zone`);
        }
    });
    const goalBottom = data.levelGoal.y + data.levelGoal.height;
    const goalSamples = [
        data.levelGoal.x + 4,
        data.levelGoal.x + data.levelGoal.width / 2,
        data.levelGoal.x + data.levelGoal.width - 4,
    ];
    if (!goalSamples.every((x) => collision.hasSurfaceAt(x, goalBottom))) {
        throw new LevelMapValidationError(`${level.id} goal must stand on collision terrain`);
    }
    if (data.killZones.some((zone) => {
        const goal = data.levelGoal;
        return goal.x < zone.x + zone.width && goal.x + goal.width > zone.x
            && goal.y < zone.y + zone.height && goal.y + goal.height > zone.y;
    })) {
        throw new LevelMapValidationError(`${level.id} goal overlaps a kill zone`);
    }

    const expectedTileCount = (map.width ?? 0) * (map.height ?? 0);
    for (const layerName of REQUIRED_LEVEL_TILE_LAYERS) {
        const layer = map.layers?.find(({ name }) => name === layerName);
        if (!layer?.data || layer.data.length !== expectedTileCount) {
            throw new LevelMapValidationError(
                `${level.id} tile layer "${layerName}" must contain ${expectedTileCount} tiles`,
            );
        }
        if (layer.data.some((tile) => !Number.isInteger(tile) || tile < 0)) {
            throw new LevelMapValidationError(`${level.id} tile layer "${layerName}" contains invalid tile ids`);
        }
    }

    const configuredLevelId = map.properties?.find(({ name }) => name === 'levelId')?.value;
    if (configuredLevelId !== level.id) {
        throw new LevelMapValidationError(`${level.id} map property "levelId" must match the registry`);
    }
    const configuredTheme = map.properties?.find(({ name }) => name === 'backgroundTheme')?.value;
    if (configuredTheme !== level.backgroundTheme || !TERRAIN_VISUAL_MAPPINGS[level.backgroundTheme]) {
        throw new LevelMapValidationError(`${level.id} terrain theme must match the registry`);
    }
}

export function validateAndExtractLevelMapData(
    map: TiledMapLike,
    level?: LevelDefinition,
): ValidatedLevelMapData {
    validateRequiredLayers(map);
    validateRequiredObjects(map);

    const width = requireFiniteNumber(map.width, 'map.width');
    const height = requireFiniteNumber(map.height, 'map.height');
    const tileWidth = requireFiniteNumber(map.tilewidth, 'map.tilewidth');
    const tileHeight = requireFiniteNumber(map.tileheight, 'map.tileheight');

    if (width <= 0 || height <= 0 || tileWidth <= 0 || tileHeight <= 0
        || !Number.isInteger(width) || !Number.isInteger(height)) {
        throw new LevelMapValidationError('map and tile dimensions must be positive integers');
    }

    const data: ValidatedLevelMapData = {
        dimensions: {
            widthPixels: width * tileWidth,
            heightPixels: height * tileHeight,
        },
        playerSpawn: getPlayerSpawn(map),
        levelGoal: getLevelGoal(map),
        checkpoints: getCheckpoints(map),
        enemySpawns: getEnemySpawns(map),
        collectibleSpawns: getCollectibles(map),
        killZones: getKillZones(map),
        warnings: [],
    };
    if (level) {
        validateConfiguredMap(map, data, level);
    }
    data.warnings = buildJumpWarnings(map, data);
    return data;
}
