# Mulakhas

Turns a Thread of voice notes, videos and text messages into one Result. Vocabulary lives in `GLOSSARY.md`; past decisions in `docs/adr/`.

## Agent skills

### Issue tracker

Issues and specs are GitHub issues on `hemedany/mulakhas`, managed with `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Code review

Writing or reviewing code: the judgement calls are in `CODING_STANDARDS.md`. A review runs in its own git worktree; see `docs/agents/code-review.md`.

## House rules

- No AI or assistant attribution anywhere: no `Co-Authored-By` trailers, no "generated with" lines in commits, PRs, issues or docs.
