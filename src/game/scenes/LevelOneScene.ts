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

type SpriteWithBody = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
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
    sprite: Phaser.GameObjects.Rectangle;
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

// ─── Parallax backdrop (art-free depth cue, see art bible §7 first-pass polish) ──
const SKY_TOP_COLOR = 0xbfe3f7;
const SKY_HORIZON_COLOR = 0xeaf6ff;
const HORIZON_Y_RATIO = 0.62;
interface HillRowConfig {
    yOffset: number;
    bumpWidth: number;
    bumpHeight: number;
    color: number;
    alpha: number;
    depth: number;
    scrollFactor: number;
}

const HILL_FAR_CONFIG: HillRowConfig = { yOffset: 10, bumpWidth: 220, bumpHeight: 60, color: 0x9fd6c6, alpha: 0.45, depth: -60, scrollFactor: 0.25 };
const HILL_NEAR_CONFIG: HillRowConfig = { yOffset: 30, bumpWidth: 260, bumpHeight: 80, color: 0x7dc9a0, alpha: 0.65, depth: -40, scrollFactor: 0.5 };
const SKY_DEPTH = -90;
const SKY_SCROLL_FACTOR = 0.02;

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

    private _pauseBg!:    Phaser.GameObjects.Rectangle;
    private _pausePanel!: Phaser.GameObjects.Rectangle;
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

    private _isPaused  = false;
    private _levelDone = false;
    private _prevJump  = false;
    private _prevPause = false;
    private _activeAnimState?: CharacterAnimationState;

    private _playerShadow!: Phaser.GameObjects.Ellipse;
    private _playerBaseScaleX = 1;
    private _playerBaseScaleY = 1;
    private _wasGrounded = true;
    private _squashTween?: Phaser.Tweens.Tween;

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
        this._wasGrounded = true;
        this._squashTween = undefined;

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

        ensureCharacterFallbackTextures(this, new Set<string>());
        registerCharacterAnimations(this.anims);

        if (!this._buildLevelFromTiledMap()) {
            this._buildPrototypeFallbackLevel();
        }

        this._buildParallaxBackdrop();

        this.cameras.main.setBounds(0, 0, this._worldWidth, this._worldHeight);
        this.cameras.main.startFollow(
            this._player, false, CAMERA_LERP_X, CAMERA_LERP_Y,
        );
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
        if (state.jump && !this._prevJump && grounded) {
            this._player.setVelocityY(this._character.jumpVelocity);
            this._playSquashStretch(1.25, 0.78, 90);
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

            background.setDepth(-30);
            decorationBehind.setDepth(-10);
            ground.setDepth(0);
            platforms.setDepth(1);
            collision.setVisible(false);
            decorationFront.setDepth(15);

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

            this._drawDevMarkers(mapData);

            return true;
        } catch (error) {
            this._showDevelopmentMapError(error);
            return false;
        }
    }

    private _spawnEnemies(enemySpawns: EnemySpawnConfig[]): void {
        for (const enemySpawn of enemySpawns) {
            const enemy = new Enemy(this, enemySpawn, {
                hasGroundAhead: (x, y) => this._hasGroundTileAt(x, y),
            }).spawn();

            this._enemies.push(enemy);
            if (this._collisionLayer) {
                this.physics.add.collider(enemy, this._collisionLayer);
            }
            this.physics.add.collider(this._player, enemy, () => {
                this._onPlayerEnemyCollision(enemy);
            });
        }
    }

    private _spawnCheckpoints(checkpoints: Array<{ id: string; x: number; y: number }>): void {
        for (const checkpointData of checkpoints) {
            const marker = this.add.rectangle(checkpointData.x, checkpointData.y - 30, 18, 40, 0x3498db, 0.45).setDepth(20);
            const checkpoint: CheckpointMarker = {
                id: checkpointData.id,
                x: checkpointData.x,
                y: checkpointData.y,
                sprite: marker,
                activated: false,
            };
            this._checkpoints.push(checkpoint);
            this.physics.add.existing(marker, true);
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
            cp.sprite.setFillStyle(cp.activated ? 0x2ecc71 : 0x3498db, cp.activated ? 0.75 : 0.45);
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
                this.scene.start(SCENE_GAME_OVER, { reason: 'All lives lost', lives: this._lives });
            });
            return;
        }

        this._input.resetAll();
        this._prevJump = false;
        this._playerState = 'hurt';
        this._playCharacterAnimation('hurt');

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
        return tile.index !== -1;
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
        for (const point of mapData.enemySpawns) {
            this.add.circle(point.x, point.y, 10, 0xe74c3c, 0.5).setDepth(20);
            this.add.line(
                point.x,
                point.y - 28,
                point.patrolLeft - point.x,
                0,
                point.patrolRight - point.x,
                0,
                0x8e44ad,
                0.8,
            ).setDepth(20);
        }

        for (const point of mapData.checkpoints) {
            this.add.rectangle(point.x, point.y - 24, 16, 32, 0x3498db, 0.5).setDepth(20);
        }
    }

    private _spawnCollectibles(spawns: CollectibleSpawnPoint[]): void {
        this._collectiblesTotal = spawns.length;
        this._refreshCollectiblesUI();

        const collectibles = this.physics.add.staticGroup();

        for (const spawn of spawns) {
            const collectible = this.physics.add.staticImage(spawn.x, spawn.y, ASSET_KEYS.pixel);
            collectible
                .setDisplaySize(20, 20)
                .setTint(0xf1c40f)
                .setData('collectibleId', spawn.id)
                .refreshBody();
            collectibles.add(collectible, true);
        }

        this.physics.add.overlap(this._player, collectibles, (_playerSprite, collectibleBody) => {
            const collectible = collectibleBody as Phaser.Physics.Arcade.Image;
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

    /**
     * Draws a cheap, art-free parallax backdrop: a soft sky gradient plus two
     * rows of desaturated, low-contrast hill silhouettes scrolling slower
     * than the foreground. This gives the level a sense of depth without
     * requiring any new art assets, per the first-pass polish plan.
     */
    private _buildParallaxBackdrop(): void {
        const width = this._worldWidth;
        const horizonY = this._worldHeight * HORIZON_Y_RATIO;

        const sky = this.add.graphics().setDepth(SKY_DEPTH).setScrollFactor(SKY_SCROLL_FACTOR, 0);
        sky.fillGradientStyle(SKY_TOP_COLOR, SKY_TOP_COLOR, SKY_HORIZON_COLOR, SKY_HORIZON_COLOR, 1);
        sky.fillRect(0, 0, width, this._worldHeight);

        this._drawHillRow(width, horizonY, HILL_FAR_CONFIG);
        this._drawHillRow(width, horizonY, HILL_NEAR_CONFIG);
    }

    /** Draws a single repeating row of soft rounded hill bumps used for parallax depth. */
    private _drawHillRow(worldWidth: number, horizonY: number, config: HillRowConfig): void {
        const baseY = horizonY + config.yOffset;
        const graphics = this.add.graphics().setDepth(config.depth).setScrollFactor(config.scrollFactor, 0);
        graphics.fillStyle(config.color, config.alpha);

        // Solid base fills the area below the hill crests down to the world
        // bottom, then overlapping circles bulge upward to form a simple,
        // unambiguous rounded hill skyline (avoids arc-direction guesswork).
        graphics.fillRect(0, baseY, worldWidth, this._worldHeight - baseY);

        const bumpCount = Math.ceil(worldWidth / config.bumpWidth) + 2;
        for (let i = 0; i < bumpCount; i += 1) {
            const cx = -config.bumpWidth / 2 + i * config.bumpWidth;
            graphics.fillEllipse(cx, baseY, config.bumpWidth, config.bumpHeight * 2);
        }
    }

    private _buildUI(): void {
        const depth = 100;
        const cx    = GAME_WIDTH / 2;
        const cy    = GAME_HEIGHT / 2;

        this._pauseBg = this.add
            .rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65)
            .setScrollFactor(0).setDepth(depth).setVisible(false);

        this._pausePanel = this.add
            .rectangle(cx, cy, 360, 160, 0x1c2333, 0.92)
            .setStrokeStyle(3, 0xffffff, 0.35)
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

        this.add
            .rectangle(96, 46, 176, 76, 0x14182a, 0.55)
            .setStrokeStyle(1, 0xffffff, 0.18)
            .setOrigin(0.5)
            .setScrollFactor(0).setDepth(depth - 1);

        this.add
            .text(12, 10, `gravity ${GRAVITY} px/s²`, {
                fontFamily: 'monospace',
                fontSize:   '12px',
                color:      '#ffffff88',
            })
            .setScrollFactor(0).setDepth(depth);

        this.add
            .text(12, 26, `Playing as: ${this._character.displayName}`, {
                fontFamily: 'monospace',
                fontSize:   '12px',
                color:      '#ffffff88',
            })
            .setScrollFactor(0).setDepth(depth);

        this._livesLabel = this.add
            .text(12, 42, `Lives: ${this._lives}`, {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#ffdf8a',
            })
            .setScrollFactor(0).setDepth(depth);

        this._scoreLabel = this.add
            .text(12, 58, `Score: ${this._score}`, {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#9ee6ff',
            })
            .setScrollFactor(0).setDepth(depth);

        this._collectiblesLabel = this.add
            .text(12, 74, `Collectibles: ${this._collectiblesCollected}/${this._collectiblesTotal}`, {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#f6de8f',
            })
            .setScrollFactor(0).setDepth(depth);

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
