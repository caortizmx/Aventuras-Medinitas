import { Scene } from 'phaser';
import { REQUIRED_ATLAS_KEYS } from '../assets/assetKeys';
import { GAME_WIDTH } from '../constants/gameValues';
import { SCENE_ASSET_GALLERY } from './devAssetRoute';

export class AssetGallery extends Scene {
    constructor() {
        super(SCENE_ASSET_GALLERY);
    }

    create(): void {
        this.cameras.main.setBackgroundColor(0x1a1a2e);
        let y = 28;
        for (const atlasKey of REQUIRED_ATLAS_KEYS) {
            this.add.text(12, y, atlasKey, { color: '#f1c40f', fontFamily: 'monospace', fontSize: '16px' });
            y += 32;
            const frames = this.textures.get(atlasKey).getFrameNames().filter((frame) => frame !== '__BASE');
            frames.forEach((frame, index) => {
                const x = 42 + (index % 10) * 78;
                const rowY = y + Math.floor(index / 10) * 92;
                this.add.image(x, rowY, atlasKey, frame).setDisplaySize(56, 56);
                this.add.text(x, rowY + 34, frame, {
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    fontSize: '7px',
                    align: 'center',
                    wordWrap: { width: 72 },
                }).setOrigin(0.5, 0);
            });
            y += Math.ceil(frames.length / 10) * 92 + 24;
        }
        this.cameras.main.setBounds(0, 0, GAME_WIDTH, y);
        this.input.on('wheel', (_pointer: unknown, _objects: unknown, _dx: number, dy: number) => {
            this.cameras.main.scrollY = Phaser.Math.Clamp(
                this.cameras.main.scrollY + dy,
                0,
                Math.max(0, y - this.cameras.main.height),
            );
        });
    }
}
