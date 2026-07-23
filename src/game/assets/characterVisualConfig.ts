import { CharacterId } from '../constants/characterSpriteConfig';
import { ATLAS_KEYS, AtlasKey } from './assetKeys';

export interface CharacterVisualConfig {
    atlasKey: AtlasKey;
    idleFrame: string;
    displayHeight: number;
    originX: number;
    originY: number;
}

export const CHARACTER_VISUALS: Readonly<Record<CharacterId, CharacterVisualConfig>> = {
    emma: { atlasKey: ATLAS_KEYS.emma, idleFrame: 'emma_idle_00', displayHeight: 76, originX: 0.5, originY: 1 },
    orel: { atlasKey: ATLAS_KEYS.orel, idleFrame: 'orel_idle_00', displayHeight: 76, originX: 0.5, originY: 1 },
    israel: { atlasKey: ATLAS_KEYS.israel, idleFrame: 'israel_idle_00', displayHeight: 76, originX: 0.5, originY: 1 },
};

export const CHARACTER_SOURCE_SIZE = { width: 242, height: 181 } as const;