// Finds token drift in components/ui: literal colors, default-palette utilities, raw easing curves.
// Usage: node scripts/audit-tokens.mjs [--json] [--update] [--check] [--root <dir>]
// A deliberate literal (brand mark, mask alpha, art material) is exempt when its line, or the comment line above it,
// carries `token-audit-ignore: <reason>`. Exempt hits are still counted and listed, never silently dropped. Mask lines are skipped outright.
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const args = process.argv.slice(2)
const flag = name => args.includes(name)
const rootArg = args.indexOf("--root")
const repo = fileURLToPath(new URL("..", import.meta.url))
if (rootArg >= 0 && flag("--update")) { console.error("--root cannot be combined with --update: the baseline only describes components/ui."); process.exit(1) }
const root = rootArg >= 0 ? resolve(args[rootArg + 1]) : join(repo, "components/ui")
const baselineFile = join(repo, "scripts/token-audit-baseline.json")
const CATS = ["color", "palette", "motion"]

const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [])

const names = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose"
const palette = new RegExp(`(?<![\\w-])(?:bg|text|border(?:-[xytblrse])?|ring(?:-offset)?|fill|stroke|from|via|to|shadow|outline|divide|decoration|accent|caret|placeholder)-(?:white|black|(?:${names})-\\d{2,3})(?![\\w-])`, "g")
// "_" is a Tailwind arbitrary-value separator, so `#b9c2ff_70%` still counts.
const hex = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z-])/g
const fn = /(?<![a-zA-Z0-9-])(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g
const bezierFn = /cubic-bezier\(([^)]*)\)/g
const num = String.raw`-?(?:\d*\.)?\d+`
const arr = new RegExp(`\\[\\s*(${num})\\s*,\\s*(${num})\\s*,\\s*(${num})\\s*,\\s*(${num})\\s*\\]`, "g")

// Text from an opening "(" to its matching ")".
const balanced = (s, open) => {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === "(") depth++
    else if (s[i] === ")" && --depth === 0) return s.slice(open, i + 1)
  }
  return s.slice(open)
}

function scan(line) {
  const hits = []
  for (const m of line.matchAll(palette)) hits.push(["palette", m[0]])
  for (const m of line.matchAll(fn)) {
    const call = balanced(line, m.index + m[0].length - 1)
    if (/\bfrom\b|var\(/.test(call)) continue // relative / token-derived
    hits.push(["color", m[0] + call.slice(1).slice(0, 40)])
  }
  for (const m of line.matchAll(hex)) {
    const before = line.slice(Math.max(0, m.index - 6), m.index)
    if (/url\($|href=["']$/.test(before)) continue // fragment ids
    if (m[0].length === 5 && /^#\d+$/.test(m[0])) continue // "#4182" ticket numbers
    hits.push(["color", m[0]])
  }
  for (const m of line.matchAll(bezierFn)) if (!m[1].includes("${")) hits.push(["motion", m[0]])
  if (/ease|bezier|cubic|landing|curve/i.test(line) && !/times\s*:/.test(line))
    for (const m of line.matchAll(arr)) {
      const [x1, y1, x2, y2] = m.slice(1).map(Number)
      if (x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1 && /\./.test(m[0]) && !(x1 === 0 && y1 === 0 && x2 === 1 && y2 === 1))
        hits.push(["motion", m[0]])
    }
  return hits
}

const files = {}
let total = 0
const ignored = []
const ignoreMark = /token-audit-ignore:\s*\S/
const commentLine = /^\s*(\/\/|\/\*|\*|\{\/\*)/
// Mask colors only carry alpha, so a line that sets a mask is not a theme decision.
const maskLine = /mask(?:-image)?\s*[:=[]|\bmask:|WebkitMask|maskImage/i
const byCategory = { color: 0, palette: 0, motion: 0 }
for (const file of walk(root).sort()) {
  const path = relative(root, file).split(sep).join("/")
  const rec = { color: 0, palette: 0, motion: 0, hits: [] }
  const lines = readFileSync(file, "utf8").split("\n")
  lines.forEach((text, i) => {
    if (commentLine.test(text)) return
    if (maskLine.test(text)) return
    const exempt = ignoreMark.test(text) || (i > 0 && commentLine.test(lines[i - 1]) && ignoreMark.test(lines[i - 1]))
    for (const [category, match] of scan(text)) {
      if (exempt) { ignored.push({ path, line: i + 1, category, match }); continue }
      rec[category]++
      byCategory[category]++
      total++
      rec.hits.push({ line: i + 1, category, match })
    }
  })
  if (rec.hits.length) files[path] = rec
}

if (flag("--update")) {
  const base = {}
  for (const p of Object.keys(files)) base[p] = { color: files[p].color, palette: files[p].palette, motion: files[p].motion }
  writeFileSync(baselineFile, JSON.stringify(base, null, 2) + "\n")
  console.log(`baseline written: ${Object.keys(base).length} files, ${total} hits`)
} else if (flag("--check")) {
  const base = existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, "utf8")) : {}
  let failed = false
  const dropped = []
  for (const p of new Set([...Object.keys(base), ...Object.keys(files)])) {
    for (const c of CATS) {
      const now = files[p]?.[c] ?? 0, was = base[p]?.[c] ?? 0
      if (now > was) {
        failed = true
        console.error(`FAIL ${p}: ${c} ${now} > baseline ${was}`)
        for (const h of files[p].hits.filter(h => h.category === c)) console.error(`  ${p}:${h.line}  ${h.match}`)
      } else if (now < was) dropped.push(`${p} ${c} ${was} -> ${now}`)
    }
  }
  if (dropped.length) console.log(`Counts dropped; run --update to tighten the baseline:\n  ${dropped.join("\n  ")}`)
  if (failed) { console.error("Token drift: use tokens, or run --update if intentional."); process.exit(1) }
  console.log(`token audit ok (${total} baselined hits, ${ignored.length} exempt by token-audit-ignore)`)
} else if (flag("--json")) {
  console.log(JSON.stringify({ total, byCategory, files, ignored }, null, 2))
} else {
  console.log(`Token audit: ${total} hits (color ${byCategory.color}, palette ${byCategory.palette}, motion ${byCategory.motion})`)
  for (const [p, r] of Object.entries(files).sort((a, b) => b[1].hits.length - a[1].hits.length || a[0].localeCompare(b[0]))) {
    console.log(`\n${p}  color ${r.color}  palette ${r.palette}  motion ${r.motion}`)
    for (const h of r.hits) console.log(`  :${h.line}  [${h.category}] ${h.match}`)
  }
  if (ignored.length) {
    console.log(`\nExempt by token-audit-ignore: ${ignored.length}`)
    for (const h of ignored) console.log(`  ${h.path}:${h.line}  [${h.category}] ${h.match}`)
  }
}
