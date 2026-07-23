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

            applyButton?.addEventListener('click', () => {
                updateNotice.hidden = true;
                applyUpdate();
            }, { once: true });

            dismissButton?.addEventListener('click', () => {
                updateNotice.hidden = true;
            }, { once: true });
        },
    }).catch(() => {
        // Prevent registration errors from interrupting game boot.
    });

});