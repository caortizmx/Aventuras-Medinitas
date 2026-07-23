import { Physics, Scene } from 'phaser';
import { GAMEPLAY_VISUALS } from '../assets/gameplayVisualConfig';
import { GAMEPLAY_ANIMATION_KEYS } from '../assets/animationKeys';

export interface EnemySpawnConfig {
    x: number;
    y: number;
    patrolLeft: number;
    patrolRight: number;
    patrolSpeed: number;
    avoidLedges: boolean;
    visualVariant?: 'small' | 'large';
}

export interface EnemyGroundProbe {
    hasGroundAhead: (x: number, y: number) => boolean;
}

export class Enemy extends Physics.Arcade.Sprite {
    private _direction: 1 | -1 = -1;
    private _alive = true;
    private readonly _groundProbe: EnemyGroundProbe;
    private readonly _spawn: EnemySpawnConfig;
    private readonly _visual: typeof GAMEPLAY_VISUALS.enemySmall | typeof GAMEPLAY_VISUALS.enemyLarge;

    constructor(scene: Scene, spawn: EnemySpawnConfig, groundProbe: EnemyGroundProbe) {
        const visual = spawn.visualVariant === 'large'
            ? GAMEPLAY_VISUALS.enemyLarge
            : GAMEPLAY_VISUALS.enemySmall;
        super(scene, spawn.x, spawn.y, visual.atlasKey, visual.frame);
        this._spawn = spawn;
        this._groundProbe = groundProbe;
        this._visual = visual;
    }

    spawn(): this {
        this.scene.add.existing(this);
        this.scene.physics.add.existing(this);
        this
            .setOrigin(0.5, 1)
            .setDisplaySize(this._visual.displayWidth, this._visual.displayHeight)
            .setCollideWorldBounds(true)
            .setDepth(6)
            .play(
                this._spawn.visualVariant === 'large'
                    ? GAMEPLAY_ANIMATION_KEYS.enemyLargeWalk
                    : GAMEPLAY_ANIMATION_KEYS.enemySmallWalk,
                true,
            );

        const body = this.body as Physics.Arcade.Body;
        body.setAllowGravity(true);
        body.setImmovable(false);
        body.setBounce(0, 0);
        body.setMaxVelocity(220, 900);
        // Keep collision shape fixed to gameplay dimensions even if sprite display
        // size or frame art changes, so patrol collisions stay stable.
        const bodyWidth = this._visual.bodyWidth / (Math.abs(this.scaleX) || 1);
        const bodyHeight = this._visual.bodyHeight / (Math.abs(this.scaleY) || 1);
        body.setSize(bodyWidth, bodyHeight);
        body.setOffset(
            (this.width - bodyWidth) / 2,
            this.height - bodyHeight,
        );
        return this;
    }

    updatePatrol(): void {
        if (!this._alive) {
            return;
        }

        const body = this.body as Physics.Arcade.Body;
        body.setVelocityX(this._spawn.patrolSpeed * this._direction);

        if (this.x <= this._spawn.patrolLeft) {
            this._turn(1);
            return;
        }

        if (this.x >= this._spawn.patrolRight) {
            this._turn(-1);
            return;
        }

        if (this._spawn.avoidLedges && body.blocked.down) {
            const probeX = this.x + this._direction * (body.halfWidth + 4);
            const probeY = body.bottom + 2;
            if (!this._groundProbe.hasGroundAhead(probeX, probeY)) {
                this._turn(this._direction * -1 as 1 | -1);
            }
        }
    }

    defeat(): void {
        this._alive = false;
        this.disableBody(true, true);
    }

    isAlive(): boolean {
        return this._alive;
    }

    private _turn(nextDirection: 1 | -1): void {
        this._direction = nextDirection;
        this.setFlipX(this._direction > 0);
    }
}
