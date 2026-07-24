import { findCharacterById, getDefaultCharacter } from '../data/characters';
import {
    CAMPAIGN_LEVELS,
    FINAL_LEVEL_NUMBER,
    getNextLevel,
    isLevelId,
    LevelId,
} from '../constants/campaign';

export interface SaveSettings {
    soundEnabled: boolean;
}

export interface SaveData {
    schemaVersion: number;
    selectedCharacterId: string;
    unlockedLevel: number;
    bestScores: Record<string, number>;
    bestCollectibleCounts: Record<string, number>;
    currentLevelId: LevelId;
    checkpoints: Partial<Record<LevelId, SavedCheckpoint>>;
    settings: SaveSettings;
}

export interface SavedCheckpoint {
    checkpointId: string;
    x: number;
    y: number;
}

export const SAVE_DATA_SCHEMA_VERSION = 2;
export const SAVE_DATA_STORAGE_KEY = 'aventuras_save_data_v1';
const LEGACY_CHARACTER_KEY = 'aventuras_selected_character';

const DEFAULT_SAVE_DATA: SaveData = {
    schemaVersion: SAVE_DATA_SCHEMA_VERSION,
    selectedCharacterId: getDefaultCharacter().id,
    unlockedLevel: 1,
    bestScores: {},
    bestCollectibleCounts: {},
    currentLevelId: 'level-1',
    checkpoints: {},
    settings: {
        soundEnabled: true,
    },
};

