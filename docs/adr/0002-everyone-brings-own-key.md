# Everyone brings an Own key

Mulakhas stays serverless: every user, family included, connects their own free Groq key (and optionally a Gemini key for Videos), and their browser talks to Groq and Google directly. The deployer pays nothing, a growing number of strangers cannot exhaust a shared free quota, and files never pass through anyone else's server. The cost is a one-time key setup per user, so that setup has to be short, guided and tested instantly.

## Considered Options

- **The deployer's key behind a server for everyone**: no keys for anyone, but one shared free quota runs out as strangers arrive.
- **Invite server** (a Cloudflare Worker holding the deployer's keys, with per-person daily allowances): solves it for family, but adds an account, setup commands and a server to maintain.
- **Setup links** (a link that installs the deployer's keys on a family member's phone): no server, but no per-person limits. Deferred; may return as a feature if family use shows it is needed.
- **On-device models**: see ADR-0003.
