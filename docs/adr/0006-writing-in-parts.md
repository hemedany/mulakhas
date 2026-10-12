# Big Threads are written in parts, learning the key's limit from Groq

Groq's free tier caps each writer at a few thousand tokens per minute, and counts the room asked for the answer in that cap, so a long Thread can't be written in one request. Mulakhas always tries the whole Thread once first: a paid key takes it, and a free key's refusal ("Limit 8000, Requested 12345") gives the real limit and what the prompt really cost, which replace the built-in guesses. Then it writes in parts:

- A **Summary** condenses groups of Messages into notes and writes the Result from them. The notes come back as JSON per Message number, and Mulakhas puts each Message's label back itself, so numbers and order never depend on the model; a Message the notes leave out keeps its own text.
- **Exact words** is never condensed, because it must not be shortened: each group is written word for word and the parts are joined in order, later parts without a title or a repeated heading.

Parts already written are kept until the Result is, so Try again carries on. A part Groq still refuses as too large means planning the parts again with what it said.

## Considered Options

- **Pace requests with Groq's `x-ratelimit-*` headers**: fewer 429s between parts, but `retry-after` already says how long to wait, so it was left for later.
- **Map-reduce Exact words too**: would shorten what users asked to keep whole.
