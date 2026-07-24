import { Input, Scene } from 'phaser';
import { CAMPAIGN_LEVELS, isLevelUnlocked } from '../constants/campaign';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants/gameValues';
import { SCENE_CHARACTER_SELECT, SCENE_LEVEL_ONE, SCENE_LEVEL_SELECT } from '../constants/sceneKeys';
import { loadGameSaveData } from '../system/SaveSystem';

export class LevelSelect extends Scene {
    private _selectedIndex = 0;
    private _buttons: Phaser.GameObjects.Rectangle[] = [];
    private _labels: Phaser.GameObjects.Text[] = [];
    private _unlockedLevel = 1;

    constructor() {
        super(SCENE_LEVEL_SELECT);
    }

    create(): void {
        const save = loadGameSaveData();
        this._unlockedLevel = save.unlockedLevel;
        const currentIndex = CAMPAIGN_LEVELS.findIndex(({ id }) => id === save.currentLevelId);
        this._selectedIndex = Math.max(
            0,
            Math.min(currentIndex >= 0 ? currentIndex : save.unlockedLevel - 1, save.unlockedLevel - 1),
        );

        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x151b2d);
        this.add.text(GAME_WIDTH / 2, 62, 'Choose a level', {
            fontFamily: 'Arial Black',
            fontSize: '34px',
            color: '#f1c40f',
            stroke: '#000000',
            strokeThickness: 5,
        }).setOrigin(0.5);

        this._buttons = [];
        this._labels = [];
        CAMPAIGN_LEVELS.forEach((level, index) => {
            const x = GAME_WIDTH / 2;
            const y = 170 + index * 105;
            const unlocked = isLevelUnlocked(level.id, this._unlockedLevel);
            const button = this.add.rectangle(x, y, 430, 76, unlocked ? 0x285c8f : 0x3a3d46)
                .setInteractive({ useHandCursor: unlocked });
            const best = save.bestScores[level.id] ?? 0;
            const label = this.add.text(
                x,
                y,
                `${level.levelOrder}. ${level.title}${unlocked ? `\nBest score: ${best}` : '\nLocked'}`,
                {
                    fontFamily: 'Arial Black',
                    fontSize: '18px',
                    color: unlocked ? '#ffffff' : '#999999',
                    align: 'center',
                },
            ).setOrigin(0.5);
            button.on('pointerdown', () => {
                if (unlocked) {
                    this._selectedIndex = index;
                    this._startSelected();
                }
            });
            this._buttons.push(button);
            this._labels.push(label);
        });

        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 40,
            '← / → or ↑ / ↓ to choose   •   Enter to play   •   Esc to change character', {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#b7c4d8',
            }).setOrigin(0.5);
        this._refresh();
        this.input.keyboard?.on(Input.Keyboard.Events.ANY_KEY_DOWN, this._handleKey, this);
        this.events.once('shutdown', () => {
            this.input.keyboard?.off(Input.Keyboard.Events.ANY_KEY_DOWN, this._handleKey, this);
        });
    }

    private _handleKey(event: KeyboardEvent): void {
        if (['ArrowLeft', 'ArrowUp'].includes(event.key)) {
            this._selectedIndex = Math.max(0, this._selectedIndex - 1);
            this._refresh();
        } else if (['ArrowRight', 'ArrowDown'].includes(event.key)) {
            this._selectedIndex = Math.min(this._unlockedLevel - 1, this._selectedIndex + 1);
            this._refresh();
        } else if (event.key === 'Enter' || event.key === ' ') {
            this._startSelected();
        } else if (event.key === 'Escape') {
            this.scene.start(SCENE_CHARACTER_SELECT);
        }
    }

    private _refresh(): void {
        this._buttons.forEach((button, index) => {
            const level = CAMPAIGN_LEVELS[index];
            const unlocked = level ? isLevelUnlocked(level.id, this._unlockedLevel) : false;
            button.setStrokeStyle(index === this._selectedIndex && unlocked ? 4 : 0, 0xf1c40f);
            this._labels[index]?.setAlpha(index === this._selectedIndex ? 1 : 0.82);
        });
    }

    private _startSelected(): void {
        const level = CAMPAIGN_LEVELS[this._selectedIndex];
        if (!level || !isLevelUnlocked(level.id, this._unlockedLevel)) {
            return;
        }
        const save = loadGameSaveData();
        this.scene.start(SCENE_LEVEL_ONE, {
            characterId: save.selectedCharacterId,
            levelId: level.id,
        });
    }
}
