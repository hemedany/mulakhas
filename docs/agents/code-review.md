# Code review

How a review of a change runs in this repo.

## Its own worktree

Each review runs in a git worktree of its own, never in the checkout the author is working in:

```bash
git worktree add ../mulakhas-review-<topic> <branch-or-commit>
```

Reviews often run while the author keeps working, or several at once. In a shared checkout, one run's `git stash`, `git checkout` or test edit lands in someone else's work tree; that has lost a file here before. Remove the worktree with `git worktree remove` when the review is done.

To show a test fails without a fix, copy the old file into the review's worktree (or a scratch directory) and run the test there.

## What it checks

`CODING_STANDARDS.md` holds the judgement calls; lint, types and tests already cover the rest. Findings name the file and line and say what goes wrong for the person using Mulakhas, or for the next change.
