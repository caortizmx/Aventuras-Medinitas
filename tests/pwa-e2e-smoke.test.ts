import { afterEach, describe, expect, it } from 'vitest';
import { InputController } from '../src/game/input/InputController';
import { MobileControls } from '../src/game/input/MobileControls';
import mobileControlsSource from '../src/game/input/MobileControls.ts?raw';
import swRaw from '../public/sw.js?raw';

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
        expect(swRaw).toContain("request.mode === 'navigate'");
        expect(swRaw).toContain('OFFLINE_FALLBACK_URL');
        expect(swRaw).toContain('response.ok');
        expect(swRaw).toContain("requestUrl.origin !== self.location.origin");
    });

    it('keeps standalone layout and safe-area styles', () => {
        input = new InputController();
        controls = new MobileControls(input, document.body);
        const left = document.querySelector('[data-testid="mobile-left"]') as HTMLButtonElement | null;
        const root = document.querySelector('[data-testid="mobile-controls-root"]') as HTMLDivElement | null;

        expect(mobileControlsSource).toContain('safe-area-inset-left');
        expect(mobileControlsSource).toContain('safe-area-inset-bottom');
        expect(left).toBeTruthy();
        expect(root?.style.position).toBe('fixed');
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
