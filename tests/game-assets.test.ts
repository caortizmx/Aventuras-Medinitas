import { describe, expect, it } from 'vitest';
import { validateGameAssets } from '../scripts/validate-game-assets.mjs';

describe('game atlas assets', () => {
    it('keeps PNGs, atlas metadata, frames, alpha, and manifests consistent', async () => {
        await expect(validateGameAssets()).resolves.toEqual([]);
    });
});
