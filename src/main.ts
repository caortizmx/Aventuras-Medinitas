import StartGame from './game/main';
import { isStandaloneMode, registerPwa } from './pwa/registerPwa';

document.addEventListener('DOMContentLoaded', () => {
    if (isStandaloneMode()) {
        document.documentElement.classList.add('standalone-mode');
        document.body.classList.add('standalone-mode');
    }

    const game = StartGame('game-container');
    if (import.meta.env.DEV) {
        window.__PHASER_GAME__ = game;
    }
    const updateNotice = document.createElement('aside');
    updateNotice.id = 'pwa-update-notice';
    updateNotice.hidden = true;
    const updateMessage = document.createElement('p');
    updateMessage.textContent = 'A new version is ready. Apply it when you are in a safe screen (menu/pause).';

    const updateActions = document.createElement('div');
    updateActions.className = 'pwa-update-actions';

    const applyButton = document.createElement('button');
    applyButton.id = 'pwa-apply-update';
    applyButton.type = 'button';
    applyButton.textContent = 'Apply update';

    const dismissButton = document.createElement('button');
    dismissButton.id = 'pwa-dismiss-update';
    dismissButton.type = 'button';
    dismissButton.textContent = 'Later';

    updateActions.appendChild(applyButton);
    updateActions.appendChild(dismissButton);
    updateNotice.appendChild(updateMessage);
    updateNotice.appendChild(updateActions);
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