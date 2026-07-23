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
import {
    LEVEL_ONE_LAYER_NAMES,
    LEVEL_ONE_TILESET_NAME,
} from '../constants/tiledLevel';
import {
    LevelMapValidationError,
    TiledMapLike,
    ValidatedLevelMapData,
    validateAndExtractLevelMapData,
} from '../level/tiledLevelValidation';

type SpriteWithBody = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

type TileLayerName =
    | (typeof LEVEL_ONE_LAYER_NAMES)['background']
    | (typeof LEVEL_ONE_LAYER_NAMES)['ground']
    | (typeof LEVEL_ONE_LAYER_NAMES)['platforms']
    | (typeof LEVEL_ONE_LAYER_NAMES)['decorationBehind']
    | (typeof LEVEL_ONE_LAYER_NAMES)['decorationFront']
    | (typeof LEVEL_ONE_LAYER_NAMES)['collision'];

export class LevelOne extends Scene {
    private _input!:     InputController;
    private _mobile!:    MobileControls;
    private _player!:    SpriteWithBody;
    private _character!: CharacterConfig;
    private _spawnX = SPAWN_X;
    private _spawnY = WORLD_HEIGHT - GROUND_HEIGHT - (PLAYER_HEIGHT * PLAYER_SPRITE_SCALE) / 2;
    private _worldWidth = WORLD_WIDTH;
    private _worldHeight = WORLD_HEIGHT;

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

        if (!this._buildLevelFromTiledMap()) {
            this._buildPrototypeFallbackLevel();
        }

        // ── Camera ───────────────────────────────────────────────────────────
        this.cameras.main.setBounds(0, 0, this._worldWidth, this._worldHeight);
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

        // ── Kill zone (prototype fallback only) ───────────────────────────────
        if (this._player.y > KILL_ZONE_Y && !this._isHurt) this._enterHurtState();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private _buildLevelFromTiledMap(): boolean {
        try {
            const mapData = this._getValidatedTiledMapData();
            const map = this.make.tilemap({ key: ASSET_KEYS.levelOneMap });
            const tileset = map.addTilesetImage(LEVEL_ONE_TILESET_NAME, ASSET_KEYS.levelOneTiles);

            if (!tileset) {
                throw new LevelMapValidationError(
                    `tileset "${LEVEL_ONE_TILESET_NAME}" was not found in loaded assets`,
                );
            }

            const background = this._createRequiredTileLayer(map, LEVEL_ONE_LAYER_NAMES.background, tileset);
            const ground = this._createRequiredTileLayer(map, LEVEL_ONE_LAYER_NAMES.ground, tileset);
            const platforms = this._createRequiredTileLayer(map, LEVEL_ONE_LAYER_NAMES.platforms, tileset);
            const decorationBehind = this._createRequiredTileLayer(map, LEVEL_ONE_LAYER_NAMES.decorationBehind, tileset);
            const decorationFront = this._createRequiredTileLayer(map, LEVEL_ONE_LAYER_NAMES.decorationFront, tileset);
            const collision = this._createRequiredTileLayer(map, LEVEL_ONE_LAYER_NAMES.collision, tileset);

            background.setDepth(-30);
            decorationBehind.setDepth(-10);
            ground.setDepth(0);
            platforms.setDepth(1);
            collision.setVisible(false);
            decorationFront.setDepth(15);

            collision.setCollisionByExclusion([-1]);

            this._worldWidth = mapData.dimensions.widthPixels;
            this._worldHeight = mapData.dimensions.heightPixels;
            this._spawnX = mapData.playerSpawn.x;
            this._spawnY = mapData.playerSpawn.y;

            this.physics.world.setBounds(0, 0, this._worldWidth, this._worldHeight + 1200);

            const goal = this.physics.add.staticImage(
                mapData.levelGoal.x + mapData.levelGoal.width / 2,
                mapData.levelGoal.y + mapData.levelGoal.height / 2,
                ASSET_KEYS.pixel,
            );
            goal
                .setDisplaySize(mapData.levelGoal.width, mapData.levelGoal.height)
                .setTint(GOAL_COLOR)
                .setAlpha(0.25)
                .refreshBody();

            this._player = this.physics.add.sprite(this._spawnX, this._spawnY, this._character.assetKey, 0);
            this._player
                .setDisplaySize(PLAYER_WIDTH * PLAYER_SPRITE_SCALE, PLAYER_HEIGHT * PLAYER_SPRITE_SCALE)
                .setCollideWorldBounds(true);

            const body = this._player.body;
            body.setSize(this._character.collisionWidth, this._character.collisionHeight);
            body.setOffset(
                (this._player.width - this._character.collisionWidth) / 2,
                this._player.height - this._character.collisionHeight,
            );

            this.physics.add.collider(this._player, collision);
            this.physics.add.overlap(this._player, goal, () => {
                if (!this._levelDone) this._completeLevel();
            });

            const killZoneGroup = this.physics.add.staticGroup();
            for (const zone of mapData.killZones) {
                const killZoneSprite = this.physics.add.staticImage(
                    zone.x + zone.width / 2,
                    zone.y + zone.height / 2,
                    ASSET_KEYS.pixel,
                );
                killZoneSprite
                    .setDisplaySize(zone.width, zone.height)
                    .setVisible(false)
                    .refreshBody();
                killZoneGroup.add(killZoneSprite);
            }
            this.physics.add.overlap(this._player, killZoneGroup, () => {
                if (!this._isHurt && !this._levelDone) this._enterHurtState();
            });

            this._drawDevMarkers(mapData);

            return true;
        } catch (error) {
            this._showDevelopmentMapError(error);
            return false;
        }
    }

