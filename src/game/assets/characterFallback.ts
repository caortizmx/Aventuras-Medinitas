import {
    CharacterId,
    CHARACTER_ASSET_KEYS,
    CHARACTER_FALLBACK_CONFIG,
    CHARACTER_IDS,
    CHARACTER_SPRITESHEET_SPEC,
    getCharacterAssetKey,
} from '../constants/characterSpriteConfig';
import { findCharacterById } from '../data/characters';

function findCharacterIdByAssetKey(assetKey: string): CharacterId | undefined {
    return CHARACTER_IDS.find((characterId) => CHARACTER_ASSET_KEYS[characterId] === assetKey);
}

function drawFallbackFrame(
    ctx: CanvasRenderingContext2D,
    frameX: number,
    characterColorHex: string,
): void {
    const { frameWidth, frameHeight } = CHARACTER_SPRITESHEET_SPEC;

    ctx.fillStyle = CHARACTER_FALLBACK_CONFIG.backgroundColor;
    ctx.fillRect(frameX, 0, frameWidth, frameHeight);

    ctx.fillStyle = characterColorHex;
    ctx.fillRect(frameX + 8, 6, frameWidth - 16, frameHeight - 12);

    ctx.fillStyle = CHARACTER_FALLBACK_CONFIG.shadowColor;
    ctx.fillRect(frameX + 7, frameHeight - 10, frameWidth - 14, 4);

    ctx.fillStyle = CHARACTER_FALLBACK_CONFIG.eyeColor;
    ctx.fillRect(frameX + 15, 17, 6, 4);
    ctx.fillRect(frameX + 27, 17, 6, 4);

    ctx.strokeStyle = CHARACTER_FALLBACK_CONFIG.outlineColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(frameX + 8, 6, frameWidth - 16, frameHeight - 12);
}

function createFallbackSheet(scene: Phaser.Scene, textureKey: string, characterId: CharacterId): Phaser.Textures.CanvasTexture {
    const { frameWidth, frameHeight, columns, rows } = CHARACTER_SPRITESHEET_SPEC;
    const totalFrames = columns * rows;
    const sourceTextureKey = `${textureKey}__fallback-source`;
    if (scene.textures.exists(sourceTextureKey)) {
        scene.textures.remove(sourceTextureKey);
    }
    const canvasTexture = scene.textures.createCanvas(
        sourceTextureKey,
        frameWidth * totalFrames,
        frameHeight,
    );
    if (!canvasTexture) {
        throw new Error(`Cannot create fallback texture canvas for "${textureKey}".`);
    }
    const ctx = canvasTexture.getContext();

    const cfg = findCharacterById(characterId);
    const fallbackColor = cfg
        ? `#${cfg.temporaryColor.toString(16).padStart(6, '0')}`
        : CHARACTER_FALLBACK_CONFIG.defaultBodyColor;

    for (let frame = 0; frame < totalFrames; frame += 1) {
        drawFallbackFrame(ctx, frame * frameWidth, fallbackColor);
    }

    canvasTexture.refresh();
    return canvasTexture;
}

const REQUIRED_CHARACTER_FRAME_INDEX = Math.max(
    ...Object.values(CHARACTER_SPRITESHEET_SPEC.animations).map(({ end }) => end),
);

function hasExpectedCharacterFrames(scene: Phaser.Scene, textureKey: string): boolean {
    if (!scene.textures.exists(textureKey)) {
        return false;
    }

    const texture = scene.textures.get(textureKey);
    return texture.has(String(REQUIRED_CHARACTER_FRAME_INDEX));
}

function ensureFallbackTexture(
    scene: Phaser.Scene,
    characterId: CharacterId,
    forceReplaceExisting = false,
): void {
    const key = getCharacterAssetKey(characterId);
    if (scene.textures.exists(key) && (forceReplaceExisting || !hasExpectedCharacterFrames(scene, key))) {
        scene.textures.remove(key);
    }
    if (scene.textures.exists(key)) {
        return;
    }

    const sheetTexture = createFallbackSheet(scene, key, characterId);
    const spriteSheetSource = sheetTexture.getSourceImage();
    const spriteSheetConfig = {
        frameWidth:  CHARACTER_SPRITESHEET_SPEC.frameWidth,
        frameHeight: CHARACTER_SPRITESHEET_SPEC.frameHeight,
    };
    if (spriteSheetSource instanceof HTMLImageElement) {
        scene.textures.addSpriteSheet(key, spriteSheetSource, spriteSheetConfig);
    } else if (spriteSheetSource instanceof HTMLCanvasElement) {
        scene.textures.addSpriteSheet(
            key,
            spriteSheetSource as unknown as HTMLImageElement,
            spriteSheetConfig,
        );
    } else {
        throw new Error(`Unsupported fallback texture source for "${key}".`);
    }
    scene.textures.remove(sheetTexture.key);
}

export function ensureCharacterFallbackTextures(
    scene: Phaser.Scene,
    failedAssetKeys: ReadonlySet<string>,
): void {
    for (const key of failedAssetKeys) {
        const characterId = findCharacterIdByAssetKey(key);
        if (characterId) {
            ensureFallbackTexture(scene, characterId, true);
        }
    }

    for (const characterId of CHARACTER_IDS) {
        ensureFallbackTexture(scene, characterId);
    }
}
