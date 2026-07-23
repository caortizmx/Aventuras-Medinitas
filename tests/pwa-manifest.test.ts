import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = join(__dirname, '..');
const manifestPath = join(projectRoot, 'public', 'manifest.webmanifest');

describe('PWA manifest', () => {
    it('is available with required install metadata', () => {
        expect(existsSync(manifestPath)).toBe(true);

        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
            name: string;
            short_name: string;
            display: string;
            orientation: string;
            theme_color: string;
            background_color: string;
            start_url: string;
            icons: Array<{ src: string }>;
        };

        expect(manifest.name).toBe('The Adventures of Emma, Orel, and Israel');
        expect(manifest.short_name).toBe('Aventuras');
        expect(manifest.display).toBe('standalone');
        expect(manifest.orientation).toBe('landscape');
        expect(manifest.theme_color).toBe('#1a1a2e');
        expect(manifest.background_color).toBe('#0f0f0f');
        expect(manifest.start_url).toBe('./');
        expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

        for (const icon of manifest.icons) {
            const normalizedPath = icon.src.replace(/^\//, '');
            expect(existsSync(join(projectRoot, 'public', normalizedPath))).toBe(true);
        }
    });
});