    private _getValidatedTiledMapData(): ValidatedLevelMapData {
        const cacheEntry = this.cache.tilemap.get(ASSET_KEYS.levelOneMap) as { data?: TiledMapLike } | undefined;
        if (!cacheEntry?.data) {
            throw new LevelMapValidationError('tilemap JSON was not loaded into cache');
        }

        return validateAndExtractLevelMapData(cacheEntry.data);
    }

    private _createRequiredTileLayer(
        map: Phaser.Tilemaps.Tilemap,
        layerName: TileLayerName,
        tileset: Phaser.Tilemaps.Tileset,
    ): Phaser.Tilemaps.TilemapLayer {
        const layer = map.createLayer(layerName, tileset, 0, 0);
        if (!layer) {
            throw new LevelMapValidationError(`unable to create required layer "${layerName}"`);
        }
        return layer;
    }

    private _showDevelopmentMapError(error: unknown): void {
        const msg = error instanceof Error ? error.message : 'Unknown map validation error';
        console.error(msg, error);

        this.add.text(16, 48, `Level map fallback active\n${msg}`, {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#ff6b6b',
            backgroundColor: '#2b0f0f',
            padding: { x: 6, y: 4 },
        }).setScrollFactor(0).setDepth(999);
    }

    private _drawDevMarkers(mapData: ValidatedLevelMapData): void {
        for (const point of mapData.collectibleSpawns) {
            this.add.circle(point.x, point.y, 8, 0xf1c40f, 0.5).setDepth(20);
        }

        for (const point of mapData.enemySpawns) {
            this.add.circle(point.x, point.y, 10, 0xe74c3c, 0.5).setDepth(20);
        }

        for (const point of mapData.checkpoints) {
            this.add.rectangle(point.x, point.y - 24, 16, 32, 0x3498db, 0.5).setDepth(20);
        }
    }

    private _buildPrototypeFallbackLevel(): void {
        this._spawnX = SPAWN_X;
        this._spawnY = WORLD_HEIGHT - GROUND_HEIGHT - (PLAYER_HEIGHT * PLAYER_SPRITE_SCALE) / 2;
        this._worldWidth = WORLD_WIDTH;
        this._worldHeight = WORLD_HEIGHT;

        this.physics.world.setBounds(0, -200, WORLD_WIDTH, WORLD_HEIGHT + 2200);

        const ground = this.physics.add.staticImage(
            GROUND_WIDTH / 2, GROUND_Y, ASSET_KEYS.pixel,
        );
        ground.setDisplaySize(GROUND_WIDTH, GROUND_HEIGHT)
            .setTint(GROUND_COLOR)
            .refreshBody();

        const platforms = this.physics.add.staticGroup();
        platforms.add(ground, true);

        for (const [cx, cy, w] of PLATFORMS) {
            const p = this.physics.add.staticImage(cx, cy, ASSET_KEYS.pixel);
            p.setDisplaySize(w, PLATFORM_HEIGHT).setTint(PLATFORM_COLOR).refreshBody();
            platforms.add(p, true);
        }

        const goal = this.physics.add.staticImage(GOAL_X, GOAL_Y, ASSET_KEYS.pixel);
        goal.setDisplaySize(GOAL_WIDTH, GOAL_HEIGHT).setTint(GOAL_COLOR).refreshBody();

        this._player = this.physics.add.sprite(this._spawnX, this._spawnY, this._character.assetKey, 0);
        this._player
            .setDisplaySize(PLAYER_WIDTH * PLAYER_SPRITE_SCALE, PLAYER_HEIGHT * PLAYER_SPRITE_SCALE)
            .setCollideWorldBounds(true);

        const body = this._player.body;
        body.setSize(this._character.collisionWidth, this._character.collisionHeight);
        body.setOffset(
            (this._player.width - this._character.collisionWidth) / 2,
            this._player.height - this._character.collisionHeight,
        );

        this.physics.add.collider(this._player, platforms);
        this.physics.add.overlap(this._player, goal, () => {
            if (!this._levelDone) this._completeLevel();
        });
    }

    private _respawn(): void {
        this._player.setPosition(this._spawnX, this._spawnY);
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
