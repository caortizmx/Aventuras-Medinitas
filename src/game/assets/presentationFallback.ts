import {
    PRESENTATION_SPRITESHEETS,
    PRESENTATION_TEXTURES,
    PresentationSpritesheetSpec,
} from '../constants/presentationAssetConfig';

function shouldReplace(scene: Phaser.Scene, key: string, failedAssetKeys: ReadonlySet<string>): boolean {
    return failedAssetKeys.has(key) && scene.textures.exists(key);
}

function createCanvasTexture(scene: Phaser.Scene, key: string, width: number, height: number): Phaser.Textures.CanvasTexture {
    if (scene.textures.exists(key)) {
        scene.textures.remove(key);
    }
    const canvasTexture = scene.textures.createCanvas(key, width, height);
    if (!canvasTexture) {
        throw new Error(`Unable to create fallback canvas texture: ${key}`);
    }
    return canvasTexture;
}

function createSpritesheetCanvasTexture(
    scene: Phaser.Scene,
    key: string,
    width: number,
    height: number,
): Phaser.Textures.CanvasTexture {
    const sourceTextureKey = `${key}__fallback-source`;
    if (scene.textures.exists(sourceTextureKey)) {
        scene.textures.remove(sourceTextureKey);
    }
    const canvasTexture = scene.textures.createCanvas(sourceTextureKey, width, height);
    if (!canvasTexture) {
        throw new Error(`Unable to create fallback spritesheet canvas texture: ${key}`);
    }
    return canvasTexture;
}

function registerFallbackSpritesheet(
    scene: Phaser.Scene,
    key: string,
    spec: Pick<PresentationSpritesheetSpec, 'frameWidth' | 'frameHeight'>,
    sourceTexture: Phaser.Textures.CanvasTexture,
): void {
    if (scene.textures.exists(key)) {
        scene.textures.remove(key);
    }

    const spriteSheetSource = sourceTexture.getSourceImage();
    const spriteSheetConfig = {
        frameWidth: spec.frameWidth,
        frameHeight: spec.frameHeight,
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
        throw new Error(`Unsupported fallback spritesheet source for "${key}".`);
    }

    scene.textures.remove(sourceTexture.key);
}

function buildEnemySheet(scene: Phaser.Scene): void {
    const spec = PRESENTATION_SPRITESHEETS.enemy;
    const frameCount = 4;
    const sheet = createSpritesheetCanvasTexture(
        scene,
        spec.key,
        spec.frameWidth * frameCount,
        spec.frameHeight,
    );
    const ctx = sheet.getContext();

    for (let i = 0; i < frameCount; i += 1) {
        const x = i * spec.frameWidth;
        const bob = Math.sin((i / frameCount) * Math.PI * 2) * 1.5;
        ctx.fillStyle = '#aa4f35';
        ctx.fillRect(x + 6, 7 + bob, 36, 20);
        ctx.fillStyle = '#d57a58';
        ctx.fillRect(x + 6, 7 + bob, 36, 9);
        ctx.fillStyle = '#4a2618';
        ctx.fillRect(x + 5, 6 + bob, 38, 22);
        ctx.clearRect(x + 7, 8 + bob, 34, 18);
        ctx.fillStyle = '#d57a58';
        ctx.fillRect(x + 7, 8 + bob, 34, 9);
        ctx.fillStyle = '#aa4f35';
        ctx.fillRect(x + 7, 17 + bob, 34, 9);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 26, 14 + bob, 4, 5);
        ctx.fillRect(x + 33, 14 + bob, 4, 5);
        ctx.fillStyle = '#3a271f';
        ctx.fillRect(x + 27, 16 + bob, 2, 2);
        ctx.fillRect(x + 34, 16 + bob, 2, 2);
    }

    sheet.refresh();
    registerFallbackSpritesheet(scene, spec.key, spec, sheet);
}