function createDefaultSaveData(): SaveData {
    return {
        schemaVersion: SAVE_DATA_SCHEMA_VERSION,
        selectedCharacterId: DEFAULT_SAVE_DATA.selectedCharacterId,
        unlockedLevel: DEFAULT_SAVE_DATA.unlockedLevel,
        bestScores: {},
        bestCollectibleCounts: {},
        currentLevelId: DEFAULT_SAVE_DATA.currentLevelId,
        checkpoints: {},
        settings: {
            soundEnabled: DEFAULT_SAVE_DATA.settings.soundEnabled,
        },
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNonNegativeInteger(value: unknown, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        return fallback;
    }

    return Math.floor(value);
}

function sanitizeBestMap(value: unknown): Record<string, number> {
    if (!isRecord(value)) {
        return {};
    }

    const sanitized: Record<string, number> = {};
    for (const [key, raw] of Object.entries(value)) {
        const safeValue = toNonNegativeInteger(raw, -1);
        if (safeValue >= 0) {
            sanitized[key] = safeValue;
        }
    }

    return sanitized;
}

function sanitizeSelectedCharacterId(value: unknown): string {
    if (typeof value === 'string' && findCharacterById(value)) {
        return value;
    }

    return DEFAULT_SAVE_DATA.selectedCharacterId;
}

function sanitizeSettings(value: unknown): SaveSettings {
    if (!isRecord(value)) {
        return { ...DEFAULT_SAVE_DATA.settings };
    }

    return {
        soundEnabled: typeof value.soundEnabled === 'boolean'
            ? value.soundEnabled
            : DEFAULT_SAVE_DATA.settings.soundEnabled,
    };
}

function sanitizeCheckpoint(value: unknown): SavedCheckpoint | undefined {
    if (!isRecord(value)
        || typeof value.checkpointId !== 'string'
        || value.checkpointId.trim().length === 0
        || typeof value.x !== 'number'
        || !Number.isFinite(value.x)
        || typeof value.y !== 'number'
        || !Number.isFinite(value.y)) {
        return undefined;
    }
    return {
        checkpointId: value.checkpointId,
        x: value.x,
        y: value.y,
    };
}

function sanitizeCheckpoints(value: unknown): Partial<Record<LevelId, SavedCheckpoint>> {
    if (!isRecord(value)) {
        return {};
    }
    const checkpoints: Partial<Record<LevelId, SavedCheckpoint>> = {};
    for (const [levelId, rawCheckpoint] of Object.entries(value)) {
        const checkpoint = sanitizeCheckpoint(rawCheckpoint);
        if (isLevelId(levelId) && checkpoint) {
            checkpoints[levelId] = checkpoint;
        }
    }
    return checkpoints;
}

function sanitizeSaveData(raw: unknown): SaveData {
    if (!isRecord(raw)) {
        return createDefaultSaveData();
    }

    if (raw.schemaVersion !== 1 && raw.schemaVersion !== SAVE_DATA_SCHEMA_VERSION) {
        return createDefaultSaveData();
    }

    const unlockedLevel = Math.min(
        FINAL_LEVEL_NUMBER,
        Math.max(1, toNonNegativeInteger(raw.unlockedLevel, DEFAULT_SAVE_DATA.unlockedLevel)),
    );
    const migratedLevelId = CAMPAIGN_LEVELS[unlockedLevel - 1]?.id ?? DEFAULT_SAVE_DATA.currentLevelId;
    const requestedLevelId = isLevelId(raw.currentLevelId) ? raw.currentLevelId : migratedLevelId;
    const requestedLevelOrder = CAMPAIGN_LEVELS.find(({ id }) => id === requestedLevelId)?.levelOrder
        ?? Number.POSITIVE_INFINITY;
    const currentLevelId = requestedLevelOrder <= unlockedLevel
        ? requestedLevelId
        : migratedLevelId;
    return {
        schemaVersion: SAVE_DATA_SCHEMA_VERSION,
        selectedCharacterId: sanitizeSelectedCharacterId(raw.selectedCharacterId),
        unlockedLevel,
        bestScores: sanitizeBestMap(raw.bestScores),
        bestCollectibleCounts: sanitizeBestMap(raw.bestCollectibleCounts),
        currentLevelId: raw.schemaVersion === 1 ? migratedLevelId : currentLevelId,
        checkpoints: raw.schemaVersion === 1 ? {} : sanitizeCheckpoints(raw.checkpoints),
        settings: sanitizeSettings(raw.settings),
    };
}

function loadLegacyCharacterSelection(): string | undefined {
    try {
        const saved = localStorage.getItem(LEGACY_CHARACTER_KEY);
        if (saved && findCharacterById(saved)) {
            return saved;
        }
    } catch {
        // Ignore storage errors
    }

    return undefined;
}

export function loadGameSaveData(): SaveData {
    try {
        const raw = localStorage.getItem(SAVE_DATA_STORAGE_KEY);
        if (!raw) {
            const legacyCharacterId = loadLegacyCharacterSelection();
            if (!legacyCharacterId) {
                return createDefaultSaveData();
            }

            const migrated: SaveData = {
                ...createDefaultSaveData(),
                selectedCharacterId: legacyCharacterId,
            };
            saveGameSaveData(migrated);
            try {
                localStorage.removeItem(LEGACY_CHARACTER_KEY);
            } catch {
                // Ignore storage errors
            }
            return migrated;
        }

        const parsed = JSON.parse(raw);
        const safeData = sanitizeSaveData(parsed);
        if (isRecord(parsed) && parsed.schemaVersion === 1) {
            saveGameSaveData(safeData);
        }
        return safeData;
    } catch {
        return createDefaultSaveData();
    }
}

export function saveGameSaveData(data: SaveData): SaveData {
    const safeData = sanitizeSaveData(data);
    try {
        localStorage.setItem(SAVE_DATA_STORAGE_KEY, JSON.stringify(safeData));
    } catch {
        // Ignore storage errors
    }
    return safeData;
}

export function saveSelectedCharacter(id: string): void {
    const current = loadGameSaveData();
    current.selectedCharacterId = sanitizeSelectedCharacterId(id);
    saveGameSaveData(current);
}

export function loadSelectedCharacterId(): string {
    return loadGameSaveData().selectedCharacterId;
}

export interface LevelResultPayload {
    levelId: LevelId;
    score: number;
    collectibleCount: number;
    unlockedLevel: number;
}

export function recordLevelResult(payload: LevelResultPayload): SaveData {
    const current = loadGameSaveData();
    const score = toNonNegativeInteger(payload.score, 0);
    const collectibleCount = toNonNegativeInteger(payload.collectibleCount, 0);
    const unlockedLevel = Math.min(
        FINAL_LEVEL_NUMBER,
        Math.max(1, toNonNegativeInteger(payload.unlockedLevel, current.unlockedLevel)),
    );

    const previousBestScore = current.bestScores[payload.levelId] ?? 0;
    const previousBestCollectibleCount = current.bestCollectibleCounts[payload.levelId] ?? 0;

    current.bestScores[payload.levelId] = Math.max(previousBestScore, score);
    current.bestCollectibleCounts[payload.levelId] = Math.max(previousBestCollectibleCount, collectibleCount);
    current.unlockedLevel = Math.max(current.unlockedLevel, unlockedLevel);
    current.currentLevelId = getNextLevel(payload.levelId)?.id ?? payload.levelId;

    return saveGameSaveData(current);
}

export function saveCurrentLevel(levelId: LevelId): SaveData {
    const current = loadGameSaveData();
    current.currentLevelId = levelId;
    return saveGameSaveData(current);
}

export function saveLevelCheckpoint(
    levelId: LevelId,
    checkpointId: string,
    x: number,
    y: number,
): SaveData {
    const current = loadGameSaveData();
    if (checkpointId.trim().length > 0 && Number.isFinite(x) && Number.isFinite(y)) {
        current.currentLevelId = levelId;
        current.checkpoints[levelId] = { checkpointId, x, y };
    }
    return saveGameSaveData(current);
}

export function loadLevelCheckpoint(levelId: LevelId): SavedCheckpoint | undefined {
    return loadGameSaveData().checkpoints[levelId];
}

export function clearLevelCheckpoint(levelId: LevelId): SaveData {
    const current = loadGameSaveData();
    delete current.checkpoints[levelId];
    return saveGameSaveData(current);
}

export function resetProgress(): SaveData {
    const current = loadGameSaveData();
    const resetData: SaveData = {
        ...createDefaultSaveData(),
        selectedCharacterId: current.selectedCharacterId,
        settings: current.settings,
    };

    return saveGameSaveData(resetData);
}
