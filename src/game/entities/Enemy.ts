import { Physics, Scene } from 'phaser';
import { ASSET_KEYS } from '../constants/assetKeys';

export interface EnemySpawnConfig {
    x: number;
    y: number;
    patrolLeft: number;
    patrolRight: number;
    patrolSpeed: number;
    avoidLedges: boolean;
}

export interface EnemyGroundProbe {
    hasGroundAhead: (x: number, y: number) => boolean;
}

const DEFAULT_ENEMY_SIZE = { width: 42, height: 28 };

export class Enemy extends Physics.Arcade.Sprite {
    private _direction: 1 | -1 = -1;
    private _alive = true;
    private readonly _groundProbe: EnemyGroundProbe;
    private readonly _spawn: EnemySpawnConfig;

    constructor(scene: Scene, spawn: EnemySpawnConfig, groundProbe: EnemyGroundProbe) {
        super(scene, spawn.x, spawn.y, ASSET_KEYS.pixel);
        this._spawn = spawn;
        this._groundProbe = groundProbe;
    }

    spawn(): this {
        this.scene.add.existing(this);
        this.scene.physics.add.existing(this);
        this
            .setDisplaySize(DEFAULT_ENEMY_SIZE.width, DEFAULT_ENEMY_SIZE.height)
            .setTint(0x8e44ad)
            .setCollideWorldBounds(true)
            .setDepth(6);

        const body = this.body as Physics.Arcade.Body;
        body.setAllowGravity(true);
        body.setImmovable(false);
        body.setBounce(0, 0);
        body.setMaxVelocity(220, 900);
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