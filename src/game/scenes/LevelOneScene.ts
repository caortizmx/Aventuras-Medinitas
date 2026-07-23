import { Math as PhaserMath, Scene } from 'phaser';
import { getCharacterAnimationKey, CharacterAnimationState } from '../constants/animationKeys';
import { InputController } from '../input/InputController';
import { MobileControls } from '../input/MobileControls';
import {
    CELEBRATION_EXIT_DELAY_MS,
    HURT_RECOVERY_DELAY_MS,
    PLAYER_HEIGHT,
    PLAYER_RUN_ANIMATION_THRESHOLD,
    PLAYER_SPRITE_SCALE,
    CAMERA_LERP_X, CAMERA_LERP_Y,
    GAME_HEIGHT, GAME_WIDTH,
    GOAL_HEIGHT, GOAL_WIDTH, GOAL_X, GOAL_Y,
    GRAVITY,
    GROUND_HEIGHT, GROUND_WIDTH, GROUND_Y,
    JUMP_BUFFER_MS,
    JUMP_COYOTE_TIME_MS,
    KILL_ZONE_Y,
    PLATFORM_HEIGHT, PLATFORMS,
    SPAWN_X,
    WORLD_HEIGHT, WORLD_WIDTH,
    PLAYER_INITIAL_LIVES,
    PLAYER_INVULNERABILITY_MS,
    PLAYER_KNOCKBACK_X,
    PLAYER_KNOCKBACK_Y,
} from '../constants/gameValues';
import { SCENE_GAME_OVER, SCENE_LEVEL_COMPLETE } from '../constants/sceneKeys';
import { CharacterConfig, findCharacterById, getDefaultCharacter } from '../data/characters';
import { ASSET_KEYS } from '../constants/assetKeys';
import {
    LEVEL_ONE_COLLECTIBLE_TARGET_COUNT,
    LEVEL_ONE_LAYER_NAMES,
    LEVEL_ONE_TILESET_NAME,
} from '../constants/tiledLevel';
import {
    LevelMapValidationError,
    TiledMapLike,
    ValidatedLevelMapData,
    LevelRect,
    validateAndExtractLevelMapData,
} from '../level/tiledLevelValidation';
import { Enemy, EnemySpawnConfig } from '../entities/Enemy';
import {
    PlayerGameplayState,
    applyLifeLoss,
    buildRespawnResetState,
    chooseSafeRespawn,
    classifyEnemyCollision,
    resolveInvulnerabilityState,
    startInvulnerability,
    RespawnCandidate,
} from '../system/stage7Gameplay';
import { applyCollectiblePickup } from '../system/stage8Gameplay';
import { recordLevelResult } from '../system/SaveSystem';
import { PRESENTATION_ANIMATION_KEYS } from '../constants/presentationAnimationKeys';
import { CHARACTER_SOURCE_SIZE, CHARACTER_VISUALS } from '../assets/characterVisualConfig';
import {
    BACKGROUND_LAYERS,
    ENVIRONMENT_VISUALS,
    resolveTerrainVisual,
    shouldShowDebugUi,
    TerrainVisualType,
} from '../assets/environmentVisualConfig';
import { GAMEPLAY_VISUALS, PROP_VISUALS } from '../assets/gameplayVisualConfig';
import { RENDER_DEPTHS } from '../constants/renderDepths';

type SpriteWithBody = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
type StaticSpriteWithBody = Phaser.Types.Physics.Arcade.SpriteWithStaticBody;
type DynamicBody = Phaser.Physics.Arcade.Body;

type TileLayerName =
    | (typeof LEVEL_ONE_LAYER_NAMES)['background']
    | (typeof LEVEL_ONE_LAYER_NAMES)['ground']
    | (typeof LEVEL_ONE_LAYER_NAMES)['platforms']
    | (typeof LEVEL_ONE_LAYER_NAMES)['decorationBehind']
    | (typeof LEVEL_ONE_LAYER_NAMES)['decorationFront']
    | (typeof LEVEL_ONE_LAYER_NAMES)['collision'];

interface CheckpointMarker {
    id: string;
    x: number;
    y: number;
    sprite: StaticSpriteWithBody;
    activated: boolean;
}

interface CollectibleSpawnPoint {
    id: string;
    x: number;
    y: number;
}

const TILED_WORLD_BOTTOM_PADDING = 1200;
const FALLBACK_WORLD_BOUNDS_Y = -200;
const FALLBACK_WORLD_BOUNDS_EXTRA_HEIGHT = 2200;
const PLAYER_RESPAWN_CLEARANCE_Y = 8;
const LEVEL_ONE_ID = 'level-1';
const COLLECTIBLE_POINTS = 100;
const ENEMY_STOMP_POINTS = 50;
const LEVEL_CLEAR_LIFE_BONUS = 25;
const CHECKPOINT_BODY_WIDTH = 18;
const CHECKPOINT_BODY_HEIGHT = 40;
const COLLECTIBLE_BODY_SIZE = 20;
const COLLECTIBLE_DISPLAY_SIZE = 24;
const RUN_DUST_INTERVAL_MS = 130;
const CAMERA_DEADZONE_WIDTH_RATIO = 0.18;
const CAMERA_DEADZONE_HEIGHT_RATIO = 0.1;
const CAMERA_INTRO_ZOOM = 1.02;
const GOAL_CELEBRATION_ZOOM = 1.05;
const MIN_CAMERA_DEADZONE_SIZE = 1;
const HURT_FLASH_DURATION_MS = 120;
// Keeps composed platform pieces close to native width while avoiding tiny seam fragments.
const MAX_PLATFORM_SEGMENT_SCALE = 1.15;

// ─── Parallax backdrop (art-free depth cue, see art bible §7 first-pass polish) ──
function isCollidableTilemapLayer(
    layer: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer,
): layer is Phaser.Tilemaps.TilemapLayer {
    return 'setCollisionByExclusion' in layer;
}

function normalizeCheckpoint(point: { id: string; x: number; y: number }): RespawnCandidate {
    return {
        id: point.id,
        x: point.x,
        y: point.y - PLAYER_RESPAWN_CLEARANCE_Y,
    };
}

