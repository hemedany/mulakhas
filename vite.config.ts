/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// The page may only talk to itself, Groq and Google's Generative Language API.
// Applied to production builds only: the dev server needs inline scripts for hot reload.
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' https://api.groq.com https://generativelanguage.googleapis.com",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'mulakhas-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    ],
  }
}

// The service worker (public/sw.js) keeps the app shell for the reload after each Share-in. Tell it
// this build's script and styles, under a cache name unique to the build, so it can keep them from
// the start and drop the previous build's. The fonts for the six languages' scripts (Latin and Arabic)
// are kept too, so the app looks right offline after one visit; other scripts' are kept as they are used.
function serviceWorkerShell(): Plugin {
  let outDir = 'dist'
  let files: string[] = []
  return {
    name: 'mulakhas-sw-shell',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir) },
    generateBundle(_, bundle) { files = Object.keys(bundle).filter(f => /\.(js|css)$/.test(f) || /-(latin|arabic)-.*\.woff2$/.test(f)).sort() },
    closeBundle() {
      const sw = resolve(outDir, 'sw.js')
      const placeholder = 'const BUILD = { version: "dev", files: [] };'
      const source = readFileSync(sw, 'utf8')
      if (!source.includes(placeholder)) throw new Error('sw.js: the BUILD placeholder is missing')
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 10)
      writeFileSync(sw, source.replace(placeholder, `const BUILD = ${JSON.stringify({ version, files })};`))
    },
  }
}

export default defineConfig({
  base: '/mulakhas/',
  plugins: [react(), tailwindcss(), contentSecurityPolicy(), serviceWorkerShell()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    // qa/ holds the browser smoke tests, which Playwright runs.
    include: ['src/**/*.test.ts'],
  },
})
