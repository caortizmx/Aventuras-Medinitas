export const ATLAS_KEYS = {
    emma: 'atlas-character-emma',
    orel: 'atlas-character-orel',
    israel: 'atlas-character-israel',
    gameplay: 'atlas-gameplay',
    environment: 'atlas-environment',
} as const;

export type AtlasKey = (typeof ATLAS_KEYS)[keyof typeof ATLAS_KEYS];

export const REQUIRED_ATLAS_KEYS: readonly AtlasKey[] = Object.values(ATLAS_KEYS);