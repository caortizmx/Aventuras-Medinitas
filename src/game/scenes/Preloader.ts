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
import {
    PRESENTATION_SPRITESHEETS,
    PRESENTATION_TEXTURES,
} from '../constants/presentationAssetConfig';
import { ensurePresentationFallbackAssets } from '../assets/presentationFallback';
import { registerPresentationAnimations } from '../animations/presentationAnimations';

export class Preloader extends Scene
{
    private readonly _failedCharacterAssetKeys = new Set<string>();
    private readonly _failedPresentationAssetKeys = new Set<string>();
    private readonly _presentationAssetKeys = new Set<string>([
        ...Object.values(PRESENTATION_SPRITESHEETS).map(({ key }) => key),
        ...Object.values(PRESENTATION_TEXTURES).map(({ key }) => key),
    ]);

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
        this._failedCharacterAssetKeys.clear();
        this._failedPresentationAssetKeys.clear();

        this.load.image(ASSET_KEYS.logo, 'logo.png');
        this.load.tilemapTiledJSON(ASSET_KEYS.levelOneMap, LEVEL_ONE_MAP_PATH);
        this.load.image(ASSET_KEYS.levelOneTiles, LEVEL_ONE_TILESET_IMAGE_PATH);

        this.load.on('loaderror', (file: Phaser.Loader.File) => {
            if (CHARACTER_IDS.some((id) => getCharacterAssetKey(id) === file.key)) {
                this._failedCharacterAssetKeys.add(file.key);
                return;
            }

            if (this._presentationAssetKeys.has(file.key)) {
                this._failedPresentationAssetKeys.add(file.key);
            }
        });

        for (const characterId of CHARACTER_IDS) {
            this.load.spritesheet(
                getCharacterAssetKey(characterId),
                EXPECTED_CHARACTER_SPRITE_FILES[characterId],
                {
                    frameWidth: CHARACTER_SPRITESHEET_SPEC.frameWidth,
                    frameHeight: CHARACTER_SPRITESHEET_SPEC.frameHeight,
                },
            );
        }

        for (const spec of Object.values(PRESENTATION_SPRITESHEETS)) {
            this.load.spritesheet(spec.key, spec.filePath, {
                frameWidth: spec.frameWidth,
                frameHeight: spec.frameHeight,
            });
        }

        for (const texture of Object.values(PRESENTATION_TEXTURES)) {
            this.load.image(texture.key, texture.filePath);
        }
    }

    create ()
    {
        ensureCharacterFallbackTextures(this, this._failedCharacterAssetKeys);
        ensurePresentationFallbackAssets(this, this._failedPresentationAssetKeys);
        registerCharacterAnimations(this.anims);
        registerPresentationAnimations(this.anims);
        this.scene.start(SCENE_MAIN_MENU);
    }
}
