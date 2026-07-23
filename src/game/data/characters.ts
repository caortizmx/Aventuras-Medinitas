import { CharacterId, getCharacterAssetKey } from '../constants/characterSpriteConfig';

// ── Character configuration ───────────────────────────────────────────────────
// All playable characters keep identical gameplay abilities and collision body
// dimensions for consistent platforming behavior.

export interface CharacterConfig {
    /** Unique identifier used in scene data and localStorage. */
    id: CharacterId;
    /** Human-readable label shown in the selection UI. */
    displayName: string;
    /** Temporary placeholder tint colour (hex number) until real sprites land. */
    temporaryColor: number;
    /** Texture key to use once real sprite sheets are added. */
    assetKey: string;
    /** Physics body width in pixels. */
    collisionWidth: number;
    /** Physics body height in pixels. */
    collisionHeight: number;
    /** Horizontal walk speed in px/s. */
    movementSpeed: number;
    /** Vertical velocity applied on jump (negative = upward). */
    jumpVelocity: number;
}

export const CHARACTERS: readonly CharacterConfig[] = [
    {
        id:             'emma',
        displayName:    'Emma',
        temporaryColor: 0xe91e8c,   // pink
        assetKey:       getCharacterAssetKey('emma'),
        collisionWidth:  28,
        collisionHeight: 42,
        movementSpeed:   220,
        jumpVelocity:   -480,
    },
    {
        id:             'orel',
        displayName:    'Orel',
        temporaryColor: 0x3498db,   // blue
        assetKey:       getCharacterAssetKey('orel'),
        collisionWidth:  28,
        collisionHeight: 42,
        movementSpeed:   220,
        jumpVelocity:   -480,
    },
    {
        id:             'israel',
        displayName:    'Israel',
        temporaryColor: 0x2ecc71,   // green
        assetKey:       getCharacterAssetKey('israel'),
        collisionWidth:  28,
        collisionHeight: 42,
        movementSpeed:   220,
        jumpVelocity:   -480,
    },
] as const;

export const DEFAULT_CHARACTER_ID = 'emma';

/** Returns the character config for the given id, or undefined if not found. */
export function findCharacterById(id: string): CharacterConfig | undefined {
    return CHARACTERS.find(c => c.id === id);
}

/**
 * Returns the default character config.
 * The default character is always present in CHARACTERS, so the non-null
 * assertion is safe.
 */
export function getDefaultCharacter(): CharacterConfig {
    return CHARACTERS.find(c => c.id === DEFAULT_CHARACTER_ID)!;
}
