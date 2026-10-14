# Dictation uses the browser's own speech engine where it can

Dictating a Request or Follow-up should show words as they are spoken, and only the browser's own speech engine (the Web Speech API in Chrome, Edge, Safari and Samsung Internet) can do that. So where one is available, dictation goes to it, which means the person's voice goes to that browser maker's speech service (Google, Apple, Microsoft or Samsung) under their browser's terms, not to Groq. Nothing else Mulakhas hears goes there: Voice notes and Videos only ever go to Groq and Google with the person's Own key (ADR-0001, ADR-0002).

Where there is no engine (Firefox), one known not to work (Brave), or one that refuses (in-app browsers, Safari with Dictation turned off), the app listens to the microphone, cuts it at each pause, and Whisper writes down each phrase with the Groq key, so words appear after each pause instead.

## Considered Options

- **Whisper for all dictation**: one service, no browser makers involved, but words would only ever appear after a pause, and every pause costs a request on the free tier.
- **A speech model in the page**: ruled out with on-device models generally (ADR-0003).

## Later: the language is chosen

(October 2026.) Dictation listened in the interface language, so with the app in English an Arabic Request came out wrong. A chip beside the mic now chooses what dictation listens for: one of the six languages, which the browser's engine takes where it can as above, or *Any language*, which goes to Whisper phrase by phrase, because only Whisper can tell which language is spoken.
