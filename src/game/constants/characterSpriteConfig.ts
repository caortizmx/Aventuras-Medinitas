// Canonical playable character ids. Add new playable characters here,
// then provide entries in all maps below to keep asset and animation wiring in sync.
export const CHARACTER_IDS = ['emma', 'orel', 'israel'] as const;

export type CharacterId = typeof CHARACTER_IDS[number];

export const CHARACTER_ASSET_KEYS: Record<CharacterId, string> = {
    emma:   'atlas-character-emma',
    orel:   'atlas-character-orel',
    israel: 'atlas-character-israel',
};

export const EXPECTED_CHARACTER_SPRITE_FILES: Record<CharacterId, string> = {
    emma:   'characters/emma-sheet.png',
    orel:   'characters/orel-sheet.png',
    israel: 'characters/israel-sheet.png',
};

export interface AnimationSliceSpec {
    start: number;
    end: number;
    frames: number;
    frameRate: number;
    repeat: number;
}

export const CHARACTER_SPRITESHEET_SPEC = {
    frameWidth:  48,
    frameHeight: 48,
    columns:     22,
    rows:        1,
    sharedLayoutForAllCharacters: true,
    animations: {
        idle:      { start: 0,  end: 3,  frames: 4, frameRate: 6,  repeat: -1 },
        run:       { start: 4,  end: 9,  frames: 6, frameRate: 12, repeat: -1 },
        jump:      { start: 10, end: 11, frames: 2, frameRate: 10, repeat: 0 },
        fall:      { start: 12, end: 13, frames: 2, frameRate: 10, repeat: -1 },
        hurt:      { start: 14, end: 15, frames: 2, frameRate: 12, repeat: 0 },
        celebrate: { start: 16, end: 21, frames: 6, frameRate: 10, repeat: -1 },
    } as const,
} as const;

export const CHARACTER_FALLBACK_CONFIG = {
    textureWidth:  CHARACTER_SPRITESHEET_SPEC.frameWidth * CHARACTER_SPRITESHEET_SPEC.columns,
    textureHeight: CHARACTER_SPRITESHEET_SPEC.frameHeight * CHARACTER_SPRITESHEET_SPEC.rows,
    backgroundColor: '#dfe6f8',
    outlineColor:  '#10131d',
    eyeColor:      '#ffffff',
    shadowColor:   '#00000033',
    defaultBodyColor: '#888888',
} as const;

export function getCharacterAssetKey(characterId: CharacterId): string {
    return CHARACTER_ASSET_KEYS[characterId];
}

export function getMissingCharacterAssetKeys(textureExists: (key: string) => boolean): string[] {
    return CHARACTER_IDS
        .map(getCharacterAssetKey)
        .filter(key => !textureExists(key));
}
