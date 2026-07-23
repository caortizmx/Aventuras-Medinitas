export type PlayerGameplayState = 'normal' | 'hurt' | 'invulnerable' | 'dead' | 'celebrating';

export type EnemyCollisionOutcome = 'stomp' | 'damage';

export interface EnemyCollisionSample {
    playerBottom: number;
    playerVelocityY: number;
    playerWasAboveEnemy: boolean;
    enemyTop: number;
    playerTouchingDown: boolean;
}

export interface LifeUpdateResult {
    lives: number;
    nextState: PlayerGameplayState;
    applied: boolean;
}

export interface PlayerRuntimeState {
    lives: number;
    state: PlayerGameplayState;
    invulnerableUntilMs: number;
}

export interface RespawnCandidate {
    x: number;
    y: number;
    id: string;
}

const STOMP_VELOCITY_MIN = 140;
const STOMP_ENEMY_TOP_TOLERANCE = 14;

export function classifyEnemyCollision(sample: EnemyCollisionSample): EnemyCollisionOutcome {
    const landingNearTop = sample.playerBottom <= sample.enemyTop + STOMP_ENEMY_TOP_TOLERANCE;
    const descendingFastEnough = sample.playerVelocityY >= STOMP_VELOCITY_MIN;
    const topContact = sample.playerTouchingDown || sample.playerWasAboveEnemy;

    if (landingNearTop && descendingFastEnough && topContact) {
        return 'stomp';
    }

    return 'damage';
}

export function applyLifeLoss(state: PlayerRuntimeState): LifeUpdateResult {
    if (state.state === 'invulnerable' || state.state === 'dead' || state.state === 'celebrating') {
        return { lives: state.lives, nextState: state.state, applied: false };
    }

    const nextLives = Math.max(0, state.lives - 1);
    return {
        lives: nextLives,
        nextState: nextLives <= 0 ? 'dead' : 'hurt',
        applied: true,
    };
}

export function startInvulnerability(nowMs: number, durationMs: number): number {
    return nowMs + durationMs;
}

export function resolveInvulnerabilityState(state: PlayerRuntimeState, nowMs: number): PlayerRuntimeState {
    if (state.state !== 'invulnerable') {
        return state;
    }

    if (nowMs >= state.invulnerableUntilMs) {
        return {
            ...state,
            state: 'normal',
            invulnerableUntilMs: 0,
        };
    }

    return state;
}

export function chooseSafeRespawn(
    candidates: RespawnCandidate[],
    isSafe: (candidate: RespawnCandidate) => boolean,
): RespawnCandidate | undefined {
    return candidates.find((candidate) => isSafe(candidate));
}

export function buildRespawnResetState(previous: PlayerRuntimeState, invulnerableUntilMs: number): PlayerRuntimeState {
    return {
        lives: previous.lives,
        state: 'invulnerable',
        invulnerableUntilMs,
    };
}
