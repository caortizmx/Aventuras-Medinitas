import { findCharacterById, getDefaultCharacter } from '../data/characters';

export interface SaveSettings {
    soundEnabled: boolean;
}

export interface SaveData {
    schemaVersion: number;
    selectedCharacterId: string;
    unlockedLevel: number;
    bestScores: Record<string, number>;
    bestCollectibleCounts: Record<string, number>;
    settings: SaveSettings;
}

export const SAVE_DATA_SCHEMA_VERSION = 1;
export const SAVE_DATA_STORAGE_KEY = 'aventuras_save_data_v1';
const LEGACY_CHARACTER_KEY = 'aventuras_selected_character';

const DEFAULT_SAVE_DATA: SaveData = {
    schemaVersion: SAVE_DATA_SCHEMA_VERSION,
    selectedCharacterId: getDefaultCharacter().id,
    unlockedLevel: 1,
    bestScores: {},
    bestCollectibleCounts: {},
    settings: {
        soundEnabled: true,
    },
};

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

function sanitizeSaveData(raw: unknown): SaveData {
    if (!isRecord(raw)) {
        return { ...DEFAULT_SAVE_DATA };
    }

    if (raw.schemaVersion !== SAVE_DATA_SCHEMA_VERSION) {
        return { ...DEFAULT_SAVE_DATA };
    }

    return {
        schemaVersion: SAVE_DATA_SCHEMA_VERSION,
        selectedCharacterId: sanitizeSelectedCharacterId(raw.selectedCharacterId),
        unlockedLevel: Math.max(1, toNonNegativeInteger(raw.unlockedLevel, DEFAULT_SAVE_DATA.unlockedLevel)),
        bestScores: sanitizeBestMap(raw.bestScores),
        bestCollectibleCounts: sanitizeBestMap(raw.bestCollectibleCounts),
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
                return { ...DEFAULT_SAVE_DATA };
            }

            const migrated: SaveData = {
                ...DEFAULT_SAVE_DATA,
                selectedCharacterId: legacyCharacterId,
            };
            saveGameSaveData(migrated);
            return migrated;
        }

        const parsed = JSON.parse(raw) as unknown;
        const safeData = sanitizeSaveData(parsed);
        return safeData;
    } catch {
        return { ...DEFAULT_SAVE_DATA };
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
    levelId: string;
    score: number;
    collectibleCount: number;
    unlockedLevel: number;
}

export function recordLevelResult(payload: LevelResultPayload): SaveData {
    const current = loadGameSaveData();
    const score = toNonNegativeInteger(payload.score, 0);
    const collectibleCount = toNonNegativeInteger(payload.collectibleCount, 0);
    const unlockedLevel = Math.max(1, toNonNegativeInteger(payload.unlockedLevel, current.unlockedLevel));

    const previousBestScore = current.bestScores[payload.levelId] ?? 0;
    const previousBestCollectibleCount = current.bestCollectibleCounts[payload.levelId] ?? 0;

    current.bestScores[payload.levelId] = Math.max(previousBestScore, score);
    current.bestCollectibleCounts[payload.levelId] = Math.max(previousBestCollectibleCount, collectibleCount);
    current.unlockedLevel = Math.max(current.unlockedLevel, unlockedLevel);

    return saveGameSaveData(current);
}

export function resetProgress(): SaveData {
    const current = loadGameSaveData();
    const resetData: SaveData = {
        ...DEFAULT_SAVE_DATA,
        selectedCharacterId: current.selectedCharacterId,
        settings: current.settings,
    };

    return saveGameSaveData(resetData);
}
