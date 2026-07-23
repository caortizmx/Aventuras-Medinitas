/**
 * Tests for Phaser-independent logic:
 *  1. Horizontal input state
 *  2. Jump input state
 *  3. Input reset
 *  4. Respawn position constants
 *  5. Valid jump state / no double-jump (canJump helper)
 *  6. Pause input reset
 *
 * The tests run in jsdom (no canvas / WebGL / Phaser runtime needed).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InputController } from '../src/game/input/InputController';
import {
    SPAWN_X, SPAWN_Y,
    WORLD_WIDTH, WORLD_HEIGHT,
    GROUND_HEIGHT, PLAYER_HEIGHT,
    KILL_ZONE_Y,
} from '../src/game/constants/gameValues';

// ── Pure helper (extracted from scene logic) ──────────────────────────────────

/**
 * Determines whether a jump action should be triggered this frame.
 *
 * @param grounded      Whether the player is touching the ground.
 * @param jumpPressed   Current jump-button state.
 * @param prevJump      Jump-button state from the previous frame.
 */
function canJump(grounded: boolean, jumpPressed: boolean, prevJump: boolean): boolean {
    return grounded && jumpPressed && !prevJump;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

let ctrl: InputController;

beforeEach(() => { ctrl = new InputController(); });
afterEach(() => { ctrl.destroy(); });

// ── 1. Horizontal input state ─────────────────────────────────────────────────

describe('horizontal input state', () => {
    it('starts with left and right false', () => {
        const s = ctrl.getState();
        expect(s.left).toBe(false);
        expect(s.right).toBe(false);
    });

    it('setLeft(true) sets left', () => {
        ctrl.setLeft(true);
        expect(ctrl.getState().left).toBe(true);
    });

    it('setRight(true) sets right', () => {
        ctrl.setRight(true);
        expect(ctrl.getState().right).toBe(true);
    });

    it('left and right can both be true simultaneously', () => {
        ctrl.setLeft(true);
        ctrl.setRight(true);
        const s = ctrl.getState();
        expect(s.left).toBe(true);
        expect(s.right).toBe(true);
    });

    it('setLeft(false) clears left', () => {
        ctrl.setLeft(true);
        ctrl.setLeft(false);
        expect(ctrl.getState().left).toBe(false);
    });
});

// ── 2. Jump input state ───────────────────────────────────────────────────────

describe('jump input state', () => {
    it('starts with jump false', () => {
        expect(ctrl.getState().jump).toBe(false);
    });

    it('setJump(true) sets jump', () => {
        ctrl.setJump(true);
        expect(ctrl.getState().jump).toBe(true);
    });

    it('setJump(false) clears jump', () => {
        ctrl.setJump(true);
        ctrl.setJump(false);
        expect(ctrl.getState().jump).toBe(false);
    });
});

// ── 3. Input reset ────────────────────────────────────────────────────────────

describe('input reset', () => {
    it('resetAll clears all active inputs', () => {
        ctrl.setLeft(true);
        ctrl.setRight(true);
        ctrl.setJump(true);
        ctrl.setPause(true);

        ctrl.resetAll();

        const s = ctrl.getState();
        expect(s.left).toBe(false);
        expect(s.right).toBe(false);
        expect(s.jump).toBe(false);
        expect(s.pause).toBe(false);
    });

    it('resetAll on already-clear state is idempotent', () => {
        ctrl.resetAll();
        ctrl.resetAll();
        const s = ctrl.getState();
        expect(s.left).toBe(false);
        expect(s.right).toBe(false);
    });
});

// ── 4. Respawn position ───────────────────────────────────────────────────────

describe('respawn position constants', () => {
    it('SPAWN_X is within world width', () => {
        expect(SPAWN_X).toBeGreaterThan(0);
        expect(SPAWN_X).toBeLessThan(WORLD_WIDTH);
    });

    it('SPAWN_Y places player above ground (player bottom touches ground top)', () => {
        // Ground top is at WORLD_HEIGHT - GROUND_HEIGHT = e.g. 410
        const groundTop = WORLD_HEIGHT - GROUND_HEIGHT;
        // Player center is SPAWN_Y; bottom = SPAWN_Y + PLAYER_HEIGHT/2
        const playerBottom = SPAWN_Y + PLAYER_HEIGHT / 2;
        expect(playerBottom).toBeLessThanOrEqual(groundTop + 1); // +1 for float tolerance
    });

    it('SPAWN_Y is above the kill zone', () => {
        expect(SPAWN_Y).toBeLessThan(KILL_ZONE_Y);
    });
});

// ── 5. Valid jump state / no double-jump ─────────────────────────────────────

describe('canJump (no double-jump logic)', () => {
    it('returns true when grounded, jump just pressed, prev was false', () => {
        expect(canJump(true, true, false)).toBe(true);
    });

    it('returns false when not grounded', () => {
        expect(canJump(false, true, false)).toBe(false);
    });

    it('returns false when jump button is held (prev also true)', () => {
        // Prevents repeated jumps from a held button
        expect(canJump(true, true, true)).toBe(false);
    });

    it('returns false when jump button is not pressed', () => {
        expect(canJump(true, false, false)).toBe(false);
    });

    it('returns false when in the air with button just pressed', () => {
        // Airborne + fresh press = still no jump
        expect(canJump(false, true, false)).toBe(false);
    });
});

// ── 6. Pause input reset ──────────────────────────────────────────────────────

describe('pause input reset', () => {
    it('setPause(true) sets pause flag', () => {
        ctrl.setPause(true);
        expect(ctrl.getState().pause).toBe(true);
    });

    it('resetAll called on pause clears all inputs including pause', () => {
        ctrl.setLeft(true);
        ctrl.setJump(true);
        ctrl.setPause(true);

        // Simulate what the scene does when pause is triggered
        ctrl.resetAll();

        const s = ctrl.getState();
        expect(s.pause).toBe(false);
        expect(s.left).toBe(false);
        expect(s.jump).toBe(false);
    });

    it('state object reference is stable (no new object per call)', () => {
        const s1 = ctrl.getState();
        ctrl.setLeft(true);
        const s2 = ctrl.getState();
        expect(s1).toBe(s2);
    });
});
