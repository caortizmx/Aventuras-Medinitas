import { Scene } from 'phaser';
import { REQUIRED_ATLAS_KEYS } from '../assets/assetKeys';
import { ATLAS_ANIMATION_DEFINITIONS } from '../assets/animationDefinitions';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants/gameValues';
import { SCENE_ATLAS_SMOKE } from './devAssetRoute';

declare global {
    interface Window {
        __ATLAS_SMOKE__?: { ok: boolean; errors: string[] };
    }
}

export class AtlasSmoke extends Scene {
    constructor() {
        super(SCENE_ATLAS_SMOKE);
    }

    create(): void {
        const errors: string[] = [];
        for (const atlasKey of REQUIRED_ATLAS_KEYS) {
            if (!this.textures.exists(atlasKey)) errors.push(`Missing atlas: ${atlasKey}`);
        }
        for (const definition of ATLAS_ANIMATION_DEFINITIONS) {
            if (!this.anims.exists(definition.key)) errors.push(`Missing animation: ${definition.key}`);
            for (const frame of definition.frames) {
                if (!this.textures.get(definition.textureKey).has(frame)) {
                    errors.push(`Missing frame: ${definition.textureKey}/${frame}`);
                }
            }
        }

        window.__ATLAS_SMOKE__ = { ok: errors.length === 0, errors };
        this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, errors.length ? 0x3a1010 : 0x102a20)
            .setOrigin(0);
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, errors.length
            ? `ATLAS SMOKE FAILED\n${errors.join('\n')}`
            : 'ATLAS SMOKE PASSED', {
            align: 'center',
            color: '#ffffff',
            fontFamily: 'monospace',
            fontSize: errors.length ? '14px' : '30px',
            wordWrap: { width: GAME_WIDTH - 40 },
        }).setOrigin(0.5);
    }
}
