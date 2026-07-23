import { describe, it, expect } from 'vitest';
import {
    LEVEL_ONE_LAYER_NAMES,
    REQUIRED_LEVEL_OBJECT_LAYERS,
    REQUIRED_LEVEL_TILE_LAYERS,
} from '../src/game/constants/tiledLevel';
import {
    LevelMapValidationError,
    TiledMapLike,
    getKillZones,
    getLevelGoal,
    getPlayerSpawn,
    validateAndExtractLevelMapData,
    validateRequiredLayers,
    validateRequiredObjects,
} from '../src/game/level/tiledLevelValidation';

function buildValidMap(): TiledMapLike {
    const tileLayer = (name: string) => ({ name, type: 'tilelayer', data: [0] });
    const objectLayer = (name: string, objects: Array<Record<string, number | string | boolean>>) => ({
        name,
        type: 'objectgroup',
        objects,
    });

    return {
        width: 10,
        height: 8,
        tilewidth: 32,
        tileheight: 32,
        layers: [
            ...REQUIRED_LEVEL_TILE_LAYERS.map((name) => tileLayer(name)),
            objectLayer(LEVEL_ONE_LAYER_NAMES.playerSpawn, [{ x: 120, y: 300, width: 0, height: 0, point: true }]),
            objectLayer(LEVEL_ONE_LAYER_NAMES.checkpoints, [{ x: 400, y: 280, width: 0, height: 0, point: true }]),
            objectLayer(LEVEL_ONE_LAYER_NAMES.enemySpawns, [{ x: 560, y: 300, width: 0, height: 0, point: true }]),
            objectLayer(LEVEL_ONE_LAYER_NAMES.collectibleSpawns, [
                { x: 240, y: 260, width: 0, height: 0, point: true },
                { x: 360, y: 240, width: 0, height: 0, point: true },
                { x: 480, y: 220, width: 0, height: 0, point: true },
            ]),
            objectLayer(LEVEL_ONE_LAYER_NAMES.levelGoal, [{ x: 640, y: 224, width: 64, height: 96 }]),
            objectLayer(LEVEL_ONE_LAYER_NAMES.killZones, [{ x: 280, y: 320, width: 96, height: 160 }]),
        ],
    };
}

describe('required layer validation', () => {
    it('passes when all required layers exist with expected types', () => {
        expect(() => validateRequiredLayers(buildValidMap())).not.toThrow();
    });

    it('fails when a required layer is missing', () => {
        const map = buildValidMap();
        map.layers = map.layers?.filter((layer) => layer.name !== LEVEL_ONE_LAYER_NAMES.collision);

        expect(() => validateRequiredLayers(map)).toThrow(LevelMapValidationError);
    });

    it('fails when a required object layer has wrong type', () => {
        const map = buildValidMap();
        const checkpointsLayer = map.layers?.find((layer) => layer.name === LEVEL_ONE_LAYER_NAMES.checkpoints);
        if (!checkpointsLayer) throw new Error('checkpoint layer fixture missing');
        checkpointsLayer.type = 'tilelayer';

        expect(() => validateRequiredLayers(map)).toThrow(LevelMapValidationError);
    });
});

describe('required object validation', () => {
    it('passes when all required object counts are met', () => {
        expect(() => validateRequiredObjects(buildValidMap())).not.toThrow();
    });

    it('fails when required objects are missing', () => {
        const map = buildValidMap();
        const collectibleLayer = map.layers?.find((layer) => layer.name === LEVEL_ONE_LAYER_NAMES.collectibleSpawns);
        if (!collectibleLayer) throw new Error('collectible layer fixture missing');
        collectibleLayer.objects = collectibleLayer.objects?.slice(0, 2);

        expect(() => validateRequiredObjects(map)).toThrow(LevelMapValidationError);
    });

    it('fails when a required object layer is absent', () => {
        const map = buildValidMap();
        map.layers = map.layers?.filter((layer) => layer.name !== REQUIRED_LEVEL_OBJECT_LAYERS[0]);

        expect(() => validateRequiredObjects(map)).toThrow(LevelMapValidationError);
    });
});

describe('player spawn validation', () => {
    it('returns player spawn coordinates from the PlayerSpawn layer', () => {
        const spawn = getPlayerSpawn(buildValidMap());
        expect(spawn).toEqual({ x: 120, y: 300 });
    });

    it('throws when player spawn has invalid coordinates', () => {
        const map = buildValidMap();
        const spawnLayer = map.layers?.find((layer) => layer.name === LEVEL_ONE_LAYER_NAMES.playerSpawn);
        if (!spawnLayer || !spawnLayer.objects?.[0]) throw new Error('spawn fixture missing');
        spawnLayer.objects[0].x = Number.NaN;

        expect(() => getPlayerSpawn(map)).toThrow(LevelMapValidationError);
    });
});

describe('goal validation', () => {
    it('returns goal rectangle from LevelGoal layer', () => {
        const goal = getLevelGoal(buildValidMap());
        expect(goal).toEqual({ x: 640, y: 224, width: 64, height: 96 });
    });

    it('throws when goal width/height are invalid', () => {
        const map = buildValidMap();
        const goalLayer = map.layers?.find((layer) => layer.name === LEVEL_ONE_LAYER_NAMES.levelGoal);
        if (!goalLayer || !goalLayer.objects?.[0]) throw new Error('goal fixture missing');
        goalLayer.objects[0].width = 0;

        expect(() => getLevelGoal(map)).toThrow(LevelMapValidationError);
    });
});

describe('kill-zone validation', () => {
    it('returns one or more kill zones', () => {
        const killZones = getKillZones(buildValidMap());
        expect(killZones).toHaveLength(1);
        expect(killZones[0]).toEqual({ x: 280, y: 320, width: 96, height: 160 });
    });

    it('throws when no kill zones exist', () => {
        const map = buildValidMap();
        const killLayer = map.layers?.find((layer) => layer.name === LEVEL_ONE_LAYER_NAMES.killZones);
        if (!killLayer) throw new Error('kill zone fixture missing');
        killLayer.objects = [];

        expect(() => getKillZones(map)).toThrow(LevelMapValidationError);
    });
});

describe('invalid map handling', () => {
    it('throws a controlled validation error with a stable prefix', () => {
        const map = buildValidMap();
        map.width = undefined;

        expect(() => validateAndExtractLevelMapData(map)).toThrowError(
            expect.objectContaining({
                name: 'LevelMapValidationError',
                message: expect.stringContaining('[LevelOne:TiledMapInvalid]'),
            }),
        );
    });
});
