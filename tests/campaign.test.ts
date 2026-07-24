import { describe, expect, it } from 'vitest';
import levelOneRaw from '../public/assets/maps/level-one.json?raw';
import levelTwoRaw from '../public/assets/maps/level-two.json?raw';
import {
    CAMPAIGN_LEVELS,
    getNextLevel,
    isLevelUnlocked,
} from '../src/game/constants/campaign';
import { TiledMapLike, validateAndExtractLevelMapData } from '../src/game/level/tiledLevelValidation';

const maps = [levelOneRaw, levelTwoRaw].map((raw) => JSON.parse(raw) as TiledMapLike);

describe('two-level campaign', () => {
    it('defines ordered progression and locking', () => {
        expect(CAMPAIGN_LEVELS.map(({ id }) => id)).toEqual(['level-1', 'level-2']);
        expect(CAMPAIGN_LEVELS).toMatchObject([
            {
                title: 'Green Valley',
                backgroundTheme: 'green-valley',
                estimatedDurationSeconds: 120,
                nextLevelId: 'level-2',
                unlockedByDefault: true,
                levelOrder: 1,
            },
            {
                title: 'Mountain Ruins',
                backgroundTheme: 'mountain-ruins',
                estimatedDurationSeconds: 120,
                nextLevelId: null,
                unlockedByDefault: false,
                levelOrder: 2,
            },
        ]);
        expect(getNextLevel('level-1')?.id).toBe('level-2');
        expect(getNextLevel('level-2')).toBeUndefined();
        expect(isLevelUnlocked('level-1', 1)).toBe(true);
        expect(isLevelUnlocked('level-2', 1)).toBe(false);
        expect(isLevelUnlocked('level-2', 2)).toBe(true);
    });

    it.each(CAMPAIGN_LEVELS)('validates exact configured targets for $id', (level) => {
        const map = maps[level.levelOrder - 1];
        expect(map).toBeDefined();
        const data = validateAndExtractLevelMapData(map!, level);
        expect(data.collectibleSpawns).toHaveLength(level.collectibleCount);
        expect(data.checkpoints).toHaveLength(level.checkpointCount);
        expect(data.enemySpawns.filter(({ visualVariant }) => visualVariant === 'small'))
            .toHaveLength(level.enemyCounts.small);
        expect(data.enemySpawns.filter(({ visualVariant }) => visualVariant === 'large'))
            .toHaveLength(level.enemyCounts.large);
        expect(data.collectibleSpawns.every(({ id }) => id.startsWith(
            level.id === 'level-1' ? 'level-one-' : 'level-two-',
        ))).toBe(true);
        expect(data.warnings).toEqual([]);
    });

    it.each([
        ['duplicate collectible id', (map: TiledMapLike) => {
            const objects = map.layers?.find(({ name }) => name === 'CollectibleSpawns')?.objects;
            const firstId = objects?.[0]?.properties?.find(({ name }) => name === 'collectibleId')?.value;
            const secondId = objects?.[1]?.properties?.find(({ name }) => name === 'collectibleId');
            if (secondId) secondId.value = firstId;
        }],
        ['checkpoint order gap', (map: TiledMapLike) => {
            const order = map.layers?.find(({ name }) => name === 'Checkpoints')
                ?.objects?.[1]?.properties?.find(({ name }) => name === 'order');
            if (order) order.value = 9;
        }],
        ['spawn collision', (map: TiledMapLike) => {
            const spawn = map.layers?.find(({ name }) => name === 'PlayerSpawn')?.objects?.[0];
            if (spawn) spawn.y = 720;
        }],
        ['unsupported goal', (map: TiledMapLike) => {
            const goal = map.layers?.find(({ name }) => name === 'LevelGoal')?.objects?.[0];
            if (goal) goal.x = 1088;
        }],
    ] as const)('rejects %s', (_label, mutate) => {
        const map = JSON.parse(levelOneRaw) as TiledMapLike;
        mutate(map);
        expect(() => validateAndExtractLevelMapData(map, CAMPAIGN_LEVELS[0])).toThrow();
    });

    it('rejects a configured map whose campaign counts drift', () => {
        const map = JSON.parse(levelOneRaw) as TiledMapLike;
        const collectibles = map.layers?.find(({ name }) => name === 'CollectibleSpawns');
        collectibles?.objects?.pop();
        expect(() => validateAndExtractLevelMapData(map, CAMPAIGN_LEVELS[0]))
            .toThrow(/exactly 27/);
    });
});
