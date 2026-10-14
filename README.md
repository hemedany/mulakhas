# Mulakhas ملخّص

Turn a pile of WhatsApp voice notes, videos and text messages (in Arabic dialects, English or a mix) into one clear result: a summary, a recipe, numbered steps, a to-do list, a translation, or every word written out.

**Live app:** https://hemedany.github.io/mulakhas/

## How it works

1. **Add the messages** in the order they were sent: pick files, drag them in on a computer, or on Android share them straight from WhatsApp into the installed app, a few at a time. Text messages can go anywhere in between.
2. **Mulakhas hears each one as it arrives.**
   - Voice notes go to Groq's Whisper (`whisper-large-v3`), which returns a transcript with a confidence for every passage. Passages it heard poorly are marked as unclear rather than guessed.
   - Videos, when you've connected a Gemini key, are watched by the newest Gemini Flash model your key can use. It reports what is said and what the video shows. Without a Gemini key, Whisper hears the soundtrack.
   - Files over Groq's size limit, or in formats Whisper rejects (`.mov`, `.3gp`, `.aac`…), are converted in your browser to mono 16 kHz audio and heard in parts of about ten minutes, cut at a pause.
3. **Say what you want**: pick a preset or type, or speak, your own Request, in any language (the chip beside the mic says which). *Exact words* writes everything out as it was said instead of summarising.
4. **A Groq text model writes the Result** (`gpt-oss-120b` when your key has it) from the transcripts, in order, so later messages can correct earlier ones. A Thread too big for your key's per-minute limit is written in parts.
5. **The Reliability report** under the Result shows how clearly each voice note was heard, measured from Whisper's confidence and not graded by a model. Then ask Follow-up questions about the Result.

## Your own keys

Mulakhas has no server and no shared key: everyone uses their own.

- **Groq key**, required and free: [console.groq.com/keys](https://console.groq.com/keys). Mulakhas asks for it the first time you add a message.
- **Gemini key**, optional and free: [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Add it in Settings so videos are watched as well as heard.

## Privacy

- **No server, no account, no analytics.** The page talks only to Groq and Google, straight from your browser, with your keys. Its Content Security Policy allows nothing else.
- **What goes where:**
  - Voice notes go to Groq.
  - Videos go to Google when a Gemini key is connected, otherwise to Groq. Mulakhas deletes the upload as soon as it has been watched; Google would otherwise keep it for two days.
  - Transcripts, your Request and Follow-ups go to Groq to be written up.
- **Dictation:** where your browser has a speech engine (Chrome, Edge, Safari, Samsung Internet), live dictation uses it, and your voice goes to that browser maker's speech service under your browser's terms. Elsewhere, and when you choose *Any language*, each phrase goes to Groq, which tells the language. Dictation only fills the Request and Follow-up boxes.
- **On your device:** keys and settings live in the browser's local storage; the Thread, its files and your saved Results live in its IndexedDB. *Start over*, deleting a saved Result, and removing a key clear them.
- Groq's and Google's own terms apply to what you send them.

## Features

- Six interface languages (العربية, English, Français, Deutsch, Türkçe, Español), right to left in Arabic, with the Result in your language unless you ask for another.
- Messages ordered by when they were sent (WhatsApp file names first), moved with the arrows beside them, removed with Undo, and with text messages placed anywhere.
- Presets: recipe, step by step, to-do list, key points, translation, and Exact words.
- Busy services are waited out automatically, as long as they ask.
- The Result first: the messages fold away above it until you want them.
- Searchable History of Results and their Follow-ups, on your device, and *New* in the header to start again.
- Installable on your phone; on Android, share voice notes from WhatsApp in as many goes as you like and they all stay together.
- Light and dark themes that follow your device, with a manual choice.
- A short tour on the first visit, and again from the ? button.

## Develop

Needs Node.js 24 or newer.

```bash
npm install
npm run dev        # http://localhost:5173/mulakhas/
npm test           # engine and dictation tests (Vitest)
npm run typecheck
npm run lint
npm run build      # static site in dist/
```

The engine (`src/engine`) holds everything below the screens and is tested with Groq and Google faked at the network boundary. The words the code and copy use are in `GLOSSARY.md`; decisions and their reasons are in `docs/adr/`.

## Deploy your own

The build is a static site. On GitHub, set **Settings → Pages → Source** to **GitHub Actions**; every push to `main` then builds and publishes it (see `.github/workflows/deploy.yml`). To host it somewhere other than `/mulakhas/`, change `base` in `vite.config.ts`.

## Honest limits

- Speech recognition on dialectal Arabic is hard. Never trust a Result completely: double-check quantities, names and anything you'll act on. The Reliability report and the unclear marks show what to listen to again.
- Sharing from WhatsApp into the app works on Android only, in an installed browser that supports it (not Firefox, not iPhone). Elsewhere, save the voice notes and pick them as files.
- Some old phones record in AMR, which browsers can't open. Mulakhas says so; with a Gemini key, Videos in that format can still be watched.
- Very long recordings are decoded in the browser, which can run out of memory on older phones. Mulakhas notices and says the file is too long for the device.

## License

MIT. Do whatever you like with it.