export class LevelOne extends Scene {
    private _input!:     InputController;
    private _mobile!:    MobileControls;
    private _player!:    SpriteWithBody;
    private _character!: CharacterConfig;
    private _spawnX = SPAWN_X;
    private _spawnY = WORLD_HEIGHT - GROUND_HEIGHT - (PLAYER_HEIGHT * PLAYER_SPRITE_SCALE) / 2;
    private _worldWidth = WORLD_WIDTH;
    private _worldHeight = WORLD_HEIGHT;
    private _usingPrototypeFallback = false;

    private _pauseBg!:    Phaser.GameObjects.Image;
    private _pausePanel!: Phaser.GameObjects.Image;
    private _pauseTitle!: Phaser.GameObjects.Text;
    private _pauseHint!:  Phaser.GameObjects.Text;
    private _goalBanner!: Phaser.GameObjects.Text;
    private _livesLabel!: Phaser.GameObjects.Text;
    private _scoreLabel!: Phaser.GameObjects.Text;
    private _collectiblesLabel!: Phaser.GameObjects.Text;

    private _collisionLayer?: Phaser.Tilemaps.TilemapLayer;
    private _killZones: LevelRect[] = [];
    private _enemies: Enemy[] = [];
    private _checkpoints: CheckpointMarker[] = [];
    private _activeCheckpoint?: RespawnCandidate;
    private _goalSprite?: StaticSpriteWithBody;

    private _isPaused  = false;
    private _levelDone = false;
    private _prevJump  = false;
    private _prevPause = false;
    private _lastGroundedTimeMs = -Infinity;
    private _jumpBufferExpiresAtMs = -Infinity;
    private _activeAnimState?: CharacterAnimationState;

    private _playerShadow!: Phaser.GameObjects.Ellipse;
    private _playerBaseScaleX = 1;
    private _playerBaseScaleY = 1;
    private _wasGrounded = true;
    private _squashTween?: Phaser.Tweens.Tween;
    private _runDustAllowedAtMs = 0;

    private _playerState: PlayerGameplayState = 'normal';
    private _lives = PLAYER_INITIAL_LIVES;
    private _invulnerableUntilMs = 0;
    private _score = 0;
    private _collectiblesCollected = 0;
    private _collectiblesTotal = 0;
    private _collectedCollectibleIds = new Set<string>();

    constructor() { super('LevelOne'); }

    init(data: { characterId?: string }): void {
        this._character = (data?.characterId ? findCharacterById(data.characterId) : undefined)
            ?? getDefaultCharacter();
    }

    create(): void {
        this._isPaused  = false;
        this._levelDone = false;
        this._prevJump  = false;
        this._prevPause = false;
        this._lastGroundedTimeMs = -Infinity;
        this._jumpBufferExpiresAtMs = -Infinity;
        this._activeAnimState = undefined;
        this._usingPrototypeFallback = false;
        this._playerState = 'normal';
        this._lives = PLAYER_INITIAL_LIVES;
        this._invulnerableUntilMs = 0;
        this._score = 0;
        this._collectiblesCollected = 0;
        this._collectiblesTotal = 0;
        this._collectedCollectibleIds = new Set<string>();
        this._collisionLayer = undefined;
        this._killZones = [];
        this._enemies = [];
        this._checkpoints = [];
        this._activeCheckpoint = undefined;
        this._goalSprite = undefined;
        this._wasGrounded = true;
        this._squashTween = undefined;
        this._runDustAllowedAtMs = 0;

        this._input  = new InputController();
        this._mobile = new MobileControls(
            this._input,
            this.game.canvas.parentElement ?? document.body,
        );

        this.events.once('shutdown', () => {
            this._input.destroy();
            this._mobile.destroy();
        });

        if (!this.textures.exists(ASSET_KEYS.pixel)) {
            const g = this.add.graphics();
            g.fillStyle(0xffffff).fillRect(0, 0, 1, 1);
            g.generateTexture(ASSET_KEYS.pixel, 1, 1);
            g.destroy();
        }

        if (!this._buildLevelFromTiledMap()) {
            this._buildPrototypeFallbackLevel();
        }

        this._buildParallaxBackdrop();
        this._spawnDecorativeProps();

        const deadzoneWidth = this._calculateDeadzoneDimension(GAME_WIDTH, CAMERA_DEADZONE_WIDTH_RATIO);
        const deadzoneHeight = this._calculateDeadzoneDimension(GAME_HEIGHT, CAMERA_DEADZONE_HEIGHT_RATIO);
        this.cameras.main.setBounds(0, 0, this._worldWidth, this._worldHeight);
        this.cameras.main.setDeadzone(deadzoneWidth, deadzoneHeight);
        this.cameras.main.setZoom(CAMERA_INTRO_ZOOM);
        this.cameras.main.startFollow(
            this._player, false, CAMERA_LERP_X, CAMERA_LERP_Y,
        );
        this.tweens.add({
            targets: this.cameras.main,
            zoom: 1,
            duration: 350,
            ease: 'Sine.easeOut',
        });
        this._playCharacterAnimation('idle');
        this._createPlayerShadow();

        this._buildUI();
        this._refreshLivesUI();
        this._refreshScoreUI();
        this._refreshCollectiblesUI();
    }

    update(_time: number, _delta: number): void {
        this._enemies.forEach((enemy) => enemy.updatePatrol());

        const resolved = resolveInvulnerabilityState({
            lives: this._lives,
            state: this._playerState,
            invulnerableUntilMs: this._invulnerableUntilMs,
        }, this.time.now);

        if (resolved.state !== this._playerState) {
            this._playerState = resolved.state;
            this._invulnerableUntilMs = resolved.invulnerableUntilMs;
            this._player.setAlpha(1);
        }

        if (this._playerState === 'invulnerable') {
            this._player.setAlpha(Math.floor(this.time.now / 80) % 2 === 0 ? 0.45 : 1);
        }

        this._updatePlayerShadow();
        this._updateLandingFeedback();
        this._updateRunDust();

        const state = this._input.getState();
        if (state.pause && !this._prevPause) this._togglePause();
        this._prevPause = state.pause;

        if (this._isPaused || this._levelDone || this._playerState === 'hurt' || this._playerState === 'dead') {
            return;
        }

        if (state.left && !state.right) {
            this._player.setVelocityX(-this._character.movementSpeed);
            this._player.setFlipX(true);
        } else if (state.right && !state.left) {
            this._player.setVelocityX(this._character.movementSpeed);
            this._player.setFlipX(false);
        } else {
            this._player.setVelocityX(0);
        }

        const grounded = this._player.body.blocked.down;
        const now = this.time.now;

        if (grounded) {
            this._lastGroundedTimeMs = now;
        }

        // Jump buffering: a press just before landing is remembered for a
        // short window instead of being dropped. Coyote time: a press just
        // after walking off a ledge still counts as grounded. Together these
        // prevent the strict single-frame "grounded" check from swallowing
        // jump presses, which is what made jumping feel unresponsive/stuck.
        if (state.jump && !this._prevJump) {
            this._jumpBufferExpiresAtMs = now + JUMP_BUFFER_MS;
        }

        const jumpBuffered = now <= this._jumpBufferExpiresAtMs;
        const coyoteTimeActive = now - this._lastGroundedTimeMs <= JUMP_COYOTE_TIME_MS;

        if (jumpBuffered && coyoteTimeActive) {
            this._player.setVelocityY(this._character.jumpVelocity);
            this._playSquashStretch(1.25, 0.78, 90);
            this._jumpBufferExpiresAtMs = -Infinity;
            this._lastGroundedTimeMs = -Infinity;
        }
        this._prevJump = state.jump;
        this._updateMovementAnimation();

        if (this._usingPrototypeFallback && this._player.y > KILL_ZONE_Y) {
            this._applyPlayerDamage(this._player.x);
        }
    }

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

