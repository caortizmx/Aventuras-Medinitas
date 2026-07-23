import { beforeEach, describe, expect, it } from 'vitest';
import { getDefaultCharacter } from '../src/game/data/characters';
import {
    SAVE_DATA_SCHEMA_VERSION,
    SAVE_DATA_STORAGE_KEY,
    loadGameSaveData,
    recordLevelResult,
    resetProgress,
    saveGameSaveData,
} from '../src/game/system/SaveSystem';
import { applyCollectiblePickup } from '../src/game/system/stage8Gameplay';

describe('stage 8 save system', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('saves valid save data', () => {
        const saved = saveGameSaveData({
            schemaVersion: SAVE_DATA_SCHEMA_VERSION,
            selectedCharacterId: 'israel',
            unlockedLevel: 2,
            bestScores: { 'level-1': 450 },
            bestCollectibleCounts: { 'level-1': 3 },
            settings: { soundEnabled: true },
        });

        expect(saved.selectedCharacterId).toBe('israel');
        expect(saved.unlockedLevel).toBe(2);
        expect(saved.bestScores['level-1']).toBe(450);
    });

    it('loads valid save data', () => {
        localStorage.setItem(SAVE_DATA_STORAGE_KEY, JSON.stringify({
            schemaVersion: SAVE_DATA_SCHEMA_VERSION,
            selectedCharacterId: 'orel',
            unlockedLevel: 3,
            bestScores: { 'level-1': 900 },
            bestCollectibleCounts: { 'level-1': 3 },
            settings: { soundEnabled: false },
        }));

        const loaded = loadGameSaveData();
        expect(loaded.selectedCharacterId).toBe('orel');
        expect(loaded.unlockedLevel).toBe(3);
        expect(loaded.bestScores['level-1']).toBe(900);
        expect(loaded.settings.soundEnabled).toBe(false);
    });

    it('recovers from corrupted JSON', () => {
        localStorage.setItem(SAVE_DATA_STORAGE_KEY, '{"schemaVersion":1');
        const loaded = loadGameSaveData();

        expect(loaded.schemaVersion).toBe(SAVE_DATA_SCHEMA_VERSION);
        expect(loaded.selectedCharacterId).toBe(getDefaultCharacter().id);
        expect(loaded.unlockedLevel).toBe(1);
    });

    it('recovers from missing fields', () => {
        localStorage.setItem(SAVE_DATA_STORAGE_KEY, JSON.stringify({
            schemaVersion: SAVE_DATA_SCHEMA_VERSION,
            selectedCharacterId: 'emma',
        }));

        const loaded = loadGameSaveData();
        expect(loaded.unlockedLevel).toBe(1);
        expect(loaded.bestScores['level-1']).toBeUndefined();
        expect(loaded.bestCollectibleCounts['level-1']).toBeUndefined();
        expect(loaded.settings.soundEnabled).toBe(true);
    });

    it('falls back to defaults for unknown schema version', () => {
        localStorage.setItem(SAVE_DATA_STORAGE_KEY, JSON.stringify({
            schemaVersion: 99,
            selectedCharacterId: 'orel',
            unlockedLevel: 99,
            bestScores: { 'level-1': 9999 },
            bestCollectibleCounts: { 'level-1': 9 },
            settings: { soundEnabled: false },
        }));

        const loaded = loadGameSaveData();
        expect(loaded.schemaVersion).toBe(SAVE_DATA_SCHEMA_VERSION);
        expect(loaded.selectedCharacterId).toBe(getDefaultCharacter().id);
        expect(loaded.unlockedLevel).toBe(1);
        expect(Object.keys(loaded.bestScores)).toHaveLength(0);
    });

    it('recovers from invalid selected character id', () => {
        localStorage.setItem(SAVE_DATA_STORAGE_KEY, JSON.stringify({
            schemaVersion: SAVE_DATA_SCHEMA_VERSION,
            selectedCharacterId: 'unknown-character',
            unlockedLevel: 2,
            bestScores: { 'level-1': 100 },
            bestCollectibleCounts: { 'level-1': 1 },
            settings: { soundEnabled: true },
        }));

        const loaded = loadGameSaveData();
        expect(loaded.selectedCharacterId).toBe(getDefaultCharacter().id);
    });

    it('replaces best score when higher score is recorded', () => {
        recordLevelResult({ levelId: 'level-1', score: 200, collectibleCount: 1, unlockedLevel: 2 });
        const updated = recordLevelResult({ levelId: 'level-1', score: 450, collectibleCount: 1, unlockedLevel: 2 });

        expect(updated.bestScores['level-1']).toBe(450);
    });

    it('does not replace best score when lower score is recorded', () => {
        recordLevelResult({ levelId: 'level-1', score: 500, collectibleCount: 3, unlockedLevel: 2 });
        const updated = recordLevelResult({ levelId: 'level-1', score: 150, collectibleCount: 1, unlockedLevel: 2 });

        expect(updated.bestScores['level-1']).toBe(500);
    });

    it('resets progress safely', () => {
        saveGameSaveData({
            schemaVersion: SAVE_DATA_SCHEMA_VERSION,
            selectedCharacterId: 'israel',
            unlockedLevel: 4,
            bestScores: { 'level-1': 800 },
            bestCollectibleCounts: { 'level-1': 3 },
            settings: { soundEnabled: false },
        });

        const reset = resetProgress();
        expect(reset.selectedCharacterId).toBe('israel');
        expect(reset.unlockedLevel).toBe(1);
        expect(Object.keys(reset.bestScores)).toHaveLength(0);
        expect(Object.keys(reset.bestCollectibleCounts)).toHaveLength(0);
        expect(reset.settings.soundEnabled).toBe(false);
    });

    it('prevents collectible duplication in one level attempt', () => {
        const firstPickup = applyCollectiblePickup(new Set<string>(), 'c-1', 0, 0, 100);
        const duplicatedPickup = applyCollectiblePickup(firstPickup.collectedIds, 'c-1', firstPickup.collectedCount, firstPickup.score, 100);

        expect(firstPickup.collected).toBe(true);
        expect(firstPickup.collectedCount).toBe(1);
        expect(firstPickup.score).toBe(100);
        expect(duplicatedPickup.collected).toBe(false);
        expect(duplicatedPickup.collectedCount).toBe(1);
        expect(duplicatedPickup.score).toBe(100);
    });
});
