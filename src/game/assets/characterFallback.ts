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

/** Clamp a channel value to the valid 0-255 byte range. */
function clampByte(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)));
}

/** Lighten (positive amount) or darken (negative amount) a `#rrggbb` color. */
function shadeColor(hexColor: string, amount: number): string {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const shaded = [r, g, b].map((channel) => clampByte(channel + amount));
    return `#${shaded.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/** Draw a filled + stroked rounded rectangle path used for the chunky-cute silhouette. */
function roundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
}

/**
 * Draws a single fallback placeholder frame.
 *
 * This is a stopgap for missing real art, not the final art bible. It still
 * follows the storybook-pixel art direction as closely as a procedurally
 * drawn placeholder can: a rounded chunky-cute silhouette, simple two-tone
 * top/bottom shading (soft top-left light), a dark-tinted (not pure black)
 * outline derived from the character's own color, and a subtle idle bob so
 * the placeholder doesn't look static/dead before real art lands.
 */
function drawFallbackFrame(
    ctx: CanvasRenderingContext2D,
    frameX: number,
    characterColorHex: string,
    frameIndex: number,
): void {
    const { frameWidth, frameHeight } = CHARACTER_SPRITESHEET_SPEC;

    ctx.clearRect(frameX, 0, frameWidth, frameHeight);
    ctx.fillStyle = CHARACTER_FALLBACK_CONFIG.backgroundColor;
    ctx.fillRect(frameX, 0, frameWidth, frameHeight);

    // Gentle per-frame bob so idle/run/celebrate placeholders read as "alive".
    const bob = Math.sin((frameIndex % 6) * (Math.PI / 3)) * 2;

    const bodyX = frameX + 8;
    const bodyY = 6 + bob;
    const bodyWidth = frameWidth - 16;
    const bodyHeight = frameHeight - 12;
    const radius = 10;

    const lightColor = shadeColor(characterColorHex, 35);
    const darkColor = shadeColor(characterColorHex, -30);
    const outlineColor = shadeColor(characterColorHex, -60);

    // Two-tone top/bottom shading approximates a single soft top-left light
    // source without requiring a real gradient asset.
    roundedRectPath(ctx, bodyX, bodyY, bodyWidth, bodyHeight, radius);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = lightColor;
    ctx.fillRect(bodyX, bodyY, bodyWidth, bodyHeight / 2);
    ctx.fillStyle = characterColorHex;
    ctx.fillRect(bodyX, bodyY + bodyHeight / 2, bodyWidth, bodyHeight / 2);
    ctx.restore();

    // Soft cast shadow under the character to avoid a "floating square" look.
    ctx.fillStyle = CHARACTER_FALLBACK_CONFIG.shadowColor;
    ctx.beginPath();
    ctx.ellipse(
        frameX + frameWidth / 2,
        frameHeight - 5,
        bodyWidth / 2.4,
        3,
        0,
        0,
        Math.PI * 2,
    );
    ctx.fill();

    // Simple rounded eyes for a friendly, family-facing read.
    ctx.fillStyle = CHARACTER_FALLBACK_CONFIG.eyeColor;
    ctx.beginPath();
    ctx.ellipse(frameX + 18, 17 + bob, 3.5, 4.5, 0, 0, Math.PI * 2);
    ctx.ellipse(frameX + 30, 17 + bob, 3.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.ellipse(frameX + 18, 18 + bob, 1.5, 2, 0, 0, Math.PI * 2);
    ctx.ellipse(frameX + 30, 18 + bob, 1.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    roundedRectPath(ctx, bodyX, bodyY, bodyWidth, bodyHeight, radius);
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 2;
    ctx.stroke();
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
        drawFallbackFrame(ctx, frame * frameWidth, fallbackColor, frame);
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
