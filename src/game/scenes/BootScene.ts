import { Scene } from 'phaser';
import { ASSET_KEYS } from '../constants/assetKeys';
import { SCENE_PRELOADER } from '../constants/sceneKeys';

export class Boot extends Scene
{
    constructor ()
    {
        super('Boot');
    }

    preload ()
    {
        this.load.image(ASSET_KEYS.background, 'assets/bg.png');
    }

    create ()
    {
        this.scene.start(SCENE_PRELOADER);
    }
}
