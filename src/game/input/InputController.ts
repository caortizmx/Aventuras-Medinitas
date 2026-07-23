// InputController is intentionally Phaser-free so it can be tested without a
// canvas environment and reused across multiple scenes.

export interface InputState {
    left:  boolean;
    right: boolean;
    jump:  boolean;
    pause: boolean;
}

const KEYS_LEFT  = new Set(['ArrowLeft',  'KeyA']);
const KEYS_RIGHT = new Set(['ArrowRight', 'KeyD']);
const KEYS_JUMP  = new Set(['Space', 'ArrowUp', 'KeyW']);
const KEYS_PAUSE = new Set(['Escape', 'KeyP']);

/** Keys whose default browser action (scroll, zoom, …) should be suppressed. */
const PREVENT_DEFAULT = new Set([
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space',
    'KeyA', 'KeyD', 'KeyW',
]);

/**
 * Tracks logical input state for the game.
 *
 * Keyboard events and mobile-control callbacks both write to the same
 * `InputState` object, so gameplay code never reads DOM elements directly.
 *
 * Call {@link destroy} when the owning scene shuts down to remove all
 * DOM listeners and prevent stale handlers after scene restarts.
 */
export class InputController {
    private readonly _state: InputState = {
        left: false, right: false, jump: false, pause: false,
    };

    private readonly _onKeyDown: (e: KeyboardEvent) => void;
    private readonly _onKeyUp:   (e: KeyboardEvent) => void;
    private readonly _onBlur:    () => void;
    private readonly _onVis:     () => void;

    constructor() {
        this._onKeyDown = this._handleKeyDown.bind(this);
        this._onKeyUp   = this._handleKeyUp.bind(this);
        this._onBlur    = this.resetAll.bind(this);
        this._onVis     = () => { if (document.hidden) this.resetAll(); };

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup',   this._onKeyUp);
        window.addEventListener('blur',    this._onBlur);
        document.addEventListener('visibilitychange', this._onVis);
    }

    // ── Keyboard handling ──────────────────────────────────────────────────────

    private _handleKeyDown(e: KeyboardEvent): void {
        if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();

        if (KEYS_LEFT.has(e.code))  { this._state.left  = true; return; }
        if (KEYS_RIGHT.has(e.code)) { this._state.right = true; return; }
        if (KEYS_JUMP.has(e.code))  { this._state.jump  = true; return; }
        if (KEYS_PAUSE.has(e.code)) { this._state.pause = true; }
    }

    private _handleKeyUp(e: KeyboardEvent): void {
        if (KEYS_LEFT.has(e.code))  { this._state.left  = false; return; }
        if (KEYS_RIGHT.has(e.code)) { this._state.right = false; return; }
        if (KEYS_JUMP.has(e.code))  { this._state.jump  = false; return; }
        if (KEYS_PAUSE.has(e.code)) { this._state.pause = false; }
    }

    // ── Mobile-control setters (called by MobileControls) ─────────────────────

    setLeft(value: boolean):  void { this._state.left  = value; }
    setRight(value: boolean): void { this._state.right = value; }
    setJump(value: boolean):  void { this._state.jump  = value; }
    setPause(value: boolean): void { this._state.pause = value; }

    // ── Public API ────────────────────────────────────────────────────────────

    /** Read-only snapshot; the object reference is stable across frames. */
    getState(): Readonly<InputState> { return this._state; }

    /**
     * Clear every active input.  Called on game pause, browser blur, and
     * visibility change so movement cannot get stuck between events.
     */
    resetAll(): void {
        this._state.left  = false;
        this._state.right = false;
        this._state.jump  = false;
        this._state.pause = false;
    }

    /** Remove all DOM event listeners.  Must be called on scene shutdown. */
    destroy(): void {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup',   this._onKeyUp);
        window.removeEventListener('blur',    this._onBlur);
        document.removeEventListener('visibilitychange', this._onVis);
        this.resetAll();
    }
}
