export const LEVEL_IDS = ['level-1', 'level-2'] as const;
export type LevelId = (typeof LEVEL_IDS)[number];
export type BackgroundTheme = 'green-valley' | 'mountain-ruins';

export interface LevelDefinition {
    id: LevelId;
    levelOrder: number;
    title: string;
    backgroundTheme: BackgroundTheme;
    estimatedDurationSeconds: number;
    nextLevelId: LevelId | null;
    unlockedByDefault: boolean;
    mapAssetKey: string;
    mapPath: string;
    collectibleCount: number;
    enemyCounts: {
        small: number;
        large: number;
    };
    checkpointCount: number;
}

export const CAMPAIGN_LEVELS: readonly LevelDefinition[] = [
    {
        id: 'level-1',
        levelOrder: 1,
        title: 'Green Valley',
        backgroundTheme: 'green-valley',
        estimatedDurationSeconds: 120,
        nextLevelId: 'level-2',
        unlockedByDefault: true,
        mapAssetKey: 'level-one-map',
        mapPath: 'maps/level-one.json',
        collectibleCount: 27,
        enemyCounts: { small: 7, large: 2 },
        checkpointCount: 2,
    },
    {
        id: 'level-2',
        levelOrder: 2,
        title: 'Mountain Ruins',
        backgroundTheme: 'mountain-ruins',
        estimatedDurationSeconds: 120,
        nextLevelId: null,
        unlockedByDefault: false,
        mapAssetKey: 'level-two-map',
        mapPath: 'maps/level-two.json',
        collectibleCount: 33,
        enemyCounts: { small: 9, large: 3 },
        checkpointCount: 3,
    },
] as const;

export const FIRST_LEVEL_ID: LevelId = LEVEL_IDS[0];
export const FINAL_LEVEL_NUMBER = CAMPAIGN_LEVELS.length;

export function isLevelId(value: unknown): value is LevelId {
    return typeof value === 'string' && LEVEL_IDS.includes(value as LevelId);
}

export function getLevelDefinition(levelId: LevelId): LevelDefinition {
    const level = CAMPAIGN_LEVELS.find(({ id }) => id === levelId);
    if (!level) {
        throw new Error(`Unknown campaign level: ${levelId}`);
    }
    return level;
}

export function getNextLevel(levelId: LevelId): LevelDefinition | undefined {
    const nextLevelId = getLevelDefinition(levelId).nextLevelId;
    return nextLevelId ? getLevelDefinition(nextLevelId) : undefined;
}

export function isLevelUnlocked(levelId: LevelId, unlockedLevel: number): boolean {
    const level = getLevelDefinition(levelId);
    return level.unlockedByDefault || level.levelOrder <= unlockedLevel;
}
