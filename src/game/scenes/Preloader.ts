import { Scene } from 'phaser';
import { ASSET_KEYS } from '../constants/assetKeys';
import { SCENE_MAIN_MENU } from '../constants/sceneKeys';
import {
    LEVEL_ONE_MAP_PATH,
    LEVEL_ONE_TILESET_IMAGE_PATH,
} from '../constants/tiledLevel';
import { ATLAS_PATHS } from '../assets/assetPaths';
import { REQUIRED_ATLAS_KEYS } from '../assets/assetKeys';
import { registerAtlasAnimations } from '../assets/registerAnimations';
import { getDevelopmentAssetScene } from './devAssetRoute';

export class Preloader extends Scene
{
    private readonly _failedAtlasKeys = new Set<string>();

    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        this.add.image(512, 384, ASSET_KEYS.background);
        this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);
        const bar = this.add.rectangle(512 - 230, 384, 4, 28, 0xffffff);

        this.load.on('progress', (progress: number) => {
            bar.width = 4 + (460 * progress);
        });
    }

    preload ()
    {
        this.load.setPath('assets');
        this._failedAtlasKeys.clear();

        this.load.image(ASSET_KEYS.logo, 'logo.png');
        this.load.tilemapTiledJSON(ASSET_KEYS.levelOneMap, LEVEL_ONE_MAP_PATH);
        this.load.image(ASSET_KEYS.levelOneTiles, LEVEL_ONE_TILESET_IMAGE_PATH);

        this.load.on('loaderror', (file: Phaser.Loader.File) => {
            if (REQUIRED_ATLAS_KEYS.includes(file.key as (typeof REQUIRED_ATLAS_KEYS)[number])) {
                this._failedAtlasKeys.add(file.key);
                console.error(`[assets] Failed to load atlas "${file.key}"`);
            }
        });

        for (const atlasKey of REQUIRED_ATLAS_KEYS) {
            const paths = ATLAS_PATHS[atlasKey];
            this.load.atlas(atlasKey, paths.textureURL, paths.atlasURL);
        }
    }

    create ()
    {
        registerAtlasAnimations(
            this.anims,
            undefined,
        );
        this.registry.set('failedAtlasKeys', [...this._failedAtlasKeys]);
        this.scene.start(getDevelopmentAssetScene(window.location.pathname) ?? SCENE_MAIN_MENU);
    }
}
