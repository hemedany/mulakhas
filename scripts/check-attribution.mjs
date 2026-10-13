#!/usr/bin/env node
// House rule (AGENTS.md): commit messages and pull requests carry no AI or assistant attribution,
// and don't name the assistant tools used. Checks, and exits 1 naming each line it stops on:
//   check-attribution.mjs <file>…          a commit message file (the commit-msg hook)
//   check-attribution.mjs --range A..B     every commit message in a git range (CI)
//   PR_TEXT="…" check-attribution.mjs      a pull request's title and body (CI)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const BANNED = [
  /co-authored-by:/i,
  /generated (with|by)\b/i,
  /\bclaude\b/i,
  /\banthropic\b/i,
  /\bsub-?agents?\b/i,
  /\p{Extended_Pictographic}️?\s*generated/iu,
  // Names of assistant skills: say what was done, not which tool did it.
  /\b(find-animation-opportunities|review-animations|web-design-guidelines|break-ui|grill-with-docs|to-spec|to-tickets|writing-for-agents|mattpocock)\b/i,
]

const texts = []
const args = process.argv.slice(2)
if (args[0] === '--range') {
  const log = execFileSync('git', ['log', '--format=%H%n%B%x00', args[1]], { encoding: 'utf8' })
  for (const entry of log.split('\0').map(e => e.trim()).filter(Boolean)) {
    const [sha, ...message] = entry.split('\n')
    texts.push({ where: `commit ${sha.slice(0, 7)}`, text: message.join('\n') })
  }
} else {
  for (const file of args) texts.push({ where: file, text: readFileSync(file, 'utf8') })
}
if (process.env.PR_TEXT) texts.push({ where: 'pull request', text: process.env.PR_TEXT })

const found = []
for (const { where, text } of texts) {
  // Git's own comment lines in a message being written aren't part of it.
  for (const line of text.split('\n').filter(l => !l.startsWith('#'))) {
    if (BANNED.some(pattern => pattern.test(line))) found.push(`${where}: ${line.trim()}`)
  }
}
if (found.length) {
  console.error('Attribution or assistant tool names (see AGENTS.md, House rules):\n  ' + found.join('\n  '))
  process.exit(1)
}
