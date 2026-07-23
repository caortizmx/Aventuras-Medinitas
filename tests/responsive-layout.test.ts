import { describe, expect, it } from 'vitest';
import {
    calculateContainScale,
    calculateGameOverLayout,
    calculateLoadingLayout,
    calculateSafeArea,
    clamp,
} from '../src/game/layout/responsiveLayout';

describe('responsive layout helpers', () => {
    it('clamps values to the configured range', () => {
        expect(clamp(10, 4, 20)).toBe(10);
        expect(clamp(10, 14, 20)).toBe(14);
        expect(clamp(10, 24, 20)).toBe(20);
    });

    it('calculates a safe area entirely inside each supported viewport', () => {
        for (const [width, height] of [[1600, 900], [1280, 720], [844, 390], [932, 430], [390, 844], [320, 240]]) {
            const safe = calculateSafeArea(width, height);
            expect(safe.left).toBeGreaterThan(0);
            expect(safe.top).toBeGreaterThan(0);
            expect(safe.right).toBeLessThan(width);
            expect(safe.bottom).toBeLessThan(height);
            expect(safe.width).toBeGreaterThan(0);
            expect(safe.height).toBeGreaterThan(0);
        }
    });

    it('contains the loading logo without changing its aspect ratio', () => {
        expect(calculateContainScale(500, 108, 400, 100, 1)).toBeCloseTo(0.8);
        expect(calculateContainScale(500, 108, 1000, 500, 1)).toBe(1);
        expect(calculateContainScale(0, 108, 400, 100, 1)).toBe(0);
    });

    it('keeps loading progress and status inside the safe area', () => {
        for (const [width, height] of [[800, 450], [844, 390], [390, 844]]) {
            const layout = calculateLoadingLayout(width, height);
            expect(layout.logoY - layout.logoMaxHeight / 2).toBeGreaterThanOrEqual(layout.safeArea.top);
            expect(layout.progressY).toBeLessThan(layout.safeArea.bottom);
            expect(layout.statusY).toBeLessThan(layout.safeArea.bottom);
            expect(layout.progressWidth).toBeLessThanOrEqual(layout.safeArea.width);
        }
    });

    it('keeps the complete Game Over action stack inside the safe area', () => {
        for (const [width, height] of [[800, 450], [844, 390], [932, 430]]) {
            const layout = calculateGameOverLayout(width, height);
            const panelTop = layout.panelY - layout.panelHeight / 2;
            const panelBottom = layout.panelY + layout.panelHeight / 2;
            expect(panelTop).toBeGreaterThanOrEqual(layout.safeArea.top);
            expect(panelBottom).toBeLessThanOrEqual(layout.safeArea.bottom);
            expect(layout.titleFontSize).toBeLessThan(height / 3);
            expect(layout.retryButtonY - layout.buttonHeight / 2).toBeGreaterThan(panelTop);
            expect(layout.menuButtonY + layout.buttonHeight / 2).toBeLessThan(panelBottom);
            expect(layout.buttonHeight).toBeGreaterThanOrEqual(44);
        }
    });
});
