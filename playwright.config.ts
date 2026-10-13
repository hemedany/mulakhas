import { defineConfig, devices } from '@playwright/test'

// Browser smoke tests (qa/): the production build in real browsers, with Groq stubbed at the
// network. WebKit needs system libraries that `playwright install --with-deps` sets up on Ubuntu,
// so it runs in CI, and locally only when PLAYWRIGHT_WEBKIT is set.
const PORT = 4317
const withWebKit = !!process.env.CI || !!process.env.PLAYWRIGHT_WEBKIT
const desktop = { width: 1440, height: 900 }

export default defineConfig({
  testDir: 'qa',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/mulakhas/`,
    // Tests that need the service worker allow it themselves; elsewhere it would sit between the page and the stubs.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: desktop } },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: desktop,
        // A fake microphone, allowed without asking, for dictation.
        launchOptions: { firefoxUserPrefs: { 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': true } },
      },
    },
    { name: 'phone', use: devices['Pixel 7'] },
    ...(withWebKit
      ? [
          { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: desktop } },
          { name: 'iphone', use: devices['iPhone 15'] },
        ]
      : []),
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/mulakhas/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
