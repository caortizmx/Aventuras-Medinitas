import { GameObjects, Input, Scene, Scale } from 'phaser';
import { ASSET_KEYS } from '../constants/assetKeys';
import {
    SCENE_LEVEL_ONE,
    SCENE_MAIN_MENU,
} from '../constants/sceneKeys';
import { calculateCoverScale, calculateGameOverLayout } from '../layout/responsiveLayout';
import { RENDER_DEPTHS } from '../constants/renderDepths';

interface GameOverData {
    reason?: string;
    lives?: number;
    score?: number;
    collectibleCount?: number;
    totalCollectibles?: number;
    characterId?: string;
}

interface ActionButton {
    background: GameObjects.Rectangle;
    label: GameObjects.Text;
}

const BUTTON_COLOR = 0x287a50;
const BUTTON_SELECTED_COLOR = 0x35a36b;
const RETRY_ACTION = 0;
const MENU_ACTION = 1;

export class GameOver extends Scene {
    private _data: GameOverData = {};
    private _background!: GameObjects.Image;
    private _overlay!: GameObjects.Rectangle;
    private _panel!: GameObjects.Rectangle;
    private _title!: GameObjects.Text;
    private _summary!: GameObjects.Text;
    private _retryButton!: ActionButton;
    private _menuButton!: ActionButton;
    private _selectedAction = RETRY_ACTION;

    constructor () {
        super('GameOver');
    }

    create (data: GameOverData = {}): void {
        this._data = data;
        const depth = RENDER_DEPTHS.modal;

        this._background = this.add.image(0, 0, ASSET_KEYS.background).setDepth(depth);
        this._overlay = this.add.rectangle(0, 0, 1, 1, 0x120d24, 0.72).setDepth(depth + 1);
        this._panel = this.add.rectangle(0, 0, 1, 1, 0x1c2333, 0.96)
            .setStrokeStyle(3, 0xf3c969)
            .setDepth(depth + 2);
        this._title = this.add.text(0, 0, 'Game Over', {
            fontFamily: 'Arial Black',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center',
        }).setOrigin(0.5).setDepth(depth + 3);
        this._summary = this.add.text(0, 0, this._buildSummary(), {
            fontFamily: 'Arial',
            color: '#eef6ff',
            align: 'center',
            lineSpacing: 6,
        }).setOrigin(0.5).setDepth(depth + 3);
        this._retryButton = this._createButton('Retry', () => {
            this.scene.start(SCENE_LEVEL_ONE, { characterId: this._data.characterId });
        });
        this._menuButton = this._createButton('Main Menu', () => {
            this.scene.start(SCENE_MAIN_MENU);
        });

        this._layout();
        this._refreshSelection();
        this.scale.on(Scale.Events.RESIZE, this._layout, this);
        this.input.keyboard?.on(Input.Keyboard.Events.ANY_KEY_DOWN, this._handleKey, this);
        this.events.once('shutdown', () => {
            this.scale.off(Scale.Events.RESIZE, this._layout, this);
            this.input.keyboard?.off(Input.Keyboard.Events.ANY_KEY_DOWN, this._handleKey, this);
        });
    }

    private _buildSummary (): string {
        const lines = [
            typeof this._data.lives === 'number' ? `Lives: ${this._data.lives}` : undefined,
            typeof this._data.score === 'number' ? `Score: ${this._data.score}` : undefined,
            typeof this._data.collectibleCount === 'number'
                ? `Collectibles: ${this._data.collectibleCount}/${this._data.totalCollectibles ?? this._data.collectibleCount}`
                : undefined,
            this._data.reason,
        ];
        return lines.filter((line): line is string => Boolean(line)).join('\n');
    }

    private _createButton (label: string, action: () => void): ActionButton {
        const depth = RENDER_DEPTHS.modal + 3;
        const background = this.add.rectangle(0, 0, 1, 1, BUTTON_COLOR)
            .setStrokeStyle(2, 0xffffff, 0.75)
            .setInteractive({ useHandCursor: true })
            .setDepth(depth);
        const text = this.add.text(0, 0, label, {
            fontFamily: 'Arial Black',
            fontSize: '18px',
            color: '#ffffff',
        }).setOrigin(0.5).setDepth(depth + 1);

        background.on('pointerover', () => {
            this._selectedAction = background === this._retryButton?.background
                ? RETRY_ACTION
                : MENU_ACTION;
            this._refreshSelection();
        });
        background.on('pointerdown', action);
        return { background, label: text };
    }

    private _layout (): void {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const layout = calculateGameOverLayout(width, height);

        this._background
            .setPosition(width / 2, height / 2)
            .setScale(calculateCoverScale(this._background.width, this._background.height, width, height));
        this._overlay.setPosition(width / 2, height / 2).setSize(width, height);
        this._panel
            .setPosition(layout.panelX, layout.panelY)
            .setSize(layout.panelWidth, layout.panelHeight);
        this._title
            .setPosition(layout.panelX, layout.titleY)
            .setFontSize(layout.titleFontSize)
            .setWordWrapWidth(layout.panelWidth - 32);
        this._summary
            .setPosition(layout.panelX, layout.summaryY)
            .setFontSize(layout.summaryFontSize)
            .setWordWrapWidth(layout.panelWidth - 40);
        this._positionButton(this._retryButton, layout.panelX, layout.retryButtonY, layout.buttonWidth, layout.buttonHeight);
        this._positionButton(this._menuButton, layout.panelX, layout.menuButtonY, layout.buttonWidth, layout.buttonHeight);
    }

    private _positionButton (
        button: ActionButton,
        x: number,
        y: number,
        width: number,
        height: number,
    ): void {
        button.background.setPosition(x, y).setSize(width, height);
        button.label.setPosition(x, y);
    }

    private _handleKey (event: KeyboardEvent): void {
        if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            this._selectedAction = RETRY_ACTION;
            this._refreshSelection();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            this._selectedAction = MENU_ACTION;
            this._refreshSelection();
        } else if (event.key === 'Enter' || event.key === ' ') {
            (this._selectedAction === RETRY_ACTION ? this._retryButton : this._menuButton)
                .background.emit('pointerdown');
        }
    }

    private _refreshSelection (): void {
        [this._retryButton, this._menuButton].forEach((button, index) => {
            button.background.setFillStyle(index === this._selectedAction ? BUTTON_SELECTED_COLOR : BUTTON_COLOR);
            button.background.setScale(index === this._selectedAction ? 1.02 : 1);
        });
    }
}
