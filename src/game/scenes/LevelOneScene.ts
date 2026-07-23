import { Scene } from 'phaser';
import { registerCharacterAnimations } from '../animations/characterAnimations';
import { ensureCharacterFallbackTextures } from '../assets/characterFallback';
import { getCharacterAnimationKey, CharacterAnimationState } from '../constants/animationKeys';
import { InputController } from '../input/InputController';
import { MobileControls } from '../input/MobileControls';
import {
    CELEBRATION_EXIT_DELAY_MS,
    HURT_RECOVERY_DELAY_MS,
    PLAYER_HEIGHT,
    PLAYER_RUN_ANIMATION_THRESHOLD,
    PLAYER_SPRITE_SCALE,
    PLAYER_WIDTH,
    CAMERA_LERP_X, CAMERA_LERP_Y,
    GAME_HEIGHT, GAME_WIDTH,
    GOAL_COLOR, GOAL_HEIGHT, GOAL_WIDTH, GOAL_X, GOAL_Y,
    GRAVITY,
    GROUND_COLOR, GROUND_HEIGHT, GROUND_WIDTH, GROUND_Y,
    KILL_ZONE_Y,
    PLATFORM_COLOR, PLATFORM_HEIGHT, PLATFORMS,
    SPAWN_X,
    WORLD_HEIGHT, WORLD_WIDTH,
} from '../constants/gameValues';
import { SCENE_MAIN_MENU } from '../constants/sceneKeys';
import { CharacterConfig, findCharacterById, getDefaultCharacter } from '../data/characters';
import { ASSET_KEYS } from '../constants/assetKeys';

type SpriteWithBody = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

export class LevelOne extends Scene {
    private _input!:     InputController;
    private _mobile!:    MobileControls;
    private _player!:    SpriteWithBody;
    private _character!: CharacterConfig;
    private _spawnY!:    number;

    private _pauseBg!:    Phaser.GameObjects.Rectangle;
    private _pauseTitle!: Phaser.GameObjects.Text;
    private _pauseHint!:  Phaser.GameObjects.Text;

    private _goalBanner!: Phaser.GameObjects.Text;

    private _isPaused  = false;
    private _levelDone = false;
    private _isHurt    = false;
    private _prevJump  = false;
    private _prevPause = false;
    private _activeAnimState?: CharacterAnimationState;

    constructor() { super('LevelOne'); }

    // ── Receive scene data ────────────────────────────────────────────────────

    init(data: { characterId?: string }): void {
        this._character = (data?.characterId ? findCharacterById(data.characterId) : undefined)
            ?? getDefaultCharacter();
        // Compute spawn Y so every character lands flush on the ground
        this._spawnY = WORLD_HEIGHT - GROUND_HEIGHT - this._character.collisionHeight / 2;
    }

