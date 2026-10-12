# No on-device models (for now)

Running the models in the user's browser would remove keys and cost, but in October 2026 it means a 560 MB download for a dialect-capable Whisper plus about 3 GB for a summarising model (Gemma 3n E2B), slower-than-real-time transcription on most phones, and pages killed for memory on iPhones. Chrome's built-in Gemini Nano is desktop-only. Mulakhas is used mostly on phones by non-technical people, so we stay with hosted models. Hosting the weights on GitHub Pages would not help: the phone still downloads and runs them, and Pages caps a site at 1 GB.

Revisit as an optional offline mode for laptops if browser models get smaller or phone support improves.
