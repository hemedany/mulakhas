# Invites run on the Owner's keys; everyone else brings an Own key

Non-technical users (the Owner's family) must never see a provider key, but strangers must not drain the Owner's free quota. Invites send requests through a small Owner-run Cloudflare Worker that holds the Owner's keys and enforces a Daily allowance per Invite. Everyone else connects an Own key once, and their browser talks to Groq and Google directly, so the Owner pays nothing for them and never sees their files.

## Considered Options

- **Own key for everyone** (v1.0): free and scales, but confused non-technical users.
- **Owner's key for everyone**: no keys for anyone, but one shared free quota runs out as strangers arrive.
- **On-device models**: see ADR-0003.
- **Vercel functions as the proxy**: rejected because Vercel's 4.5 MB request-body cap is smaller than many Voice notes.