    create(): void {
        this._isPaused  = false;
        this._levelDone = false;
        this._isHurt    = false;
        this._prevJump  = false;
        this._prevPause = false;
        this._activeAnimState = undefined;

        // ── Input ────────────────────────────────────────────────────────────
        this._input  = new InputController();
        this._mobile = new MobileControls(
            this._input,
            this.game.canvas.parentElement ?? document.body,
        );

        // Cleanup on scene stop so listeners aren't duplicated on restart
        this.events.once('shutdown', () => {
            this._input.destroy();
            this._mobile.destroy();
        });

        // ── Textures (1-px white; resize per object) ──────────────────────────
        if (!this.textures.exists(ASSET_KEYS.pixel)) {
            const g = this.add.graphics();
            g.fillStyle(0xffffff).fillRect(0, 0, 1, 1);
            g.generateTexture(ASSET_KEYS.pixel, 1, 1);
            g.destroy();
        }

        ensureCharacterFallbackTextures(this, new Set<string>());
        registerCharacterAnimations(this.anims);

        // ── World bounds (tall enough that kill-zone fires before bottom) ─────
        this.physics.world.setBounds(0, -200, WORLD_WIDTH, WORLD_HEIGHT + 2200);

        // ── Ground ───────────────────────────────────────────────────────────
        const ground = this.physics.add.staticImage(
            GROUND_WIDTH / 2, GROUND_Y, ASSET_KEYS.pixel,
        );
        ground.setDisplaySize(GROUND_WIDTH, GROUND_HEIGHT)
              .setTint(GROUND_COLOR)
              .refreshBody();

        // ── Platforms ────────────────────────────────────────────────────────
        const platforms = this.physics.add.staticGroup();
        platforms.add(ground, true);

        for (const [cx, cy, w] of PLATFORMS) {
            const p = this.physics.add.staticImage(cx, cy, ASSET_KEYS.pixel);
            p.setDisplaySize(w, PLATFORM_HEIGHT).setTint(PLATFORM_COLOR).refreshBody();
            platforms.add(p, true);
        }

        // ── Goal zone ────────────────────────────────────────────────────────
        const goal = this.physics.add.staticImage(GOAL_X, GOAL_Y, ASSET_KEYS.pixel);
        goal.setDisplaySize(GOAL_WIDTH, GOAL_HEIGHT).setTint(GOAL_COLOR).refreshBody();

        // ── Player (appearance driven by character config) ────────────────────
        this._player = this.physics.add.sprite(SPAWN_X, this._spawnY, this._character.assetKey, 0);
        this._player
            .setDisplaySize(PLAYER_WIDTH * PLAYER_SPRITE_SCALE, PLAYER_HEIGHT * PLAYER_SPRITE_SCALE)
            .setCollideWorldBounds(true);

        const body = this._player.body;
        body.setSize(this._character.collisionWidth, this._character.collisionHeight);
        body.setOffset(
            (this._player.width - this._character.collisionWidth) / 2,
            this._player.height - this._character.collisionHeight,
        );

        // ── Physics / Collisions ──────────────────────────────────────────────
        this.physics.add.collider(this._player, platforms);
        this.physics.add.overlap(this._player, goal, () => {
            if (!this._levelDone) this._completeLevel();
        });

        // ── Camera ───────────────────────────────────────────────────────────
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.startFollow(
            this._player, false, CAMERA_LERP_X, CAMERA_LERP_Y,
        );
        this._playCharacterAnimation('idle');

        // ── UI decorations ────────────────────────────────────────────────────
        this._buildUI();
    }

    // ── per-frame update ─────────────────────────────────────────────────────

