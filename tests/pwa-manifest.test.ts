import { describe, expect, it } from 'vitest';
import manifestRaw from '../public/manifest.webmanifest?raw';

describe('PWA manifest', () => {
    it('is available with required install metadata', () => {
        const manifest = JSON.parse(manifestRaw) as {
            name: string;
            short_name: string;
            display: string;
            orientation: string;
            theme_color: string;
            background_color: string;
            start_url: string;
            icons: Array<{ src: string; sizes: string; type: string }>;
        };

        expect(manifest.name).toBe('The Adventures of Emma, Orel, and Israel');
        expect(manifest.short_name).toBe('Aventuras');
        expect(manifest.display).toBe('standalone');
        expect(manifest.orientation).toBe('landscape');
        expect(manifest.theme_color).toBe('#1a1a2e');
        expect(manifest.background_color).toBe('#0f0f0f');
        expect(manifest.start_url).toBe('./');
        expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
        expect(manifest.icons.some((icon) => icon.sizes === '192x192')).toBe(true);
        expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true);
    });
});
