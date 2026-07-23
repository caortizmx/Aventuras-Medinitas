import { InputController } from './InputController';

interface BtnCfg {
    label:      string;
    positionCss: string;
    dataTestId: string;
    onDown:     () => void;
    onUp:       () => void;
}

/**
 * Creates fixed-to-screen DOM touch buttons and a portrait-orientation warning.
 * Feeds input directly into an {@link InputController} so gameplay code never
 * reads DOM elements.  Call {@link destroy} on scene shutdown.
 */
export class MobileControls {
    private readonly _root: HTMLDivElement;
    private readonly _warning: HTMLDivElement;
    private readonly _onResize: () => void;

    constructor(input: InputController, parent: HTMLElement) {
        this._root = document.createElement('div');
        Object.assign(this._root.style, {
            position:       'fixed',
            inset:          '0',
            pointerEvents:  'none',
            zIndex:         '10',
            userSelect:     'none',
            webkitUserSelect: 'none',
        } satisfies Partial<CSSStyleDeclaration>);
        this._root.dataset.testid = 'mobile-controls-root';
        if (document.body.classList.contains('standalone-mode')) {
            this._root.dataset.standalone = 'true';
        }
        parent.appendChild(this._root);

        // ── Buttons ──────────────────────────────────────────────────────────
        const btns: BtnCfg[] = [
            {
                label: '◀',
                positionCss: 'left:max(16px, env(safe-area-inset-left));bottom:max(24px, env(safe-area-inset-bottom))',
                dataTestId: 'mobile-left',
                onDown: () => input.setLeft(true),
                onUp:   () => input.setLeft(false),
            },
            {
                label: '▶',
                positionCss: 'left:calc(max(16px, env(safe-area-inset-left)) + 72px);bottom:max(24px, env(safe-area-inset-bottom))',
                dataTestId: 'mobile-right',
                onDown: () => input.setRight(true),
                onUp:   () => input.setRight(false),
            },
            {
                label: '▲',
                positionCss: 'right:max(16px, env(safe-area-inset-right));bottom:max(24px, env(safe-area-inset-bottom))',
                dataTestId: 'mobile-jump',
                onDown: () => input.setJump(true),
                onUp:   () => input.setJump(false),
            },
            {
                label: '⏸',
                positionCss: 'right:calc(max(16px, env(safe-area-inset-right)) + 84px);bottom:calc(max(24px, env(safe-area-inset-bottom)) + 56px)',
                dataTestId: 'mobile-pause',
                onDown: () => input.setPause(true),
                onUp:   () => input.setPause(false),
            },
        ];

        for (const cfg of btns) {
            this._root.appendChild(this._makeBtn(cfg));
        }

        // ── Portrait warning ─────────────────────────────────────────────────
        this._warning = document.createElement('div');
        this._warning.style.cssText = [
            'position:fixed', 'inset:0',
            'background:rgba(0,0,0,0.88)',
            'color:#fff',
            'display:flex',
            'flex-direction:column',
            'align-items:center',
            'justify-content:center',
            'font-family:sans-serif',
            'font-size:22px',
            'text-align:center',
            'z-index:20',
            'pointer-events:auto',
            'padding:24px',
        ].join(';');
        this._warning.dataset.testid = 'portrait-warning';
        this._warning.innerHTML =
            '<div style="font-size:48px;margin-bottom:16px">📱</div>' +
            '<p style="margin:0">Please rotate your device<br>to <strong>landscape</strong> to play.</p>';
        this._root.appendChild(this._warning);

        this._onResize = () => this._updateWarning();
        window.addEventListener('resize', this._onResize);
        window.addEventListener('orientationchange', this._onResize);
        this._updateWarning();
    }

    private _makeBtn(cfg: BtnCfg): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.textContent = cfg.label;
        btn.dataset.testid = cfg.dataTestId;
        btn.style.cssText = [
            'position:fixed',
            'width:64px', 'height:64px',
            'border-radius:50%',
            'border:3px solid rgba(255,255,255,0.55)',
            'background:rgba(0,0,0,0.45)',
            'color:#fff',
            'font-size:26px',
            'pointer-events:auto',
            'user-select:none',
            '-webkit-user-select:none',
            'touch-action:none',
            'cursor:pointer',
            '-webkit-tap-highlight-color:transparent',
            cfg.positionCss,
        ].join(';');

        const down = (e: Event): void => { e.preventDefault(); cfg.onDown(); };
        const up   = (e: Event): void => { e.preventDefault(); cfg.onUp(); };

        btn.addEventListener('pointerdown',   down, { passive: false });
        btn.addEventListener('pointerup',     up,   { passive: false });
        btn.addEventListener('pointercancel', up,   { passive: false });
        btn.addEventListener('pointerleave',  up,   { passive: false });
        btn.addEventListener('contextmenu',   (e) => e.preventDefault());

        return btn;
    }

    private _updateWarning(): void {
        this._warning.style.display =
            window.innerHeight > window.innerWidth ? 'flex' : 'none';
    }

    /** Remove all DOM nodes and event listeners. */
    destroy(): void {
        window.removeEventListener('resize', this._onResize);
        window.removeEventListener('orientationchange', this._onResize);
        this._root.remove();
    }
}