            background.setVisible(false);
            decorationBehind.setVisible(false);
            ground.setVisible(false);
            platforms.setVisible(false);
            collision.setVisible(false);
            decorationFront.setVisible(false);

            this._createTerrainVisuals(map, LEVEL_ONE_LAYER_NAMES.ground, 'ground');
            this._createTerrainVisuals(map, LEVEL_ONE_LAYER_NAMES.platforms, 'platform');

            if (!isCollidableTilemapLayer(collision)) {
                throw new LevelMapValidationError('collision layer does not support arcade collision setup');
            }
            collision.setCollisionByExclusion([-1]);
            this._collisionLayer = collision;

            this._worldWidth = mapData.dimensions.widthPixels;
            this._worldHeight = mapData.dimensions.heightPixels;
            this._spawnX = mapData.playerSpawn.x;
            this._spawnY = mapData.playerSpawn.y;
            this._killZones = mapData.killZones;

            this.physics.world.setBounds(0, 0, this._worldWidth, this._worldHeight + TILED_WORLD_BOTTOM_PADDING);

            const goal = this.physics.add.staticSprite(
                mapData.levelGoal.x + mapData.levelGoal.width / 2,
                mapData.levelGoal.y + mapData.levelGoal.height / 2,
                GAMEPLAY_VISUALS.goal.atlasKey,
                GAMEPLAY_VISUALS.goal.frame,
            );
            goal
                .setDisplaySize(mapData.levelGoal.width, mapData.levelGoal.height)
                .setBodySize(mapData.levelGoal.width, mapData.levelGoal.height, true)
                .refreshBody()
                .play(PRESENTATION_ANIMATION_KEYS.goalIdle, true);
            this._goalSprite = goal;

            this._player = this.physics.add.sprite(
                this._spawnX,
                this._spawnY,
                this._character.assetKey,
                CHARACTER_VISUALS[this._character.id].idleFrame,
            );
            this._configurePlayerVisual();

            this.physics.add.collider(this._player, collision);
            this.physics.add.overlap(this._player, goal, () => {
                if (!this._levelDone) this._completeLevel();
            });