    update(_time: number, _delta: number): void {
        const state = this._input.getState();

        // Pause toggle (rising-edge; checked even while paused so you can unpause)
        if (state.pause && !this._prevPause) this._togglePause();
        this._prevPause = state.pause;

        if (this._isPaused || this._levelDone || this._isHurt) return;

        // ── Horizontal movement ───────────────────────────────────────────────
        if (state.left && !state.right) {
            this._player.setVelocityX(-this._character.movementSpeed);
            this._player.setFlipX(true);
        } else if (state.right && !state.left) {
            this._player.setVelocityX(this._character.movementSpeed);
            this._player.setFlipX(false);
        } else {
            this._player.setVelocityX(0);
        }

        // ── Jump (rising-edge + grounded = no double-jump) ────────────────────
        const grounded = this._player.body.blocked.down;
        if (state.jump && !this._prevJump && grounded) {
            this._player.setVelocityY(this._character.jumpVelocity);
        }
        this._prevJump = state.jump;
        this._updateMovementAnimation();

        // ── Kill zone ─────────────────────────────────────────────────────────
        if (this._player.y > KILL_ZONE_Y && !this._isHurt) this._enterHurtState();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private _respawn(): void {
        this._player.setPosition(SPAWN_X, this._spawnY);
        this._player.setVelocity(0, 0);
        this._input.resetAll();
        this._prevJump = false;
        this._isHurt = false;
        this._player.body.moves = true;
        this._playCharacterAnimation('idle');
    }

    private _enterHurtState(): void {
        this._isHurt = true;
        this._input.resetAll();
        this._player.setVelocity(0, 0);
        this._player.body.moves = false;
        this._playCharacterAnimation('hurt');

        this.time.delayedCall(HURT_RECOVERY_DELAY_MS, () => {
            this._respawn();
        });
    }

    private _togglePause(): void {
        this._isPaused = !this._isPaused;
        this._input.resetAll();
        this._prevJump = false;

        if (this._isPaused) {
            this.physics.pause();
        } else {
            this.physics.resume();
        }

        this._pauseBg.setVisible(this._isPaused);
        this._pauseTitle.setVisible(this._isPaused);
        this._pauseHint.setVisible(this._isPaused);
    }

    private _completeLevel(): void {
        this._levelDone = true;
        this._input.resetAll();
        this._player.setVelocity(0, 0);
        this._player.body.moves = false;
        this._playCharacterAnimation('celebrate');
        this._goalBanner.setVisible(true);

        this.time.delayedCall(CELEBRATION_EXIT_DELAY_MS, () => {
            this.scene.start(SCENE_MAIN_MENU);
        });
    }

    private _buildUI(): void {
        const depth = 100;
        const cx    = GAME_WIDTH / 2;
        const cy    = GAME_HEIGHT / 2;

        // Pause overlay
        this._pauseBg = this.add
            .rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65)
            .setScrollFactor(0).setDepth(depth).setVisible(false);

        this._pauseTitle = this.add
            .text(cx, cy - 30, 'PAUSED', {
                fontFamily: 'Arial Black',
                fontSize:   '48px',
                color:      '#ffffff',
            })
            .setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1).setVisible(false);

        this._pauseHint = this.add
            .text(cx, cy + 36, 'Press Esc / P  or  ⏸  to resume', {
                fontFamily: 'Arial',
                fontSize:   '22px',
                color:      '#cccccc',
            })
            .setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1).setVisible(false);

        // Goal reached banner
        this._goalBanner = this.add
            .text(cx, cy, '🎉  Level Complete!', {
                fontFamily: 'Arial Black',
                fontSize:   '42px',
                color:      '#f1c40f',
                stroke:     '#000000',
                strokeThickness: 6,
            })
            .setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1).setVisible(false);

        // Gravity indicator at top-left
        this.add
            .text(12, 10, `gravity ${GRAVITY} px/s²`, {
                fontFamily: 'monospace',
                fontSize:   '12px',
                color:      '#ffffff88',
            })
            .setScrollFactor(0).setDepth(depth);

        // Playing-as indicator
        this.add
            .text(12, 26, `Playing as: ${this._character.displayName}`, {
                fontFamily: 'monospace',
                fontSize:   '12px',
                color:      '#ffffff88',
            })
            .setScrollFactor(0).setDepth(depth);

        // Back to menu hint
        this.add
            .text(GAME_WIDTH - 12, 10, 'Esc / P = pause', {
                fontFamily: 'monospace',
                fontSize:   '12px',
                color:      '#ffffff88',
                align:      'right',
            })
            .setOrigin(1, 0).setScrollFactor(0).setDepth(depth);
    }

    private _updateMovementAnimation(): void {
        const body = this._player.body;
        const grounded = body.blocked.down || body.touching.down;
        const velocityX = this._player.body.velocity.x;
        const velocityY = this._player.body.velocity.y;

        if (!grounded) {
            if (velocityY < 0) {
                this._playCharacterAnimation('jump');
            } else {
                this._playCharacterAnimation('fall');
            }
            return;
        }

        if (Math.abs(velocityX) > PLAYER_RUN_ANIMATION_THRESHOLD) {
            this._playCharacterAnimation('run');
            return;
        }

        this._playCharacterAnimation('idle');
    }

    private _playCharacterAnimation(state: CharacterAnimationState): void {
        if (this._activeAnimState === state) {
            return;
        }
        this._activeAnimState = state;
        this._player.play(getCharacterAnimationKey(this._character.id, state), true);
    }
}
