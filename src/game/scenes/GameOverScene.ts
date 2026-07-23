import { Scene } from 'phaser';
import { SCENE_MAIN_MENU } from '../constants/sceneKeys';

export class GameOver extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    gameover_text : Phaser.GameObjects.Text;

    constructor ()
    {
        super('GameOver');
    }

    create (data?: { reason?: string; lives?: number })
    {
        this.camera = this.cameras.main
        this.camera.setBackgroundColor(0xff0000);

        this.background = this.add.image(512, 384, 'background');
        this.background.setAlpha(0.5);

        const summary = `Game Over${typeof data?.lives === 'number' ? `\nLives: ${data.lives}` : ''}${data?.reason ? `\n${data.reason}` : ''}`;

        this.gameover_text = this.add.text(512, 384, summary, {
            fontFamily: 'Arial Black', fontSize: 64, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        });
        this.gameover_text.setOrigin(0.5);

        this.input.once('pointerdown', () => {

            this.scene.start(SCENE_MAIN_MENU);

        });
    }
}
