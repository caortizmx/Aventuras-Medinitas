import StartGame from './game/main';
import { isStandaloneMode, registerPwa } from './pwa/registerPwa';

document.addEventListener('DOMContentLoaded', () => {
    if (isStandaloneMode()) {
        document.documentElement.classList.add('standalone-mode');
        document.body.classList.add('standalone-mode');
    }

    StartGame('game-container');
    const updateNotice = document.createElement('aside');
    updateNotice.id = 'pwa-update-notice';
    updateNotice.hidden = true;
    updateNotice.innerHTML = [
        '<p>A new version is ready. Apply it when you are in a safe screen (menu/pause).</p>',
        '<div class="pwa-update-actions">',
        '<button id="pwa-apply-update" type="button">Apply update</button>',
        '<button id="pwa-dismiss-update" type="button">Later</button>',
        '</div>',
    ].join('');
    document.body.appendChild(updateNotice);

    registerPwa({
        onUpdateAvailable: (applyUpdate) => {
            updateNotice.hidden = false;
            const applyButton = document.getElementById('pwa-apply-update');
            const dismissButton = document.getElementById('pwa-dismiss-update');

            if (applyButton instanceof HTMLButtonElement) {
                applyButton.onclick = () => {
                    updateNotice.hidden = true;
                    applyUpdate();
                };
            }

            if (dismissButton instanceof HTMLButtonElement) {
                dismissButton.onclick = () => {
                    updateNotice.hidden = true;
                };
            }
        },
    }).catch((error) => {
        // Prevent registration errors from interrupting game boot.
        if (import.meta.env.DEV) {
            console.warn('[PWA] service worker registration failed', error);
        }
    });

});