export interface RegisterPwaOptions {
    onUpdateAvailable?: (applyUpdate: () => void) => void;
}

export const isStandaloneMode = (): boolean =>
    window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

const unregisterForDevelopment = async (): Promise<void> => {
    if (!('serviceWorker' in navigator)) return;
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
};

export const registerPwa = async (
    options: RegisterPwaOptions = {},
    isProduction?: boolean,
): Promise<void> => {
    const productionMode = isProduction ?? import.meta.env.PROD;

    if (!productionMode) {
        await unregisterForDevelopment();
        return;
    }

    if (!('serviceWorker' in navigator)) return;

    let shouldReloadAfterControllerChange = false;
    const markForReloadOnControllerChange = () => {
        shouldReloadAfterControllerChange = true;
    };

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!shouldReloadAfterControllerChange) return;
        window.location.reload();
    });

    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    const emitUpdate = (worker: ServiceWorker): void => {
        options.onUpdateAvailable?.(() => {
            markForReloadOnControllerChange();
            worker.postMessage({ type: 'SKIP_WAITING' });
        });
    };

    if (registration.waiting) {
        emitUpdate(registration.waiting);
    }

    registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                emitUpdate(installingWorker);
            }
        });
    });
};
