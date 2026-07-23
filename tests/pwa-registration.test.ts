import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerPwa } from '../src/pwa/registerPwa';

describe('PWA registration', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('registers a service worker and exposes a user-controlled update action', async () => {
        const postMessage = vi.fn();
        const waitingWorker = { postMessage } as unknown as ServiceWorker;
        const registration = {
            waiting: waitingWorker,
            addEventListener: vi.fn(),
        } as unknown as ServiceWorkerRegistration;

        const register = vi.fn().mockResolvedValue(registration);
        const addEventListener = vi.fn();
        const getRegistrations = vi.fn().mockResolvedValue([]);

        Object.defineProperty(window.navigator, 'serviceWorker', {
            configurable: true,
            value: { register, addEventListener, getRegistrations, controller: {} },
        });

        let applyUpdate: (() => void) | undefined;
        await registerPwa({
            onUpdateAvailable: (apply) => {
                applyUpdate = apply;
            },
        }, true);

        expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
        expect(applyUpdate).toBeTypeOf('function');
        applyUpdate?.();
        expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    });

    it('avoids production registration flow during development', async () => {
        const unregister = vi.fn().mockResolvedValue(true);
        const getRegistrations = vi.fn().mockResolvedValue([{ unregister }]);
        const register = vi.fn();

        Object.defineProperty(window.navigator, 'serviceWorker', {
            configurable: true,
            value: { register, getRegistrations },
        });

        await expect(registerPwa({}, false)).resolves.toBeUndefined();

        expect(getRegistrations).toHaveBeenCalledTimes(1);
        expect(unregister).toHaveBeenCalledTimes(1);
        expect(register).not.toHaveBeenCalled();
    });
});
