# Each provider does the job it is best at

Mulakhas no longer sends whole Threads to one multimodal model. Groq Whisper (`whisper-large-v3`) hears Voice notes, Gemini Flash watches Videos, and a Groq text model writes the Result from the Transcripts in Thread order. Whisper is the most accurate option we found for dialectal Arabic and returns per-segment confidence, so the Reliability report is measured rather than self-graded by the model; Gemini stays only where seeing the picture matters.

## Considered Options

- **Gemini for everything** (v1.0): one call, but opaque; clarity percentages were the model grading itself.
- **Groq for everything**: Groq has no production vision model, so silent Videos would yield nothing.

## Consequences

- A Video falls back to Whisper on its soundtrack when no Gemini key is available.
- Groq's free tier caps tokens per minute, so a very large Thread has to be written in parts.