            this._spawnEnemies(mapData.enemySpawns);
            this._spawnCheckpoints(mapData.checkpoints);
            this._spawnCollectibles(this._toCollectibleSpawns(mapData.collectibleSpawns));

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
                if (!this._levelDone) this._applyPlayerDamage(this._player.x);
            });

            if (this._isDebugUiEnabled()) {
                this._drawDevMarkers(mapData);
            }

            return true;
        } catch (error) {
            this._showDevelopmentMapError(error);
            return false;
        }
    }

    private _spawnEnemies(enemySpawns: EnemySpawnConfig[]): void {
        enemySpawns.forEach((enemySpawn, index) => {
            const enemy = new Enemy(this, {
                ...enemySpawn,
                visualVariant: index % 3 === 2 ? 'large' : 'small',
            }, {
                hasGroundAhead: (x, y) => this._hasGroundTileAt(x, y),
            }).spawn();

            this._enemies.push(enemy);
            if (this._collisionLayer) {
                this.physics.add.collider(enemy, this._collisionLayer);
            }
            this.physics.add.collider(this._player, enemy, () => {
                this._onPlayerEnemyCollision(enemy);
            });
        });
    }

    private _spawnCheckpoints(checkpoints: Array<{ id: string; x: number; y: number }>): void {
        for (const checkpointData of checkpoints) {
            const marker = this.physics.add.staticSprite(
                checkpointData.x,
                checkpointData.y - 30,
                GAMEPLAY_VISUALS.checkpoint.atlasKey,
                GAMEPLAY_VISUALS.checkpoint.frame,
            );
            marker
                .setOrigin(0.5, 1)
                .setPosition(checkpointData.x, checkpointData.y)
                .setDisplaySize(GAMEPLAY_VISUALS.checkpoint.displayWidth, GAMEPLAY_VISUALS.checkpoint.displayHeight)
                .setDepth(20)
                .setBodySize(CHECKPOINT_BODY_WIDTH, CHECKPOINT_BODY_HEIGHT, true)
                .refreshBody()
                .play(PRESENTATION_ANIMATION_KEYS.checkpointIdle, true);
            const checkpoint: CheckpointMarker = {
                id: checkpointData.id,
                x: checkpointData.x,
                y: checkpointData.y,
                sprite: marker,
                activated: false,
            };
            this._checkpoints.push(checkpoint);
            this.physics.add.overlap(this._player, marker, () => {
                this._activateCheckpoint(checkpoint);
            });
        }
    }

    private _activateCheckpoint(checkpoint: CheckpointMarker): void {
        if (checkpoint.activated && this._activeCheckpoint?.id === checkpoint.id) {
            return;
        }

        for (const cp of this._checkpoints) {
            cp.activated = cp.id === checkpoint.id;
            cp.sprite.play(
                cp.activated
                    ? PRESENTATION_ANIMATION_KEYS.checkpointActive
                    : PRESENTATION_ANIMATION_KEYS.checkpointIdle,
                true,
            );
        }

        this._activeCheckpoint = normalizeCheckpoint(checkpoint);
    }

    private _onPlayerEnemyCollision(enemy: Enemy): void {
        if (!enemy.isAlive() || this._playerState === 'dead' || this._playerState === 'celebrating') {
            return;
        }

        const playerBody = this._player.body as DynamicBody;
        const enemyBody = enemy.body as DynamicBody;

        const outcome = classifyEnemyCollision({
            playerBottom: playerBody.bottom,
            playerVelocityY: playerBody.velocity.y,
            playerWasAboveEnemy: playerBody.bottom <= enemyBody.top + 4,
            enemyTop: enemyBody.top,
            playerTouchingDown: playerBody.touching.down,
        });

        if (outcome === 'stomp') {
            enemy.defeat();
            this._player.setVelocityY(this._character.jumpVelocity * 0.7);
            this._score += ENEMY_STOMP_POINTS;
            this._refreshScoreUI();
            this._spawnDustPuff(enemy.x, enemyBody.top);
            return;
        }

        this._applyPlayerDamage(enemy.x);
    }

    private _applyPlayerDamage(enemyX: number): void {
        const result = applyLifeLoss({
            lives: this._lives,
            state: this._playerState,
            invulnerableUntilMs: this._invulnerableUntilMs,
        });

        if (!result.applied) {
            return;
        }

        this._lives = result.lives;
        this._playerState = result.nextState;
        this._refreshLivesUI();

        if (this._playerState === 'dead') {
            this._input.resetAll();
            this._player.setVelocity(0, 0);
            this._player.body.moves = false;
            this._playCharacterAnimation('hurt');
            this.time.delayedCall(300, () => {
                this.scene.start(SCENE_GAME_OVER, {
                    reason: 'All lives lost',
                    lives: this._lives,
                    score: this._score,
                    collectibleCount: this._collectiblesCollected,
                    totalCollectibles: this._collectiblesTotal,
                    characterId: this._character.id,
                });
            });
            return;
        }

        this._input.resetAll();
        this._prevJump = false;
        this._jumpBufferExpiresAtMs = -Infinity;
        this._playerState = 'hurt';
        this._playCharacterAnimation('hurt');
        this._playHurtFeedback();

        const direction = this._player.x < enemyX ? -1 : 1;
        this._applySafeKnockback(direction);

        this.time.delayedCall(HURT_RECOVERY_DELAY_MS, () => {
            this._respawn();
        });
    }

    private _applySafeKnockback(direction: 1 | -1): void {
        const targetX = this._player.x + direction * 20;
        const safeX = this._findNearestSafeHorizontalPosition(targetX, direction);
        this._player.setPosition(safeX, this._player.y - 2);
        this._player.setVelocity(direction * PLAYER_KNOCKBACK_X, PLAYER_KNOCKBACK_Y);
    }

    private _findNearestSafeHorizontalPosition(targetX: number, direction: 1 | -1): number {
        let safeX = this._player.x;
        const end = targetX;
        const step = direction * 4;

        for (let probe = this._player.x; direction > 0 ? probe <= end : probe >= end; probe += step) {
            if (this._wouldSpawnInsideWall(probe, this._player.y)) {
                break;
            }
            safeX = probe;
        }

        return safeX;
    }

    private _respawn(): void {
        const spawnCandidates = this._buildRespawnCandidates();
        const safeRespawn = chooseSafeRespawn(spawnCandidates, (candidate) => this._isRespawnCandidateSafe(candidate));
        const fallbackRespawn = spawnCandidates[spawnCandidates.length - 1];
        const selected = safeRespawn ?? fallbackRespawn;

        const nextInvulnerableUntil = startInvulnerability(this.time.now, PLAYER_INVULNERABILITY_MS);
        const nextRuntime = buildRespawnResetState({
            lives: this._lives,
            state: this._playerState,
            invulnerableUntilMs: this._invulnerableUntilMs,
        }, nextInvulnerableUntil);

        this._playerState = nextRuntime.state;
        this._invulnerableUntilMs = nextRuntime.invulnerableUntilMs;

        this._player.setPosition(selected.x, selected.y);
        this._player.setVelocity(0, 0);
        this._player.setAlpha(1);
        this._input.resetAll();
        this._prevJump = false;
        this._jumpBufferExpiresAtMs = -Infinity;
        this._player.body.moves = true;
        this._playCharacterAnimation('idle');
    }

    private _buildRespawnCandidates(): RespawnCandidate[] {
        const candidates: RespawnCandidate[] = [];

        if (this._activeCheckpoint) {
            candidates.push(this._activeCheckpoint);
        }

        candidates.push({ id: 'initial-spawn', x: this._spawnX, y: this._spawnY });

        if (!this._activeCheckpoint) {
            return candidates;
        }

        for (const offsetX of [-64, -32, 32, 64, -96, 96]) {
            candidates.push({
                id: `checkpoint-offset-${offsetX}`,
                x: this._activeCheckpoint.x + offsetX,
                y: this._activeCheckpoint.y,
            });
        }

        return candidates;
    }

    private _isRespawnCandidateSafe(candidate: RespawnCandidate): boolean {
        if (this._isInsideKillZone(candidate.x, candidate.y)) {
            return false;
        }

        if (this._wouldSpawnInsideWall(candidate.x, candidate.y)) {
            return false;
        }

        if (this._isInsideEnemy(candidate.x, candidate.y)) {
            return false;
        }

        return true;
    }

    private _isInsideKillZone(x: number, y: number): boolean {
        return this._killZones.some((zone) => {
            const withinX = x >= zone.x && x <= zone.x + zone.width;
            const withinY = y >= zone.y && y <= zone.y + zone.height;
            return withinX && withinY;
        });
    }

    private _isInsideEnemy(x: number, y: number): boolean {
        return this._enemies.some((enemy) => {
            if (!enemy.isAlive()) {
                return false;
            }
            const body = enemy.body as DynamicBody;
            return x >= body.left && x <= body.right && y >= body.top && y <= body.bottom;
        });
    }

    private _wouldSpawnInsideWall(x: number, y: number): boolean {
        if (!this._collisionLayer) {
            return false;
        }

        const halfW = this._character.collisionWidth / 2;
        const height = this._character.collisionHeight;

        const probes: Array<[number, number]> = [
            [x - halfW + 2, y - height + 2],
            [x + halfW - 2, y - height + 2],
            [x - halfW + 2, y - 2],
            [x + halfW - 2, y - 2],
            [x, y - height / 2],
        ];

        return probes.some(([px, py]) => this._hasGroundTileAt(px, py));
    }

    private _hasGroundTileAt(x: number, y: number): boolean {
        if (!this._collisionLayer) {
            return y >= this._worldHeight - GROUND_HEIGHT;
        }

        const tile = this._collisionLayer.getTileAtWorldXY(x, y, true);
        return tile !== null && tile.index !== -1;
    }

    private _refreshLivesUI(): void {
        this._livesLabel?.setText(`Lives: ${this._lives}`);
    }

    private _refreshScoreUI(): void {
        this._scoreLabel?.setText(`Score: ${this._score}`);
    }

    private _refreshCollectiblesUI(): void {
        this._collectiblesLabel?.setText(`Collectibles: ${this._collectiblesCollected}/${this._collectiblesTotal}`);
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
    ): Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer {
        const layer = map.createLayer(layerName, tileset, 0, 0);
        if (!layer) {
            throw new LevelMapValidationError(`unable to create required layer "${layerName}"`);
        }
        return layer;
    }

    private _createTerrainVisuals(
        map: Phaser.Tilemaps.Tilemap,
        layerName: TileLayerName,
        type: TerrainVisualType,
    ): void {
        const layer = map.getLayer(layerName);
        if (!layer) {
            return;
        }

        const isOccupied = (x: number, y: number): boolean => {
            const tile = layer.data[y]?.[x];
            return tile !== undefined && tile.index >= 0;
        };

        for (let y = 0; y < layer.height; y += 1) {
            let x = 0;
            while (x < layer.width) {
                const isTopSurface = isOccupied(x, y) && !isOccupied(x, y - 1);
                if (!isTopSurface) {
                    x += 1;
                    continue;
                }

                const startX = x;
                while (
                    x < layer.width
                    && isOccupied(x, y)
                    && !isOccupied(x, y - 1)
                ) {
                    x += 1;
                }

                const width = (x - startX) * map.tileWidth;
                const worldX = startX * map.tileWidth;
                const worldY = y * map.tileHeight;

                if (type === 'ground') {
                    let rows = 1;
                    while (isOccupied(startX, y + rows)) {
                        rows += 1;
                    }
                    this._createGroundVisual(worldX, worldY, width, rows * map.tileHeight);
                } else {
                    this._createPlatformVisual(worldX, worldY, width);
                }
            }
        }
    }

    private _createGroundVisual(x: number, y: number, width: number, height: number): void {
        const mapping = this._getAvailableTerrainVisual('ground');
        if (!mapping) {
            return;
        }

        const frame = this.textures.getFrame(ENVIRONMENT_VISUALS.atlasKey, mapping.frame);
        const displayHeight = Math.max(1, height);
        const tileScale = displayHeight / frame.height;
        this.add.tileSprite(
            x + mapping.visualOffsetX,
            y + mapping.visualOffsetY,
            Math.max(mapping.minimumWidth, width),
            displayHeight,
            ENVIRONMENT_VISUALS.atlasKey,
            mapping.frame,
        )
            .setOrigin(mapping.originX, mapping.originY)
            .setTileScale(tileScale, tileScale)
            .setDepth(mapping.depth);
    }

    private _createPlatformVisual(x: number, y: number, width: number): void {
        const mapping = this._getAvailableTerrainVisual('platform');
        if (!mapping) {
            return;
        }

        const frame = this.textures.getFrame(ENVIRONMENT_VISUALS.atlasKey, mapping.frame);
        const segmentCount = Math.max(1, Math.ceil(width / (frame.width * MAX_PLATFORM_SEGMENT_SCALE)));
        const segmentWidth = width / segmentCount;

        for (let segment = 0; segment < segmentCount; segment += 1) {
            this.add.image(
                x + segmentWidth * (segment + 0.5) + mapping.visualOffsetX,
                y + mapping.visualOffsetY,
                ENVIRONMENT_VISUALS.atlasKey,
                mapping.frame,
            )
                .setOrigin(mapping.originX, mapping.originY)
                .setDisplaySize(segmentWidth, frame.height)
                .setDepth(mapping.depth);
        }
    }

    private _getAvailableTerrainVisual(type: TerrainVisualType) {
        const mapping = resolveTerrainVisual(type);
        if (
            mapping
            && this.textures.exists(ENVIRONMENT_VISUALS.atlasKey)
            && this.textures.get(ENVIRONMENT_VISUALS.atlasKey).has(mapping.frame)
        ) {
            return mapping;
        }

        if (import.meta.env.DEV) {
            console.warn(`[environment] Missing terrain visual mapping for "${type}"`);
        }
        return undefined;
    }

    private _isDebugUiEnabled(): boolean {
        const enabledByEnvironment = import.meta.env.VITE_DEBUG_UI === 'true';
        const enabledByRegistry = this.registry.get('debugUi') === true;
        return shouldShowDebugUi(import.meta.env.DEV, enabledByEnvironment || enabledByRegistry);
    }

    private _showDevelopmentMapError(error: unknown): void {
        const msg = error instanceof Error ? error.message : 'Unknown map validation error';
        if (import.meta.env.DEV) {
            console.error(msg, error);
        }

        if (this._isDebugUiEnabled()) {
            this.add.text(16, 48, `Level map fallback active\n${msg}`, {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#ff6b6b',
                backgroundColor: '#2b0f0f',
                padding: { x: 6, y: 4 },
            }).setScrollFactor(0).setDepth(RENDER_DEPTHS.orientationWarning);
        }
    }

    private _drawDevMarkers(mapData: ValidatedLevelMapData): void {
        for (const point of mapData.enemySpawns) {
            this.add.circle(point.x, point.y, 10, 0xe74c3c, 0.5).setDepth(RENDER_DEPTHS.collisionDebug);
            this.add.line(
                point.x,
                point.y - 28,
                point.patrolLeft - point.x,
                0,
                point.patrolRight - point.x,
                0,
                0x8e44ad,
                0.8,
            ).setDepth(RENDER_DEPTHS.collisionDebug);
        }

        for (const point of mapData.checkpoints) {
            this.add.rectangle(point.x, point.y - 24, 16, 32, 0x3498db, 0.5)
                .setDepth(RENDER_DEPTHS.collisionDebug);
        }
    }

    private _spawnCollectibles(spawns: CollectibleSpawnPoint[]): void {
        this._collectiblesTotal = spawns.length;
        this._refreshCollectiblesUI();

        const collectibles = this.physics.add.staticGroup();

        for (const spawn of spawns) {
            const collectible = this.physics.add.staticSprite(
                spawn.x,
                spawn.y,
                GAMEPLAY_VISUALS.collectible.atlasKey,
                GAMEPLAY_VISUALS.collectible.frame,
            );
            collectible
                .setDisplaySize(GAMEPLAY_VISUALS.collectible.displaySize, GAMEPLAY_VISUALS.collectible.displaySize)
                .setData('collectibleId', spawn.id)
                .setBodySize(COLLECTIBLE_BODY_SIZE, COLLECTIBLE_BODY_SIZE, true)
                .refreshBody()
                .play(PRESENTATION_ANIMATION_KEYS.collectiblePulse, true);
            collectibles.add(collectible, true);
        }

        this.physics.add.overlap(this._player, collectibles, (_playerSprite, collectibleBody) => {
            const collectible = collectibleBody as StaticSpriteWithBody;
            const collectibleId = collectible.getData('collectibleId');
            if (typeof collectibleId !== 'string') {
                return;
            }

            const pickupResult = applyCollectiblePickup(
                this._collectedCollectibleIds,
                collectibleId,
                this._collectiblesCollected,
                this._score,
                COLLECTIBLE_POINTS,
            );

            if (!pickupResult.collected) {
                return;
            }

            this._collectedCollectibleIds = pickupResult.collectedIds;
            this._collectiblesCollected = pickupResult.collectedCount;
            this._score = pickupResult.score;
            this._playCollectiblePickupFeedback(collectible);
            collectible.disableBody(true, true);
            this._refreshCollectiblesUI();
            this._refreshScoreUI();
        });
    }

    private _toCollectibleSpawns(points: Array<{ x: number; y: number }>): CollectibleSpawnPoint[] {
        return points.slice(0, LEVEL_ONE_COLLECTIBLE_TARGET_COUNT).map((point, index) => ({
            id: `map-collectible-${index}`,
            x: point.x,
            y: point.y,
        }));
    }

    private _buildPrototypeFallbackLevel(): void {
        this._spawnX = SPAWN_X;
        this._spawnY = WORLD_HEIGHT - GROUND_HEIGHT - (PLAYER_HEIGHT * PLAYER_SPRITE_SCALE) / 2;
        this._worldWidth = WORLD_WIDTH;
        this._worldHeight = WORLD_HEIGHT;
        this._usingPrototypeFallback = true;
        this._killZones = [{ x: 0, y: KILL_ZONE_Y, width: WORLD_WIDTH, height: WORLD_HEIGHT }];

        this.physics.world.setBounds(0, FALLBACK_WORLD_BOUNDS_Y, WORLD_WIDTH, WORLD_HEIGHT + FALLBACK_WORLD_BOUNDS_EXTRA_HEIGHT);

        const ground = this.physics.add.staticImage(
            GROUND_WIDTH / 2,
            GROUND_Y,
            ASSET_KEYS.pixel,
        );
        ground.setDisplaySize(GROUND_WIDTH, GROUND_HEIGHT)
            .setVisible(false)
            .refreshBody();
        this._createGroundVisual(0, GROUND_Y - GROUND_HEIGHT / 2, GROUND_WIDTH, GROUND_HEIGHT);

        const platforms = this.physics.add.staticGroup();
        platforms.add(ground, true);

        for (const [cx, cy, w] of PLATFORMS) {
            const p = this.physics.add.staticImage(
                cx,
                cy,
                ASSET_KEYS.pixel,
            );
            p.setDisplaySize(w, PLATFORM_HEIGHT).setVisible(false).refreshBody();
            platforms.add(p, true);
            this._createPlatformVisual(cx - w / 2, cy - PLATFORM_HEIGHT / 2, w);
        }

        const goal = this.physics.add.staticSprite(
            GOAL_X,
            GOAL_Y,
            GAMEPLAY_VISUALS.goal.atlasKey,
            GAMEPLAY_VISUALS.goal.frame,
        );
        goal.setDisplaySize(GOAL_WIDTH, GOAL_HEIGHT)
            .setBodySize(GOAL_WIDTH, GOAL_HEIGHT, true)
            .refreshBody()
            .play(PRESENTATION_ANIMATION_KEYS.goalIdle, true);
        this._goalSprite = goal;

        this._player = this.physics.add.sprite(
            this._spawnX,
            this._spawnY,
            this._character.assetKey,
            CHARACTER_VISUALS[this._character.id].idleFrame,
        );
        this._configurePlayerVisual();

        this.physics.add.collider(this._player, platforms);
        this.physics.add.overlap(this._player, goal, () => {
            if (!this._levelDone) this._completeLevel();
        });

        this._spawnEnemies([
            {
                x: 1180,
                y: this._spawnY,
                patrolLeft: 1080,
                patrolRight: 1320,
                patrolSpeed: 90,
                avoidLedges: true,
            },
        ]);

        this._spawnCheckpoints([
            { id: 'fallback-checkpoint-1', x: 1180, y: this._spawnY },
        ]);

        this._spawnCollectibles([
            { id: 'fallback-collectible-1', x: 760, y: 320 },
            { id: 'fallback-collectible-2', x: 1460, y: 260 },
            { id: 'fallback-collectible-3', x: 2440, y: 220 },
        ]);
    }

    private _configurePlayerVisual(): void {
        const visual = CHARACTER_VISUALS[this._character.id];
        const displayWidth = visual.displayHeight
            * (CHARACTER_SOURCE_SIZE.width / CHARACTER_SOURCE_SIZE.height);
        this._player
            .setOrigin(visual.originX, visual.originY)
            .setDisplaySize(displayWidth, visual.displayHeight)
            .setCollideWorldBounds(true)
            .setDepth(RENDER_DEPTHS.player);

        const body = this._player.body as DynamicBody;
        const scaleX = Math.abs(this._player.scaleX) || 1;
        const scaleY = Math.abs(this._player.scaleY) || 1;
        const bodyWidth = this._character.collisionWidth / scaleX;
        const bodyHeight = this._character.collisionHeight / scaleY;
        body.setSize(bodyWidth, bodyHeight);
        body.setOffset(
            (this._player.width - bodyWidth) / 2,
            this._player.height - bodyHeight,
        );
    }

    private _spawnDecorativeProps(): void {
        const groundY = this._usingPrototypeFallback
            ? this._worldHeight - GROUND_HEIGHT
            : this._worldHeight - 64;

        for (const prop of PROP_VISUALS) {
            this.add.image(
                this._worldWidth * prop.xRatio,
                groundY + prop.yOffset,
                GAMEPLAY_VISUALS.goal.atlasKey,
                prop.frame,
            ).setOrigin(0.5, 1).setDepth(prop.depth);
        }
    }

    private _togglePause(): void {
        this._isPaused = !this._isPaused;
        this._input.resetAll();
        this._prevJump = false;
        this._jumpBufferExpiresAtMs = -Infinity;

        if (this._isPaused) {
            this.physics.pause();
        } else {
            this.physics.resume();
        }

        this._pauseBg.setVisible(this._isPaused);
        this._pausePanel.setVisible(this._isPaused);
        this._pauseTitle.setVisible(this._isPaused);
        this._pauseHint.setVisible(this._isPaused);
    }

    private _completeLevel(): void {
        this._levelDone = true;
        this._playerState = 'celebrating';
        this._input.resetAll();
        this._player.setVelocity(0, 0);
        this._player.body.moves = false;
        this._playCharacterAnimation('celebrate');
        this._goalBanner.setVisible(true);
        this._playGoalCelebrationFeedback();
        this._score += this._lives * LEVEL_CLEAR_LIFE_BONUS;
        this._refreshScoreUI();

        const saved = recordLevelResult({
            levelId: LEVEL_ONE_ID,
            score: this._score,
            collectibleCount: this._collectiblesCollected,
            unlockedLevel: 2,
        });

        this.time.delayedCall(CELEBRATION_EXIT_DELAY_MS, () => {
            this.scene.start(SCENE_LEVEL_COMPLETE, {
                characterId: this._character.id,
                levelId: LEVEL_ONE_ID,
                score: this._score,
                collectibleCount: this._collectiblesCollected,
                totalCollectibles: this._collectiblesTotal,
                bestScore: saved.bestScores[LEVEL_ONE_ID] ?? 0,
                bestCollectibleCount: saved.bestCollectibleCounts[LEVEL_ONE_ID] ?? 0,
            });
        });
    }

    private _buildParallaxBackdrop(): void {
        for (const layer of BACKGROUND_LAYERS) {
            const frame = this.textures.getFrame(ENVIRONMENT_VISUALS.atlasKey, layer.frame);
            if (!frame) {
                if (import.meta.env.DEV) {
                    console.warn(`[environment] Missing background frame "${layer.frame}"`);
                }
                continue;
            }

            const displayHeight = Math.ceil(GAME_HEIGHT * layer.heightRatio);
            const tileScale = displayHeight / frame.height;
            const y = Math.round(GAME_HEIGHT * layer.bottomRatio - displayHeight);
            this.add.tileSprite(
                -GAME_WIDTH,
                y,
                this._worldWidth + GAME_WIDTH * 2,
                displayHeight,
                ENVIRONMENT_VISUALS.atlasKey,
                layer.frame,
            )
                .setOrigin(0)
                .setTileScale(tileScale, tileScale)
                .setDepth(layer.depth)
                .setScrollFactor(layer.scrollFactor, 0);
        }
    }

    private _buildUI(): void {
        const depth = RENDER_DEPTHS.hud;
        const cx    = GAME_WIDTH / 2;
        const cy    = GAME_HEIGHT / 2;

        this._pauseBg = this.add
            .image(cx, cy, ASSET_KEYS.uiOverlay)
            .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
            .setScrollFactor(0).setDepth(depth).setVisible(false);

        this._pausePanel = this.add
            .image(cx, cy, ASSET_KEYS.uiPanel)
            .setDisplaySize(360, 160)
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

        this._goalBanner = this.add
            .text(cx, cy, '🎉  Level Complete!', {
                fontFamily: 'Arial Black',
                fontSize:   '42px',
                color:      '#f1c40f',
                stroke:     '#000000',
                strokeThickness: 6,
            })
            .setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1).setVisible(false);

        this.add.rectangle(104, 38, 192, 60, 0x111a2b, 0.76)
            .setStrokeStyle(1, 0xffffff, 0.18)
            .setScrollFactor(0)
            .setDepth(depth - 1);

        this._livesLabel = this.add
            .text(12, 12, `Lives: ${this._lives}`, {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#ffdf8a',
            })
            .setScrollFactor(0).setDepth(depth);

        this._scoreLabel = this.add
            .text(12, 30, `Score: ${this._score}`, {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#9ee6ff',
            })
            .setScrollFactor(0).setDepth(depth);

        this._collectiblesLabel = this.add
            .text(12, 48, `Collectibles: ${this._collectiblesCollected}/${this._collectiblesTotal}`, {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#f6de8f',
            })
            .setScrollFactor(0).setDepth(depth);

        if (this._isDebugUiEnabled()) {
            this.add.rectangle(112, 96, 208, 34, 0x0f2918, 0.88)
                .setStrokeStyle(2, 0x2cff65)
                .setScrollFactor(0)
                .setDepth(depth - 1);
            this.add.text(12, 84, `gravity ${GRAVITY} px/s² · ${this._character.displayName}`, {
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#8dffad',
            }).setScrollFactor(0).setDepth(depth);
        }

        this.add
            .text(GAME_WIDTH - 12, 10, 'Esc / P = pause', {
                fontFamily: 'monospace',
                fontSize:   '12px',
                color:      '#ffffff88',
                align:      'right',
            })
            .setOrigin(1, 0).setScrollFactor(0).setDepth(depth);
    }

    /** Creates the soft ground-contact shadow used to ground the player visually. */
    private _createPlayerShadow(): void {
        this._playerBaseScaleX = this._player.scaleX;
        this._playerBaseScaleY = this._player.scaleY;
        this._playerShadow = this.add
            .ellipse(this._player.x, this._player.y, this._player.displayWidth * 0.55, 10, 0x000000, 0.28)
            .setDepth((this._player.depth ?? 0) - 1);
    }

    /**
     * Projects a soft shadow ellipse from the player down onto the nearest
     * ground/platform surface, shrinking and fading it the higher the
     * player is above that surface. This is the cheapest available fix for
     * placeholder characters looking like "floating squares".
     */
    private _updatePlayerShadow(): void {
        if (!this._playerShadow) {
            return;
        }

        const body = this._player.body as DynamicBody;
        const feetY = body.bottom;
        const grounded = body.blocked.down || body.touching.down;
        // Fast path: while grounded the shadow sits directly under the feet,
        // so there is no need to scan for the nearest surface below. The
        // (bounded) downward scan only runs while the player is airborne,
        // which is a small fraction of total frames.
        const groundY = grounded ? feetY : this._findGroundYBelow(this._player.x, feetY);
        const clearance = Math.max(0, groundY - feetY);
        const maxClearance = 220;
        const proximity = 1 - Math.min(clearance, maxClearance) / maxClearance;

        this._playerShadow.setPosition(this._player.x, groundY);
        this._playerShadow.setScale(0.6 + proximity * 0.4);
        this._playerShadow.setAlpha(0.12 + proximity * 0.2);
    }

    /** Scans downward in fixed steps to find the nearest ground/platform surface below (x, startY). */
    private _findGroundYBelow(x: number, startY: number): number {
        const step = 8;
        const maxDistance = 240;

        for (let distance = 0; distance <= maxDistance; distance += step) {
            const probeY = startY + distance;
            if (this._hasGroundTileAt(x, probeY)) {
                return probeY;
            }
        }

        return startY + maxDistance;
    }

    /**
     * Detects grounded/airborne transitions to trigger a landing squash and
     * a small dust puff — cheap "juice" that reads as polish independent of
     * final art. Guarded by the `!this._wasGrounded` edge check so it only
     * fires once per landing rather than every frame the player stays
     * grounded, even if `blocked.down`/`touching.down` flicker briefly on
     * uneven terrain.
     */
    private _updateLandingFeedback(): void {
        const body = this._player.body as DynamicBody;
        const grounded = body.blocked.down || body.touching.down;

        if (grounded && !this._wasGrounded) {
            this._playSquashStretch(0.8, 1.2, 110);
            this._spawnDustPuff(this._player.x, body.bottom);
        }

        this._wasGrounded = grounded;
    }

    /** Briefly scales the player away from its base scale, then eases back — classic squash & stretch. */
    private _playSquashStretch(scaleXFactor: number, scaleYFactor: number, durationMs: number): void {
        this._squashTween?.stop();
        this._player.setScale(
            this._playerBaseScaleX * scaleXFactor,
            this._playerBaseScaleY * scaleYFactor,
        );
        this._squashTween = this.tweens.add({
            targets: this._player,
            scaleX: this._playerBaseScaleX,
            scaleY: this._playerBaseScaleY,
            duration: durationMs,
            ease: 'Sine.easeOut',
        });
    }

    /** Spawns a handful of small fading/expanding circles at the player's feet on landing. */
    private _spawnDustPuff(x: number, y: number): void {
        const puffCount = 4;
        for (let i = 0; i < puffCount; i += 1) {
            // Spread the puffs across a 144° arc (0.8 * pi) centered on
            // straight-down (pi radians), so they fan out low and to the
            // sides of the player's feet rather than in a single column.
            const angle = Math.PI + (i / Math.max(1, puffCount - 1) - 0.5) * Math.PI * 0.8;
            const puff = this.add
                .circle(x, y, 4, 0xf3ead2, 0.55)
                .setDepth((this._player.depth ?? 0) - 1);

            this.tweens.add({
                targets: puff,
                x: x + Math.cos(angle) * 18,
                y: y + Math.sin(angle) * 8,
                scale: 2.2,
                alpha: 0,
                duration: 280,
                ease: 'Sine.easeOut',
                onComplete: () => puff.destroy(),
            });
        }
    }

    private _updateRunDust(): void {
        const body = this._player.body as DynamicBody;
        const speedX = Math.abs(body.velocity.x);
        const grounded = body.blocked.down || body.touching.down;
        if (!this._shouldSpawnRunDust(grounded, speedX)) {
            return;
        }

        this._runDustAllowedAtMs = this.time.now + RUN_DUST_INTERVAL_MS;
        const directionOffset = this._player.flipX ? 8 : -8;
        this._spawnDustPuff(this._player.x + directionOffset, body.bottom - 1);
    }

    private _shouldSpawnRunDust(grounded: boolean, speedX: number): boolean {
        if (!grounded) {
            return false;
        }
        if (speedX <= PLAYER_RUN_ANIMATION_THRESHOLD) {
            return false;
        }
        return this.time.now >= this._runDustAllowedAtMs;
    }

    private _playHurtFeedback(): void {
        this.cameras.main.shake(90, 0.004);
        this.cameras.main.flash(90, 255, 100, 100, false);
        this._player.setTint(0xffd4d4);
        this.time.delayedCall(HURT_FLASH_DURATION_MS, () => {
            this._player.clearTint();
        });
    }

    private _playCollectiblePickupFeedback(collectible: StaticSpriteWithBody): void {
        const glow = this.add.sprite(
            collectible.x,
            collectible.y,
            GAMEPLAY_VISUALS.collectible.atlasKey,
            GAMEPLAY_VISUALS.collectible.frame,
        )
            .setDisplaySize(COLLECTIBLE_DISPLAY_SIZE, COLLECTIBLE_DISPLAY_SIZE)
            .setDepth((this._player.depth ?? 0) + 1);
        this.tweens.add({
            targets: glow,
            y: glow.y - 14,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 200,
            ease: 'Sine.easeOut',
            onComplete: () => glow.destroy(),
        });
    }

    private _playGoalCelebrationFeedback(): void {
        this.cameras.main.shake(180, 0.005);
        this.tweens.add({
            targets: this.cameras.main,
            zoom: GOAL_CELEBRATION_ZOOM,
            yoyo: true,
            duration: 420,
            ease: 'Sine.easeInOut',
        });
        if (this._goalSprite) {
            this.tweens.add({
                targets: this._goalSprite,
                scaleX: this._goalSprite.scaleX * 1.08,
                scaleY: this._goalSprite.scaleY * 1.08,
                yoyo: true,
                repeat: 3,
                duration: 180,
            });
        }
        this._spawnDustPuff(this._player.x, (this._player.body as DynamicBody).bottom);
    }

    private _calculateDeadzoneDimension(dimension: number, ratio: number): number {
        return PhaserMath.Clamp(
            dimension * ratio,
            MIN_CAMERA_DEADZONE_SIZE,
            dimension,
        );
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
