import { describe, expect, it } from 'vitest';
import {
    applyLifeLoss,
    buildRespawnResetState,
    chooseSafeRespawn,
    classifyEnemyCollision,
    resolveInvulnerabilityState,
    startInvulnerability,
    PlayerRuntimeState,
} from '../src/game/system/stage7Gameplay';

function runtime(state: Partial<PlayerRuntimeState>): PlayerRuntimeState {
    return {
        lives: 3,
        state: 'normal',
        invulnerableUntilMs: 0,
        ...state,
    };
}

describe('stage 7 lives and states', () => {
    it('reduces one life when player takes damage in normal state', () => {
        const result = applyLifeLoss(runtime({ lives: 3, state: 'normal' }));
        expect(result.applied).toBe(true);
        expect(result.lives).toBe(2);
        expect(result.nextState).toBe('hurt');
    });

    it('does not remove life while invulnerable', () => {
        const result = applyLifeLoss(runtime({ lives: 2, state: 'invulnerable', invulnerableUntilMs: 1200 }));
        expect(result.applied).toBe(false);
        expect(result.lives).toBe(2);
    });

    it('enters dead state when lives reach zero', () => {
        const result = applyLifeLoss(runtime({ lives: 1, state: 'normal' }));
        expect(result.lives).toBe(0);
        expect(result.nextState).toBe('dead');
    });
});

describe('stage 7 invulnerability timing', () => {
    it('starts invulnerability with explicit expiration timestamp', () => {
        expect(startInvulnerability(1000, 1200)).toBe(2200);
    });

    it('stays invulnerable before expiration and returns normal after expiration', () => {
        const invulnerable = runtime({ state: 'invulnerable', lives: 2, invulnerableUntilMs: 5000 });
        expect(resolveInvulnerabilityState(invulnerable, 4999).state).toBe('invulnerable');
        expect(resolveInvulnerabilityState(invulnerable, 5000).state).toBe('normal');
    });
});

describe('stage 7 checkpoint and respawn selection', () => {
    it('selects first safe candidate (checkpoint activation path)', () => {
        const selected = chooseSafeRespawn(
            [
                { id: 'cp-1', x: 300, y: 200 },
                { id: 'spawn', x: 100, y: 200 },
            ],
            (candidate) => candidate.id === 'cp-1',
        );
        expect(selected?.id).toBe('cp-1');
    });

    it('falls back to next candidate when first candidate is unsafe', () => {
        const selected = chooseSafeRespawn(
            [
                { id: 'cp-unsafe', x: 300, y: 200 },
                { id: 'spawn-safe', x: 100, y: 200 },
            ],
            (candidate) => candidate.id === 'spawn-safe',
        );
        expect(selected?.id).toBe('spawn-safe');
    });
});

describe('stage 7 enemy collision classification', () => {
    it('classifies stomp when descending and landing on top', () => {
        const outcome = classifyEnemyCollision({
            playerBottom: 200,
            enemyTop: 204,
            playerVelocityY: 240,
            playerWasAboveEnemy: true,
            playerTouchingDown: true,
        });
        expect(outcome).toBe('stomp');
    });

    it('classifies side or below hit as damage', () => {
        const outcome = classifyEnemyCollision({
            playerBottom: 220,
            enemyTop: 204,
            playerVelocityY: 20,
            playerWasAboveEnemy: false,
            playerTouchingDown: false,
        });
        expect(outcome).toBe('damage');
    });
});

describe('stage 7 state reset after respawn', () => {
    it('resets to invulnerable state after respawn with preserved remaining lives', () => {
        const reset = buildRespawnResetState(runtime({ state: 'hurt', lives: 2 }), 7777);
        expect(reset.state).toBe('invulnerable');
        expect(reset.lives).toBe(2);
        expect(reset.invulnerableUntilMs).toBe(7777);
    });
});
