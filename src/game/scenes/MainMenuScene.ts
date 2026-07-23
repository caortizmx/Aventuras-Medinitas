import { Scene, GameObjects, Scale } from 'phaser';
import { ASSET_KEYS } from '../constants/assetKeys';
import { SCENE_CHARACTER_SELECT } from '../constants/sceneKeys';
import {
    calculateContainScale,
    calculateCoverScale,
    calculateMainMenuLayout,
} from '../layout/responsiveLayout';
import { RENDER_DEPTHS } from '../constants/renderDepths';

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
        this.background = this.add.image(0, 0, ASSET_KEYS.background)
            .setDepth(RENDER_DEPTHS.modal);

        this.logo = this.add.image(0, 0, ASSET_KEYS.logo)
            .setDepth(RENDER_DEPTHS.modal + 1);

        this.title = this.add.text(0, 0, 'Tap or click to play', {
            fontFamily: 'Arial Black', color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(RENDER_DEPTHS.modal + 1);

        this._layout();
        this.scale.on(Scale.Events.RESIZE, this._layout, this);
        this.events.once('shutdown', () => {
            this.scale.off(Scale.Events.RESIZE, this._layout, this);
        });

        this.input.once('pointerdown', () => {
            this.scene.start(SCENE_CHARACTER_SELECT);
        });
    }

    private _layout (): void
    {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const layout = calculateMainMenuLayout(width, height);

        this.background
            .setPosition(width / 2, height / 2)
            .setScale(calculateCoverScale(this.background.width, this.background.height, width, height));
        this.logo
            .setPosition(layout.logoX, layout.logoY)
            .setScale(calculateContainScale(
                this.logo.width,
                this.logo.height,
                layout.logoMaxWidth,
                layout.logoMaxHeight,
            ));
        this.title
            .setPosition(width / 2, layout.promptY)
            .setFontSize(layout.promptFontSize)
            .setWordWrapWidth(layout.safeArea.width);
    }
}
