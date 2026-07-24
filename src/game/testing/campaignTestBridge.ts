import { Game } from 'phaser';
import { getLevelDefinition, isLevelId, LevelId } from '../constants/campaign';
import { SCENE_LEVEL_ONE, SCENE_LEVEL_SELECT } from '../constants/sceneKeys';
import { SavedCheckpoint, loadGameSaveData } from '../system/SaveSystem';

interface TestableLevelScene {
    getCampaignTestState: () => {
        levelId: LevelId;
        collectibles: number;
        enemies: { small: number; large: number };
        enemyIds: string[];
        checkpoints: string[];
        activeCheckpoint?: string;
        playerPosition: { x: number; y: number };
    };
    campaignTestActivateCheckpoint: (checkpointId: string) => boolean;
    campaignTestComplete: () => void;
    campaignTestRestart: () => void;
}

export interface CampaignTestBridge {
    getState: () => {
        currentScene: string | null;
        level: ReturnType<TestableLevelScene['getCampaignTestState']> | null;
        unlockedLevel: number;
        currentLevelId: LevelId;
        persistedCheckpoints: Partial<Record<LevelId, SavedCheckpoint>>;
        campaignComplete: boolean;
        timing: {
            automatedElapsedMs: number | null;
            manualPlaythrough: 'pending';
        };
    };
    startLevel: (levelId: LevelId) => boolean;
    activateCheckpoint: (checkpointId: string) => boolean;
    completeLevel: () => boolean;
    restartLevel: () => boolean;
    showLevelSelect: () => void;
}

export function isCampaignTestModeEnabled(): boolean {
    return import.meta.env.DEV
        && new URLSearchParams(window.location.search).get('campaignTest') === '1';
}

export function installCampaignTestBridge(game: Game): void {
    if (!isCampaignTestModeEnabled()) {
        return;
    }

    let levelStartTimestamp: number | undefined;
    let automatedElapsedMs: number | null = null;
    const activeLevel = (): TestableLevelScene | undefined => {
        const scene = game.scene.getScene(SCENE_LEVEL_ONE) as unknown as TestableLevelScene;
        return game.scene.isActive(SCENE_LEVEL_ONE) ? scene : undefined;
    };

    window.__CAMPAIGN_TEST__ = {
        getState: () => {
            const save = loadGameSaveData();
            const scenes = game.scene.getScenes(true);
            return {
                currentScene: scenes[scenes.length - 1]?.scene.key ?? null,
                level: activeLevel()?.getCampaignTestState() ?? null,
                unlockedLevel: save.unlockedLevel,
                currentLevelId: save.currentLevelId,
                persistedCheckpoints: { ...save.checkpoints },
                campaignComplete: Boolean(save.bestScores['level-2'])
                    && scenes[scenes.length - 1]?.scene.key === 'LevelComplete',
                timing: {
                    automatedElapsedMs,
                    manualPlaythrough: 'pending',
                },
            };
        },
        startLevel: (levelId) => {
            if (!isLevelId(levelId)) {
                return false;
            }
            if (!game.cache.tilemap.exists(getLevelDefinition(levelId).mapAssetKey)) {
                return false;
            }
            const save = loadGameSaveData();
            const level = getLevelDefinition(levelId);
            if (level.levelOrder > save.unlockedLevel) {
                return false;
            }
            levelStartTimestamp = performance.now();
            automatedElapsedMs = null;
            game.scene.start(SCENE_LEVEL_ONE, {
                characterId: save.selectedCharacterId,
                levelId,
            });
            return true;
        },
        activateCheckpoint: (checkpointId) => activeLevel()?.campaignTestActivateCheckpoint(checkpointId) ?? false,
        completeLevel: () => {
            const scene = activeLevel();
            if (!scene || levelStartTimestamp === undefined) {
                return false;
            }
            automatedElapsedMs = Math.round(performance.now() - levelStartTimestamp);
            levelStartTimestamp = undefined;
            scene.campaignTestComplete();
            return true;
        },
        restartLevel: () => {
            const scene = activeLevel();
            if (!scene) {
                return false;
            }
            levelStartTimestamp = performance.now();
            scene.campaignTestRestart();
            return true;
        },
        showLevelSelect: () => {
            game.scene.start(SCENE_LEVEL_SELECT);
        },
    };
}
