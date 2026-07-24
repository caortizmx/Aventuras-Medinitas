import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    // Playwright clears this directory at the start of each test run.
    outputDir: './test-results/playwright',
    use: {
        baseURL: 'http://127.0.0.1:8080',
        browserName: 'chromium',
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        serviceWorkers: 'block',
    },
    webServer: {
        command: 'npm run dev-nolog -- --host 127.0.0.1',
        url: 'http://127.0.0.1:8080',
        reuseExistingServer: !process.env.CI,
    },
});
