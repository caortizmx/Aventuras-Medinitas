import { Scene } from 'phaser';
import { SCENE_CHARACTER_SELECT, SCENE_LEVEL_ONE } from '../constants/sceneKeys';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants/gameValues';
import { loadGameSaveData, resetProgress } from '../system/SaveSystem';

interface LevelCompleteData {
    characterId: string;
    levelId: string;
    score: number;
    collectedCount: number;
    totalCollectibles: number;
    bestScore: number;
    bestCollectibleCount: number;
}

export class LevelComplete extends Scene {
    constructor() {
        super('LevelComplete');
    }

    create(data: LevelCompleteData): void {
        const safeData = {
            characterId: data?.characterId ?? loadGameSaveData().selectedCharacterId,
            levelId: data?.levelId ?? 'level-1',
            score: typeof data?.score === 'number' ? data.score : 0,
            collectedCount: typeof data?.collectedCount === 'number' ? data.collectedCount : 0,
            totalCollectibles: typeof data?.totalCollectibles === 'number' ? data.totalCollectibles : 0,
            bestScore: typeof data?.bestScore === 'number' ? data.bestScore : 0,
            bestCollectibleCount: typeof data?.bestCollectibleCount === 'number' ? data.bestCollectibleCount : 0,
        };

        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x101622);

        this.add.text(GAME_WIDTH / 2, 52, 'Level Complete!', {
            fontFamily: 'Arial Black',
            fontSize: '40px',
            color: '#f1c40f',
            stroke: '#000000',
            strokeThickness: 6,
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, 128, `Score: ${safeData.score}`, {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#ffffff',
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, 158, `Collectibles: ${safeData.collectedCount}/${safeData.totalCollectibles}`, {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#ffffff',
        }).setOrigin(0.5);

        const bestScoreLabel = this.add.text(GAME_WIDTH / 2, 204, `Best score: ${safeData.bestScore}`, {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#9ee6ff',
        }).setOrigin(0.5);

        const bestCollectiblesLabel = this.add.text(
            GAME_WIDTH / 2,
            232,
            `Best collectibles: ${safeData.bestCollectibleCount}/${safeData.totalCollectibles}`,
            {
                fontFamily: 'monospace',
                fontSize: '18px',
                color: '#9ee6ff',
            },
        ).setOrigin(0.5);

        this._addButton(GAME_WIDTH / 2, 298, 360, 44, 'Replay level', () => {
            this.scene.start(SCENE_LEVEL_ONE, { characterId: safeData.characterId });
        });

        this._addButton(GAME_WIDTH / 2, 352, 360, 44, 'Return to character selection', () => {
            this.scene.start(SCENE_CHARACTER_SELECT);
        });

        this._addButton(GAME_WIDTH / 2, 406, 360, 36, 'Reset progress', () => {
            const afterReset = resetProgress();
            bestScoreLabel.setText(`Best score: ${afterReset.bestScores[safeData.levelId] ?? 0}`);
            bestCollectiblesLabel.setText(
                `Best collectibles: ${afterReset.bestCollectibleCounts[safeData.levelId] ?? 0}/${safeData.totalCollectibles}`,
            );
        }, {
            baseColor: 0x8e2a2a,
            hoverColor: 0xb03535,
            fontSize: '16px',
        });
    }

    private _addButton(
        x: number,
        y: number,
        width: number,
        height: number,
        text: string,
        onClick: () => void,
        style: {
            baseColor?: number;
            hoverColor?: number;
            fontSize?: string;
        } = {},
    ): void {
        const baseColor = style.baseColor ?? 0x2d7cff;
        const hoverColor = style.hoverColor ?? 0x4f92ff;
        const fontSize = style.fontSize ?? '18px';

        const bg = this.add.rectangle(x, y, width, height, baseColor).setInteractive({ useHandCursor: true });
        this.add.text(x, y, text, {
            fontFamily: 'Arial Black',
            fontSize,
            color: '#ffffff',
        }).setOrigin(0.5);

        bg.on('pointerover', () => bg.setFillStyle(hoverColor));
        bg.on('pointerout', () => bg.setFillStyle(baseColor));
        bg.on('pointerdown', onClick);
    }
}