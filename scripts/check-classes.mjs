#!/usr/bin/env node
// Motion mistakes in Tailwind classes that no type checker sees (see src/styles/tokens.css):
//   - a press shrink (active:scale-*) whose transition doesn't name `scale`: Tailwind v4 shrinks
//     with the CSS scale property, so a list naming only `transform` makes the press snap;
//   - a transition without one of the theme's curves (ease-snappy, ease-drawer…);
//   - transition-all.
// Each class attribute is read whole, so classes chosen by a condition count together.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const files = (dir) => readdirSync(dir).flatMap(name => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : []
})

/** The value of each class-like attribute: "…", or {…} with balanced braces. */
function classAttributes(source) {
  const found = []
  for (const match of source.matchAll(/\b\w*[cC]lass(?:Name)?=/g)) {
    let at = match.index + match[0].length
    const line = source.slice(0, match.index).split('\n').length
    if (source[at] === '"') {
      const end = source.indexOf('"', at + 1)
      found.push({ line, text: source.slice(at + 1, end) })
    } else if (source[at] === '{') {
      let depth = 0
      const start = at
      for (; at < source.length; at++) {
        if (source[at] === '{') depth++
        if (source[at] === '}' && --depth === 0) break
      }
      found.push({ line, text: source.slice(start + 1, at) })
    }
  }
  return found
}

const problems = []
for (const file of files('src')) {
  for (const { line, text } of classAttributes(readFileSync(file, 'utf8'))) {
    const where = `${file}:${line}`
    const transition = /(?:^|[\s'"`])transition(?:-[\w[\],-]+)?(?=[\s'"`]|$)/.exec(text)?.[0].trim()
    if (/\btransition-all\b/.test(text)) problems.push(`${where}: transition-all; name the properties`)
    if (/active:scale-/.test(text) && !(transition && /^transition(-transform|-\[[^\]]*\bscale\b[^\]]*\])?$/.test(transition)))
      problems.push(`${where}: a press shrink (active:scale-*) needs \`scale\` in its transition (or transition-transform)`)
    if (transition && !/\bease-[a-z]/.test(text)) problems.push(`${where}: ${transition} without a theme curve (ease-snappy, ease-drawer)`)
  }
}
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
