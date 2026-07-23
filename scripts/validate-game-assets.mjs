import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME_ROOT = path.join(ROOT, 'public/assets/game');
const CHARACTER_SOURCE_SIZE = { w: 242, h: 181 };

const ATLAS_FILES = {
    emma_atlas: 'atlases/characters/emma/emma_atlas',
    orel_atlas: 'atlases/characters/orel/orel_atlas',
    israel_atlas: 'atlases/characters/israel/israel_atlas',
    gameplay_assets_atlas: 'atlases/gameplay/gameplay_assets_atlas',
    environment_atlas: 'atlases/environment/environment_atlas',
};

const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

export function decodePng(buffer) {
    if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
        throw new Error('invalid PNG signature');
    }

    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    const idat = [];

    while (offset < buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString('ascii', offset + 4, offset + 8);
        const data = buffer.subarray(offset + 8, offset + 8 + length);
        offset += length + 12;
        if (type === 'IHDR') {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            bitDepth = data[8];
            colorType = data[9];
        } else if (type === 'IDAT') {
            idat.push(data);
        } else if (type === 'IEND') {
            break;
        }
    }

    if (bitDepth !== 8 || ![2, 4, 6].includes(colorType)) {
        throw new Error(`unsupported PNG format: bit depth ${bitDepth}, color type ${colorType}`);
    }

    const channels = colorType === 6 ? 4 : colorType === 4 ? 2 : 3;
    const stride = width * channels;
    const raw = inflateSync(Buffer.concat(idat));
    const pixels = Buffer.alloc(stride * height);
    let rawOffset = 0;

    for (let y = 0; y < height; y += 1) {
        const filter = raw[rawOffset++];
        const rowOffset = y * stride;
        for (let x = 0; x < stride; x += 1) {
            const value = raw[rawOffset++];
            const left = x >= channels ? pixels[rowOffset + x - channels] : 0;
            const up = y > 0 ? pixels[rowOffset - stride + x] : 0;
            const upLeft = y > 0 && x >= channels ? pixels[rowOffset - stride + x - channels] : 0;
            const reconstructed = filter === 0 ? value
                : filter === 1 ? value + left
                    : filter === 2 ? value + up
                        : filter === 3 ? value + Math.floor((left + up) / 2)
                            : filter === 4 ? value + paeth(left, up, upLeft)
                                : Number.NaN;
            if (!Number.isFinite(reconstructed)) {
                throw new Error(`unsupported PNG filter ${filter}`);
            }
            pixels[rowOffset + x] = reconstructed & 0xff;
        }
    }

    return { width, height, channels, pixels, hasAlpha: colorType === 4 || colorType === 6 };
}

const frameEntries = (atlas) => Array.isArray(atlas.frames)
    ? atlas.frames.map((frame) => [frame.filename, frame])
    : Object.entries(atlas.frames);

const frameHasVisiblePixel = (png, frame) => {
    if (!png.hasAlpha) return true;
    const alphaOffset = png.channels - 1;
    for (let y = frame.y; y < frame.y + frame.h; y += 1) {
        for (let x = frame.x; x < frame.x + frame.w; x += 1) {
            if (png.pixels[(y * png.width + x) * png.channels + alphaOffset] > 0) return true;
        }
    }
    return false;
};

export async function validateGameAssets(root = GAME_ROOT) {
    const errors = [];
    const atlasManifest = JSON.parse(await readFile(path.join(root, 'manifests/atlas_manifest.json'), 'utf8'));
    const animations = JSON.parse(await readFile(path.join(root, 'manifests/animations_manifest.json'), 'utf8'));
    const allFrameNames = new Set();
    const availableFrames = new Set();

    for (const [manifestKey, relativeBase] of Object.entries(ATLAS_FILES)) {
        const jsonPath = path.join(root, `${relativeBase}.json`);
        const pngPath = path.join(root, `${relativeBase}.png`);
        let atlas;
        let png;
        try {
            [atlas, png] = await Promise.all([
                readFile(jsonPath, 'utf8').then(JSON.parse),
                readFile(pngPath).then(decodePng),
            ]);
        } catch (error) {
            errors.push(`${manifestKey}: ${error instanceof Error ? error.message : String(error)}`);
            continue;
        }

        const manifestEntry = atlasManifest[manifestKey];
        if (!manifestEntry) {
            errors.push(`${manifestKey}: missing atlas manifest entry`);
            continue;
        }

        const entries = frameEntries(atlas);
        if (manifestEntry.frameCount !== entries.length) {
            errors.push(`${manifestKey}: manifest frameCount does not match atlas`);
        }
        if (manifestEntry.size?.w !== png.width || manifestEntry.size?.h !== png.height) {
            errors.push(`${manifestKey}: manifest dimensions do not match PNG`);
        }
        if (atlas.meta?.size?.w !== png.width || atlas.meta?.size?.h !== png.height) {
            errors.push(`${manifestKey}: atlas metadata dimensions do not match PNG`);
        }

        for (const [name, value] of entries) {
            if (allFrameNames.has(name)) errors.push(`${manifestKey}: duplicate frame name ${name}`);
            allFrameNames.add(name);
            availableFrames.add(name);
            const frame = value.frame;
            if (!frame || frame.x < 0 || frame.y < 0 || frame.w <= 0 || frame.h <= 0
                || frame.x + frame.w > png.width || frame.y + frame.h > png.height) {
                errors.push(`${manifestKey}: frame ${name} is outside PNG bounds`);
                continue;
            }
            if (manifestKey.endsWith('_atlas') && ['emma_atlas', 'orel_atlas', 'israel_atlas'].includes(manifestKey)
                && (value.sourceSize?.w !== CHARACTER_SOURCE_SIZE.w || value.sourceSize?.h !== CHARACTER_SOURCE_SIZE.h)) {
                errors.push(`${manifestKey}: frame ${name} has unexpected character source size`);
            }
            if (!frameHasVisiblePixel(png, frame)) {
                errors.push(`${manifestKey}: frame ${name} is fully transparent`);
            }
        }
    }

    for (const [group, states] of Object.entries(animations)) {
        if (!states || typeof states !== 'object') {
            errors.push(`animations manifest group ${group} is invalid`);
            continue;
        }
        for (const [state, frames] of Object.entries(states)) {
            if (!Array.isArray(frames) || frames.length === 0) {
                errors.push(`animation ${group}.${state} has no frames`);
                continue;
            }
            for (const frame of frames) {
                if (typeof frame !== 'string' || !availableFrames.has(frame)) {
                    errors.push(`animation ${group}.${state} references missing frame ${String(frame)}`);
                }
            }
        }
    }

    return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const errors = await validateGameAssets();
    if (errors.length > 0) {
        console.error(errors.join('\n'));
        process.exitCode = 1;
    } else {
        console.log('Validated 5 atlases and both manifests.');
    }
}
