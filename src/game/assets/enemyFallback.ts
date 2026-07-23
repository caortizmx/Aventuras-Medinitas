// Procedural placeholder art for enemies, following the same "storybook
// pixel adventure" art-bible rules as the character fallback: rounded
// silhouette, two-tone top/bottom shading, a dark-tinted (not pure black)
// outline, and a friendly/mischievous rather than scary expression. This is
// a stopgap until real enemy sprite sheets are produced.

import { shadeColor, toHexColorString } from './colorShading';

const ENEMY_FALLBACK_TEXTURE_KEY = 'enemy-fallback';
const CANVAS_WIDTH = 48;
const CANVAS_HEIGHT = 32;

/**
 * Ensures a rounded, outlined placeholder enemy texture exists in the given
 * scene, drawn in the enemy's signature color. Safe to call every time an
 * enemy spawns; it is a no-op once the texture for that color already exists.
 */
export function ensureEnemyFallbackTexture(scene: Phaser.Scene, colorHex: number): string {
    const textureKey = `${ENEMY_FALLBACK_TEXTURE_KEY}-${colorHex.toString(16)}`;
    if (scene.textures.exists(textureKey)) {
        return textureKey;
    }

    const canvasTexture = scene.textures.createCanvas(textureKey, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (!canvasTexture) {
        throw new Error(`Cannot create enemy fallback texture "${textureKey}".`);
    }
    const ctx = canvasTexture.getContext();

    const baseColor = toHexColorString(colorHex);
    const lightColor = shadeColor(colorHex, 40);
    const darkColor = shadeColor(colorHex, -35);
    const outlineColor = shadeColor(colorHex, -65);

    const bodyX = 3;
    const bodyY = 4;
    const bodyWidth = CANVAS_WIDTH - 6;
    const bodyHeight = CANVAS_HEIGHT - 8;
    const radius = bodyHeight / 2;

    ctx.beginPath();
    ctx.moveTo(bodyX + radius, bodyY);
    ctx.arcTo(bodyX + bodyWidth, bodyY, bodyX + bodyWidth, bodyY + bodyHeight, radius);
    ctx.arcTo(bodyX + bodyWidth, bodyY + bodyHeight, bodyX, bodyY + bodyHeight, radius);
    ctx.arcTo(bodyX, bodyY + bodyHeight, bodyX, bodyY, radius);
    ctx.arcTo(bodyX, bodyY, bodyX + bodyWidth, bodyY, radius);
    ctx.closePath();

    ctx.save();
    ctx.clip();
    ctx.fillStyle = lightColor;
    ctx.fillRect(bodyX, bodyY, bodyWidth, bodyHeight / 2);
    ctx.fillStyle = baseColor;
    ctx.fillRect(bodyX, bodyY + bodyHeight / 2, bodyWidth, bodyHeight / 2);
    ctx.restore();

    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Soft cast shadow so the enemy reads as grounded, not floating.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 3, bodyWidth / 2.6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Big friendly/mischievous eyes rather than a scary expression.
    const eyeY = bodyY + bodyHeight / 2 - 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(bodyX + bodyWidth * 0.62, eyeY, 4, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(bodyX + bodyWidth * 0.8, eyeY, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.ellipse(bodyX + bodyWidth * 0.64, eyeY + 1, 1.8, 2.2, 0, 0, Math.PI * 2);
    ctx.ellipse(bodyX + bodyWidth * 0.82, eyeY + 1, 1.8, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    canvasTexture.refresh();
    return textureKey;
}
