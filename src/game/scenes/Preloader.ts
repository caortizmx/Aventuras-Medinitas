import { GameObjects, Scene, Scale } from 'phaser';
import { ASSET_KEYS } from '../constants/assetKeys';
import { SCENE_MAIN_MENU } from '../constants/sceneKeys';
import { LEVEL_ONE_TILESET_IMAGE_PATH } from '../constants/tiledLevel';
import { CAMPAIGN_LEVELS } from '../constants/campaign';
import { ATLAS_PATHS } from '../assets/assetPaths';
import { REQUIRED_ATLAS_KEYS } from '../assets/assetKeys';
import { registerAtlasAnimations } from '../assets/registerAnimations';
import { getDevelopmentAssetScene } from './devAssetRoute';
import { ATLAS_ANIMATION_DEFINITIONS } from '../assets/animationDefinitions';
import {
    calculateContainScale,
    calculateCoverScale,
    calculateLoadingLayout,
    clamp,
} from '../layout/responsiveLayout';
import { RENDER_DEPTHS } from '../constants/renderDepths';

const MAX_ASSET_KEY_DISPLAY_LENGTH = 32;

export class Preloader extends Scene
{
    private readonly _failedAtlasKeys = new Set<string>();
    private _background!: GameObjects.Image;
    private _logo!: GameObjects.Image;
    private _progressTrack!: GameObjects.Rectangle;
    private _progressBar!: GameObjects.Rectangle;
    private _percentage!: GameObjects.Text;
    private _status!: GameObjects.Text;
    private _progress = 0;

    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        const depth = RENDER_DEPTHS.modal;
        this._background = this.add.image(0, 0, ASSET_KEYS.background).setDepth(depth);
        this._logo = this.add.image(0, 0, ASSET_KEYS.logo).setDepth(depth + 1);
        this._progressTrack = this.add.rectangle(0, 0, 1, 1, 0x0b1630, 0.78)
            .setStrokeStyle(2, 0xffffff, 0.9)
            .setDepth(depth + 1);
        this._progressBar = this.add.rectangle(0, 0, 1, 1, 0x62d3ff)
            .setOrigin(0, 0.5)
            .setDepth(depth + 2);
        this._percentage = this.add.text(0, 0, '0%', {
            fontFamily: 'Arial Black',
            color: '#ffffff',
        }).setOrigin(0.5).setDepth(depth + 2);
        this._status = this.add.text(0, 0, 'Preparing your adventure…', {
            fontFamily: 'Arial',
            color: '#e7f5ff',
            align: 'center',
        }).setOrigin(0.5).setDepth(depth + 2);

        this.load.on('progress', (progress: number) => {
            this._progress = clamp(0, progress, 1);
            this._percentage.setText(`${Math.round(this._progress * 100)}%`);
            this._layout();
        });

        this.load.on('fileprogress', (file: Phaser.Loader.File) => {
            this._status.setText(`Loading ${this._formatAssetKeyForDisplay(file.key)}…`);
        });

        this.load.on('loaderror', () => {
            this._status.setText('Some artwork could not load. Continuing safely…');
        });

        this._layout();
        this.scale.on(Scale.Events.RESIZE, this._layout, this);
        this.events.once('shutdown', () => {
            this.scale.off(Scale.Events.RESIZE, this._layout, this);
        });
    }

    preload ()
    {
        this.load.setPath('assets');
        this._failedAtlasKeys.clear();

        for (const level of CAMPAIGN_LEVELS) {
            this.load.tilemapTiledJSON(level.mapAssetKey, level.mapPath);
        }
        this.load.image(ASSET_KEYS.levelOneTiles, LEVEL_ONE_TILESET_IMAGE_PATH);

        this.load.on('loaderror', (file: Phaser.Loader.File) => {
            if (REQUIRED_ATLAS_KEYS.includes(file.key as (typeof REQUIRED_ATLAS_KEYS)[number])) {
                this._failedAtlasKeys.add(file.key);
                if (import.meta.env.DEV) {
                    console.error(`[assets] Failed to load atlas "${file.key}"`);
                }
            }
        });

        this.load.setPath('');
        for (const atlasKey of REQUIRED_ATLAS_KEYS) {
            const paths = ATLAS_PATHS[atlasKey];
            this.load.atlas(atlasKey, paths.textureURL, paths.atlasURL);
        }
    }

    create ()
    {
        registerAtlasAnimations(
            this.anims,
            ATLAS_ANIMATION_DEFINITIONS.filter(({ textureKey }) => this.textures.exists(textureKey)),
        );
        this.registry.set('failedAtlasKeys', [...this._failedAtlasKeys]);
        this.scene.start(getDevelopmentAssetScene(window.location.pathname) ?? SCENE_MAIN_MENU);
    }

    private _layout (): void
    {
        const camera = this.cameras.main;
        const width = camera.width;
        const height = camera.height;
        const layout = calculateLoadingLayout(width, height);
        const backgroundScale = calculateCoverScale(
            this._background.width,
            this._background.height,
            width,
            height,
        );
        const logoScale = calculateContainScale(
            this._logo.width,
            this._logo.height,
            layout.logoMaxWidth,
            layout.logoMaxHeight,
        );

        this._background.setPosition(width / 2, height / 2).setScale(backgroundScale);
        this._logo.setPosition(layout.logoX, layout.logoY).setScale(logoScale);
        this._progressTrack
            .setPosition(layout.progressX, layout.progressY)
            .setSize(layout.progressWidth, layout.progressHeight);
        this._progressBar
            .setPosition(layout.progressX - layout.progressWidth / 2 + 3, layout.progressY)
            .setSize(
                Math.max(0, (layout.progressWidth - 6) * this._progress),
                Math.max(2, layout.progressHeight - 6),
            );
        this._percentage
            .setPosition(layout.progressX, layout.percentageY)
            .setFontSize(layout.statusFontSize);
        this._status
            .setPosition(layout.progressX, layout.statusY)
            .setFontSize(layout.statusFontSize)
            .setWordWrapWidth(layout.safeArea.width);
    }

    private _formatAssetKeyForDisplay (key: string | number): string
    {
        const value = String(key).replace(/[-_]+/g, ' ').trim();
        return value.length > MAX_ASSET_KEY_DISPLAY_LENGTH ? 'game artwork' : value;
    }
}
