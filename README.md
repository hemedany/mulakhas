# Mulakhas ملخص

Drop a pile of voice notes, videos & texts — Arabic, English, or any language — and get exactly the summary you asked for. Turn 15 rambling voice messages into one clean recipe/directions/summary.

**Live app:** https://hemedany.github.io/mulakhas/

## How it works

Everything runs in your browser. Files are sent directly to Google's Gemini API using **your own free API key** — there is no server, no database, and nothing is stored anywhere except on your device.

1. Get a free Gemini API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (Google account, no credit card)
2. Open the app, paste the key once — it's saved on your device
3. Drop your voice notes / videos in order, slot text messages between them, say how you want it summarized
4. Get the result in English (or any language you ask for), with a per-message accuracy & noise report

## Features

- Ordered message timeline with insert-anywhere text messages
- Auto-sorts batched files by date (WhatsApp exports land in the right order)
- Understands Arabic dialects, English, and 100+ languages — no training needed
- Custom summary instructions + presets (recipe, action items, translation…)
- Reliability report: per-file clarity %, noise notes, uncertain words flagged as [unclear]
- Auto-retry when Google's servers are busy (503)
- Dark mode, RTL Arabic output, installable on your phone (Add to Home Screen)
- Summarize ↔ Exact-words (cleaned transcript) mode slider
- On-device, searchable history of past results
- Android: share voice notes & videos from WhatsApp straight into Mulakhas (installed PWA)
- Speak your request instead of typing (multi-language)
- Interface in English, العربية, Français, Deutsch, Türkçe, Español — everything translated, tutorial included, with RTL Arabic layout
- Living background: a non-overlapping field of layered khatam seals with depth, idle rotation, scroll-driven gearwork, and click-to-spin
- Buttery inertia scrolling on desktop

## Develop

Needs Node.js 24 or newer.

```bash
npm install
npm run dev        # http://localhost:5173/mulakhas/
npm test           # engine tests (Vitest)
npm run typecheck
npm run lint
npm run build      # static site in dist/
```

## Deploy your own

The build is a static site. On GitHub, set **Settings → Pages → Source** to **GitHub Actions**; every push to `main` then builds and publishes it (see `.github/workflows/deploy.yml`). To host it somewhere other than `/mulakhas/`, change `base` in `vite.config.ts`.

## Honest limits

Speech recognition on dialectal Arabic is genuinely hard — never trust the output 100%. Double-check quantities, names, and anything actionable. The reliability report flags what to re-listen to.

## License

MIT — do whatever you like with it.
