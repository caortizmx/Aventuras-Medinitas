import { Scene, GameObjects } from 'phaser';
import { ASSET_KEYS } from '../constants/assetKeys';
import { SCENE_CHARACTER_SELECT } from '../constants/sceneKeys';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        this.background = this.add.image(512, 384, ASSET_KEYS.background);

        this.logo = this.add.image(512, 300, ASSET_KEYS.logo);

        this.title = this.add.text(512, 460, 'Tap or click to play', {
            fontFamily: 'Arial Black', fontSize: 38, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        this.input.once('pointerdown', () => {
            this.scene.start(SCENE_CHARACTER_SELECT);
        });
    }
}
