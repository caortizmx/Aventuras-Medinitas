import { Scene } from 'phaser';
import { ASSET_KEYS } from '../constants/assetKeys';
import {
    CHARACTER_IDS,
    CHARACTER_SPRITESHEET_SPEC,
    EXPECTED_CHARACTER_SPRITE_FILES,
    getCharacterAssetKey,
} from '../constants/characterSpriteConfig';
import { ensureCharacterFallbackTextures } from '../assets/characterFallback';
import { registerCharacterAnimations } from '../animations/characterAnimations';
import { SCENE_MAIN_MENU } from '../constants/sceneKeys';
import {
    LEVEL_ONE_MAP_PATH,
    LEVEL_ONE_TILESET_IMAGE_PATH,
} from '../constants/tiledLevel';

export class Preloader extends Scene
{
    private readonly _failedCharacterAssetKeys = new Set<string>();

    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        //  We loaded this image in our Boot Scene, so we can display it here
        this.add.image(512, 384, ASSET_KEYS.background);

        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const bar = this.add.rectangle(512-230, 384, 4, 28, 0xffffff);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on('progress', (progress: number) => {

            //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
            bar.width = 4 + (460 * progress);

        });
    }

    preload ()
    {
        this.load.setPath('assets');
        this._failedCharacterAssetKeys.clear();

        this.load.image(ASSET_KEYS.logo, 'logo.png');
        this.load.tilemapTiledJSON(ASSET_KEYS.levelOneMap, LEVEL_ONE_MAP_PATH);
        this.load.image(ASSET_KEYS.levelOneTiles, LEVEL_ONE_TILESET_IMAGE_PATH);

        this.load.on('loaderror', (file: Phaser.Loader.File) => {
            if (CHARACTER_IDS.some((id) => getCharacterAssetKey(id) === file.key)) {
                this._failedCharacterAssetKeys.add(file.key);
            }
        });

        for (const characterId of CHARACTER_IDS) {
            this.load.spritesheet(
                getCharacterAssetKey(characterId),
                EXPECTED_CHARACTER_SPRITE_FILES[characterId],
                {
                    frameWidth:  CHARACTER_SPRITESHEET_SPEC.frameWidth,
                    frameHeight: CHARACTER_SPRITESHEET_SPEC.frameHeight,
                },
            );
        }
    }

    create ()
    {
        ensureCharacterFallbackTextures(this, this._failedCharacterAssetKeys);
        registerCharacterAnimations(this.anims);
        this.scene.start(SCENE_MAIN_MENU);
    }
}
