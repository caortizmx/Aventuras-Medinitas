import { Scene } from 'phaser';
import { CHARACTERS, CharacterConfig, getDefaultCharacter } from '../data/characters';
import { saveSelectedCharacter, loadSelectedCharacterId } from '../system/SaveSystem';
import { SCENE_LEVEL_ONE } from '../constants/sceneKeys';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants/gameValues';
import { getCharacterAnimationKey } from '../constants/animationKeys';

// ── Layout constants ──────────────────────────────────────────────────────────
const CARD_W      = 160;
const CARD_H      = 180;
const CARD_Y      = GAME_HEIGHT / 2 - 20;
const BTN_Y       = GAME_HEIGHT - 52;
const BTN_W       = 200;
const BTN_H       = 44;

const CLR_BG          = 0x1a1a2e;
const CLR_CARD_IDLE   = 0x2c2c4e;
const CLR_CARD_SEL    = 0x4a4a8e;
const CLR_CARD_HOVER  = 0x3a3a7e;  // between IDLE and SEL, for non-selected hover
const CLR_BORDER_SEL  = 0xf1c40f;
const CLR_BTN         = 0x27ae60;
const CLR_BTN_HOVER   = 0x2ecc71;
const CLR_TEXT        = '#ffffff';
const CLR_LABEL       = '#f1c40f';

// Horizontal card centers: evenly split across width
const CARD_CENTERS_X = [
    Math.round(GAME_WIDTH * 0.22),
    Math.round(GAME_WIDTH * 0.50),
    Math.round(GAME_WIDTH * 0.78),
];

interface CardObjects {
    bg:     Phaser.GameObjects.Rectangle;
    border: Phaser.GameObjects.Rectangle;
    preview: Phaser.GameObjects.Sprite;
    name:   Phaser.GameObjects.Text;
}

export class CharacterSelect extends Scene {
    private _cards:         CardObjects[] = [];
    private _startBtn!:     Phaser.GameObjects.Rectangle;
    private _selectedIndex  = 0;

    private readonly _onKeyDown: (e: KeyboardEvent) => void;

    constructor() {
        super('CharacterSelect');
        this._onKeyDown = this._handleKeyDown.bind(this);
    }

    create(): void {
        // Restore last selection (safe from corrupted data)
        const savedId    = loadSelectedCharacterId();
        const savedIndex = CHARACTERS.findIndex(c => c.id === savedId);
        this._selectedIndex = savedIndex >= 0 ? savedIndex : 0;

        this._buildBackground();
        this._buildTitle();
        this._buildCards();
        this._buildStartButton();
        this._buildHint();
        this._refresh();

        // Keyboard navigation
        window.addEventListener('keydown', this._onKeyDown);
        this.events.once('shutdown', () => {
            window.removeEventListener('keydown', this._onKeyDown);
        });
    }

    // ── Private builders ──────────────────────────────────────────────────────

    private _buildBackground(): void {
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, CLR_BG);
    }

    private _buildTitle(): void {
        this.add.text(GAME_WIDTH / 2, 36, 'Choose your character', {
            fontFamily: 'Arial Black',
            fontSize:   '28px',
            color:      CLR_LABEL,
            stroke:     '#000000',
            strokeThickness: 5,
        }).setOrigin(0.5);
    }

    private _buildCards(): void {
        this._cards = [];

        CHARACTERS.forEach((char: CharacterConfig, i: number) => {
            const cx = CARD_CENTERS_X[i];
            const cy = CARD_Y;

            // Card background
            const bg = this.add
                .rectangle(cx, cy, CARD_W, CARD_H, CLR_CARD_IDLE)
                .setInteractive({ useHandCursor: true });

            // Selection border (hidden when idle)
            const border = this.add
                .rectangle(cx, cy, CARD_W + 8, CARD_H + 8)
                .setStrokeStyle(4, CLR_BORDER_SEL)
                .setFillStyle(0, 0);   // transparent fill

            const preview = this.add.sprite(cx, cy - 20, char.assetKey, 0)
                .setDisplaySize(84, 84);
            preview.play(getCharacterAnimationKey(char.id, 'idle'));

            // Character name below swatch
            const name = this.add.text(cx, cy + 66, char.displayName, {
                fontFamily: 'Arial Black',
                fontSize:   '18px',
                color:      CLR_TEXT,
            }).setOrigin(0.5);

            this._cards.push({ bg, border, preview, name });

            // Pointer interactions
            bg.on('pointerdown', () => {
                this._selectedIndex = i;
                this._refresh();
            });
            bg.on('pointerover', () => {
                if (this._selectedIndex !== i) bg.setFillStyle(CLR_CARD_HOVER);
            });
            bg.on('pointerout', () => {
                if (this._selectedIndex !== i) bg.setFillStyle(CLR_CARD_IDLE);
            });
        });
    }

    private _buildStartButton(): void {
        const cx = GAME_WIDTH / 2;

        this._startBtn = this.add
            .rectangle(cx, BTN_Y, BTN_W, BTN_H, CLR_BTN)
            .setInteractive({ useHandCursor: true });

        this.add.text(cx, BTN_Y, 'Start Game', {
            fontFamily: 'Arial Black',
            fontSize:   '20px',
            color:      CLR_TEXT,
        }).setOrigin(0.5);

        this._startBtn.on('pointerdown', () => this._startGame());
        this._startBtn.on('pointerover',  () => this._startBtn.setFillStyle(CLR_BTN_HOVER));
        this._startBtn.on('pointerout',   () => this._startBtn.setFillStyle(CLR_BTN));
    }

    private _buildHint(): void {
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 14,
            '← / → or A / D to navigate   •   Enter or Space to start', {
            fontFamily: 'monospace',
            fontSize:   '11px',
            color:      '#aaaaaa',
        }).setOrigin(0.5);
    }

    // ── Keyboard handler ──────────────────────────────────────────────────────

    private _handleKeyDown(e: KeyboardEvent): void {
        switch (e.code) {
            case 'ArrowLeft':
            case 'KeyA':
                e.preventDefault();
                this._selectedIndex =
                    (this._selectedIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
                this._refresh();
                break;

            case 'ArrowRight':
            case 'KeyD':
                e.preventDefault();
                this._selectedIndex =
                    (this._selectedIndex + 1) % CHARACTERS.length;
                this._refresh();
                break;

            case 'Enter':
            case 'Space':
                e.preventDefault();
                this._startGame();
                break;
        }
    }

    // ── Visual update ─────────────────────────────────────────────────────────

    private _refresh(): void {
        this._cards.forEach((card, i) => {
            const selected = i === this._selectedIndex;
            card.bg.setFillStyle(selected ? CLR_CARD_SEL : CLR_CARD_IDLE);
            card.border.setVisible(selected);
            card.name.setColor(selected ? CLR_LABEL : CLR_TEXT);
        });
    }

    // ── Launch level ──────────────────────────────────────────────────────────

    private _startGame(): void {
        const character = CHARACTERS[this._selectedIndex] ?? getDefaultCharacter();
        saveSelectedCharacter(character.id);
        this.scene.start(SCENE_LEVEL_ONE, { characterId: character.id });
    }
}
