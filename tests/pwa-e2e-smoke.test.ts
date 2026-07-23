import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { InputController } from '../src/game/input/InputController';
import { MobileControls } from '../src/game/input/MobileControls';

const projectRoot = join(__dirname, '..');

const setViewport = (width: number, height: number): void => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
    window.dispatchEvent(new Event('resize'));
};

describe('PWA smoke checks', () => {
    let controls: MobileControls | undefined;
    let input: InputController | undefined;

    afterEach(() => {
        controls?.destroy();
        input?.destroy();
        controls = undefined;
        input = undefined;
        document.body.innerHTML = '';
    });

    it('keeps offline fallback and safe runtime cache rules in service worker', () => {
        const sw = readFileSync(join(projectRoot, 'public', 'sw.js'), 'utf8');
        expect(sw).toContain("request.mode === 'navigate'");
        expect(sw).toContain('OFFLINE_FALLBACK_URL');
        expect(sw).toContain('response.ok');
        expect(sw).toContain("requestUrl.origin !== self.location.origin");
    });

    it('keeps standalone layout and safe-area styles', () => {
        const css = readFileSync(join(projectRoot, 'public', 'style.css'), 'utf8');
        expect(css).toContain('env(safe-area-inset-top)');
        expect(css).toContain('body.standalone-mode');
        expect(css).toContain('#pwa-update-notice');
    });

    it('shows portrait warning and keeps controls in landscape for Android and iPhone viewports', () => {
        document.body.classList.add('standalone-mode');
        input = new InputController();
        controls = new MobileControls(input, document.body);
        expect(document.querySelector('[data-testid="mobile-controls-root"]')?.getAttribute('data-standalone')).toBe('true');

        setViewport(412, 915); // Android portrait
        const warning = document.querySelector('[data-testid="portrait-warning"]') as HTMLDivElement | null;
        expect(warning?.style.display).toBe('flex');

        setViewport(915, 412); // Android landscape
        expect(warning?.style.display).toBe('none');
        expect(document.querySelector('[data-testid="mobile-left"]')).toBeTruthy();
        expect(document.querySelector('[data-testid="mobile-right"]')).toBeTruthy();
        expect(document.querySelector('[data-testid="mobile-jump"]')).toBeTruthy();

        setViewport(390, 844); // iPhone portrait
        expect(warning?.style.display).toBe('flex');

        setViewport(844, 390); // iPhone landscape
        expect(warning?.style.display).toBe('none');
    });
});
