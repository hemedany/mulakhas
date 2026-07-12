# Mulakhas ملخص

Drop a pile of voice notes, videos & texts — Arabic (incl. Syrian dialect), English, or any language — and get exactly the summary you asked for. Turn 15 rambling voice messages into one clean recipe.

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
- Interface in English, العربية, Français, Deutsch, Türkçe, Español

## Deploy your own

This is a single static file — host it anywhere:

- **Vercel:** import this repo at [vercel.com/new](https://vercel.com/new), zero config
- **GitHub Pages:** repo Settings → Pages → deploy from `main`

## Honest limits

Speech recognition on dialectal Arabic is genuinely hard — never trust the output 100%. Double-check quantities, names, and anything actionable. The reliability report flags what to re-listen to.

## License

MIT — do whatever you like with it.
