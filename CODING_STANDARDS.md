# Coding standards

The judgement calls a review checks. Lint, types, tests and `scripts/` enforce the rest; `npm run lint`, `npm run typecheck`, `npm test` and `npm run test:browsers` say whether a change passes those.

## Words

- Code, copy, tests and comments use the terms in `GLOSSARY.md`, capitalised as there (a Thread of Messages, a Result, a Follow-up). A concept missing from the glossary is either invented (rename it) or a gap (add it there first).
- Interface copy is plain enough for someone who has never heard of an API: say what happened and what to do next. Every language in `src/i18n/strings.ts` gets every new string, written for that language, not a word-for-word copy.
- Comments say why, in sentences. A function gets one line on what it is for when its name can't carry it.

## Tests

- Behaviour is tested through the engine (`createEngine`), with Groq and Google faked at the network boundary (`src/engine/testing.ts`, `fixtures.ts`); nothing inside the engine is mocked. A test name is a sentence about what the person gets.
- A flow that only shows up in a real browser (sheets, the service worker, dictation, Share-in) gets a case in `qa/` instead.
- A fix comes with a test that fails without it. Prove that in a scratch copy of the old file, never by stashing or checking out in the shared checkout.

## Screens

- Colours, sizes, radii, durations and curves come from the tokens (`src/styles/tokens.css`, the `@theme` in `src/index.css`). Gold (`ornament`) dresses; actions are `accent`.
- Sides are logical (`start`, `end`, `ms-`, `pe-`) so Arabic mirrors for free; `rtl:` is for what logical properties can't express, such as a gradient's direction.
- Sheets are native `<dialog>`s through `Sheet` (ADR-0005).
- Motion moves `transform` and `opacity` only, stays under 300 ms unless it is a rare first-view moment, and is gentler, not absent, under reduced motion (fade instead of move).

## Data and privacy

- The page talks only to Groq and Google. A new endpoint changes the Content Security Policy in `vite.config.ts` and the Privacy section of the README in the same change.
- Keys live in local storage under `src/engine/storage-keys.ts` and are sent only to their own provider. New keys take the `m2.` prefix; v1's keys are only ever read.
- A failure reaches the person as a plain message with a way forward (Try again, connect a key, use a computer), never as a raw error.

## Dependencies

- A new runtime dependency has to earn its bytes on a phone: prefer the platform (native `<dialog>`, CSS animations, Web Audio) and a few lines of our own.