function buildCollectibleSheet(scene: Phaser.Scene): void {
    const spec = PRESENTATION_SPRITESHEETS.collectible;
    const frameCount = 6;
    const sheet = createSpritesheetCanvasTexture(
        scene,
        spec.key,
        spec.frameWidth * frameCount,
        spec.frameHeight,
    );
    const ctx = sheet.getContext();
    const COLLECTIBLE_PULSE_SCALES = [0.78, 0.9, 1, 1, 0.9, 0.78] as const;

    for (let i = 0; i < frameCount; i += 1) {
        const x = i * spec.frameWidth;
        const r = 8 * COLLECTIBLE_PULSE_SCALES[i];
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(x + 12, 12, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffe27a';
        ctx.beginPath();
        ctx.arc(x + 10, 10, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
    }

    sheet.refresh();
    registerFallbackSpritesheet(scene, spec.key, spec, sheet);
}

function buildCheckpointSheet(scene: Phaser.Scene): void {
    const spec = PRESENTATION_SPRITESHEETS.checkpoint;
    const frameCount = 8;
    const sheet = createSpritesheetCanvasTexture(
        scene,
        spec.key,
        spec.frameWidth * frameCount,
        spec.frameHeight,
    );
    const ctx = sheet.getContext();

    for (let i = 0; i < frameCount; i += 1) {
        const x = i * spec.frameWidth;
        const isActive = i >= 4;
        const swing = Math.sin((i % 4) * (Math.PI / 2)) * 2;
        const poleColor = isActive ? '#55d98c' : '#4f83b3';
        const flagColor = isActive ? '#b3ffd1' : '#b5d6ff';

        ctx.fillStyle = '#30394a';
        ctx.fillRect(x + 12, 5, 4, 34);
        ctx.fillStyle = poleColor;
        ctx.fillRect(x + 13, 5, 2, 34);
        ctx.fillStyle = flagColor;
        ctx.beginPath();
        ctx.moveTo(x + 16, 9);
        ctx.lineTo(x + 16, 20);
        ctx.lineTo(x + 24 + swing, 14);
        ctx.closePath();
        ctx.fill();
    }

    sheet.refresh();
    registerFallbackSpritesheet(scene, spec.key, spec, sheet);
}

function buildGoalSheet(scene: Phaser.Scene): void {
    const spec = PRESENTATION_SPRITESHEETS.goal;
    const frameCount = 6;
    const sheet = createSpritesheetCanvasTexture(
        scene,
        spec.key,
        spec.frameWidth * frameCount,
        spec.frameHeight,
    );
    const ctx = sheet.getContext();

    for (let i = 0; i < frameCount; i += 1) {
        const x = i * spec.frameWidth;
        const sway = Math.sin((i / frameCount) * Math.PI * 2) * 3;
        ctx.fillStyle = '#2b1d57';
        ctx.fillRect(x + 34, 10, 6, 90);
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(x + 40, 24 + sway, 30, 22);
        ctx.fillStyle = '#ffe58a';
        ctx.fillRect(x + 42, 26 + sway, 16, 10);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 24, 26, 6, 6);
        ctx.fillRect(x + 60, 10, 5, 5);
    }

    sheet.refresh();
    registerFallbackSpritesheet(scene, spec.key, spec, sheet);
}

function buildGroundTexture(scene: Phaser.Scene): void {
    const key = PRESENTATION_TEXTURES.terrainGround.key;
    const tile = createCanvasTexture(scene, key, 64, 64);
    const ctx = tile.getContext();
    ctx.fillStyle = '#6d5238';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#7f6548';
    ctx.fillRect(0, 0, 64, 20);
    ctx.fillStyle = '#59412d';
    for (let x = 0; x < 64; x += 8) {
        ctx.fillRect(x, 24 + (x % 16 === 0 ? 0 : 5), 4, 4);
    }
    tile.refresh();
}

function buildPlatformTexture(scene: Phaser.Scene): void {
    const key = PRESENTATION_TEXTURES.terrainPlatform.key;
    const tile = createCanvasTexture(scene, key, 64, 24);
    const ctx = tile.getContext();
    ctx.fillStyle = '#2f8c5e';
    ctx.fillRect(0, 0, 64, 24);
    ctx.fillStyle = '#57b482';
    ctx.fillRect(0, 0, 64, 8);
    ctx.fillStyle = '#1f6e46';
    ctx.fillRect(0, 16, 64, 8);
    tile.refresh();
}

function buildUiTextures(scene: Phaser.Scene): void {
    const overlay = createCanvasTexture(scene, PRESENTATION_TEXTURES.uiOverlay.key, 64, 64);
    const overlayCtx = overlay.getContext();
    overlayCtx.fillStyle = 'rgba(8, 12, 28, 0.72)';
    overlayCtx.fillRect(0, 0, 64, 64);
    overlay.refresh();

    const panel = createCanvasTexture(scene, PRESENTATION_TEXTURES.uiPanel.key, 360, 180);
    const panelCtx = panel.getContext();
    panelCtx.fillStyle = 'rgba(28, 35, 51, 0.93)';
    panelCtx.fillRect(0, 0, 360, 180);
    panelCtx.strokeStyle = 'rgba(255,255,255,0.35)';
    panelCtx.lineWidth = 4;
    panelCtx.strokeRect(2, 2, 356, 176);
    panel.refresh();

    const hud = createCanvasTexture(scene, PRESENTATION_TEXTURES.uiHudPanel.key, 188, 84);
    const hudCtx = hud.getContext();
    hudCtx.fillStyle = 'rgba(20, 24, 42, 0.62)';
    hudCtx.fillRect(0, 0, 188, 84);
    hudCtx.strokeStyle = 'rgba(255,255,255,0.2)';
    hudCtx.lineWidth = 2;
    hudCtx.strokeRect(1, 1, 186, 82);
    hud.refresh();
}

const SPRITESHEET_BUILDERS: Readonly<Record<string, (scene: Phaser.Scene) => void>> = {
    [PRESENTATION_SPRITESHEETS.enemy.key]: buildEnemySheet,
    [PRESENTATION_SPRITESHEETS.collectible.key]: buildCollectibleSheet,
    [PRESENTATION_SPRITESHEETS.checkpoint.key]: buildCheckpointSheet,
    [PRESENTATION_SPRITESHEETS.goal.key]: buildGoalSheet,
};

const TEXTURE_BUILDERS: Readonly<Record<string, (scene: Phaser.Scene) => void>> = {
    [PRESENTATION_TEXTURES.terrainGround.key]: buildGroundTexture,
    [PRESENTATION_TEXTURES.terrainPlatform.key]: buildPlatformTexture,
    [PRESENTATION_TEXTURES.uiOverlay.key]: buildUiTextures,
    [PRESENTATION_TEXTURES.uiPanel.key]: buildUiTextures,
    [PRESENTATION_TEXTURES.uiHudPanel.key]: buildUiTextures,
};

function ensureSpritesheet(scene: Phaser.Scene, key: string): void {
    const builder = SPRITESHEET_BUILDERS[key];
    if (builder) {
        builder(scene);
    }
}

function ensureTexture(scene: Phaser.Scene, key: string): void {
    const builder = TEXTURE_BUILDERS[key];
    if (builder) {
        builder(scene);
    }
}

export function ensurePresentationFallbackAssets(
    scene: Phaser.Scene,
    failedAssetKeys: ReadonlySet<string>,
): void {
    for (const spec of Object.values(PRESENTATION_SPRITESHEETS)) {
        if (shouldReplace(scene, spec.key, failedAssetKeys) || !scene.textures.exists(spec.key)) {
            ensureSpritesheet(scene, spec.key);
        }
    }

    for (const texture of Object.values(PRESENTATION_TEXTURES)) {
        if (shouldReplace(scene, texture.key, failedAssetKeys) || !scene.textures.exists(texture.key)) {
            ensureTexture(scene, texture.key);
        }
    }
}
