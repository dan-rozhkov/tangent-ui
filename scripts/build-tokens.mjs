// Builds public/tokens.json (W3C Design Tokens format) from app/foundation.css and lib/motion-tokens.ts,
// so a build pipeline, linter, or agent can fetch any token's resolved value from one place.
// Needs Node with TypeScript type stripping (>=22.18) to import lib/motion-tokens.ts directly.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const root = new URL("../", import.meta.url)
const read = path => readFileSync(new URL(path, root), "utf8")
const pkg = JSON.parse(read("package.json"))
const { motionTokens } = await import(new URL("lib/motion-tokens.ts", root).href)

// 1. Flatten foundation.css into rules: a tiny brace scanner is enough (no nesting beyond @supports).
const rules = []
const stack = []
let buf = ""
// Comments stay in rule bodies (they carry descriptions) but are blanked in selectors; braces inside comments are ignored.
const css = read("app/foundation.css")
for (let i = 0; i < css.length; i++) {
  const ch = css[i]
  if (ch === "/" && css[i + 1] === "*") {
    const end = css.indexOf("*/", i + 2)
    buf += css.slice(i, end + 2)
    i = end + 1
  } else if (ch === "{") { stack.push(buf.replace(/\/\*[\s\S]*?\*\//g, "").trim()); buf = "" }
  else if (ch === "}") {
    const sel = stack.pop()
    if (sel.startsWith(":root")) rules.push({ sel, body: buf, supports: stack.some(s => s.startsWith("@supports")) })
    buf = ""
  } else buf += ch
}

// 2. Collect every custom property with its per-mode values. Mode keys: dark, accent.X, dark.accent.X.
const accents = []
const vars = new Map()
for (const { sel, body, supports } of rules) {
  const m = sel.match(/^:root(\[data-theme="dark"\])?(?:\[data-accent="([\w-]+)"\])?$/)
  if (!m) continue
  const mode = [m[1] && "dark", m[2] && `accent.${m[2]}`].filter(Boolean).join(".")
  if (m[2] && !accents.includes(m[2])) accents.push(m[2])
  let note = ""
  for (const [, comment, name, raw] of body.matchAll(/\/\*([\s\S]*?)\*\/|(--[\w-]+)\s*:\s*([^;]+)/g)) {
    if (comment) { note = comment.replace(/\s+/g, " ").trim(); continue }
    const t = vars.get(name) ?? vars.set(name, { name, modes: {} }).get(name)
    const get = k => (k ? t.modes[k] : t.value)
    const put = (k, v) => (k ? (t.modes[k] = v) : (t.value = v))
    const value = raw.trim()
    // The @supports block wins where supported; the plain declaration stays as the "fallback" mode.
    if (supports && get(mode) !== undefined) put(mode ? `${mode}.fallback` : "fallback", get(mode))
    put(mode, value)
    if (note && !mode && !supports && !t.description) t.description = note
    note = ""
  }
}

// 3. Map custom property names to token paths.
const pathOf = name => {
  const n = name.slice(2)
  let m
  if ((m = n.match(/^neutral-(\d+)$/))) return `color.neutral.${m[1]}`
  if ((m = n.match(/^series-(\d+)$/))) return `color.series.${m[1]}`
  if ((m = n.match(/^syntax-(\w+)$/))) return `color.syntax.${m[1]}`
  if ((m = n.match(/^control-height-(.+)$/))) return `size.control.${m[1]}`
  if (n === "control-thumb-shadow") return "shadow.control-thumb"
  if ((m = n.match(/^brand-gradient-(from|to|foreground)$/))) return `color.${n}`
  if (n === "brand-gradient") return "gradient.brand"
  if ((m = n.match(/^brand-gradient-(.+)$/))) return `gradient.brand-${m[1]}`
  if ((m = n.match(/^(space|radius|font|tracking|leading|duration|shadow)-(.+)$/))) return `${m[1]}.${m[2]}`
  if ((m = n.match(/^text-(\d?(?:xs|sm|base|lg|xl))$/))) return `text.${m[1]}`
  if ((m = n.match(/^ease-(.+)$/))) return `ease.${m[1]}`
  return `color.${n}`
}
const paths = new Map([...vars.keys()].map(name => [name, pathOf(name)]))

// 4. Convert values: whole-value var(--x) of a known token becomes an alias; units map to DTCG types.
const alias = v => {
  const m = v.match(/^var\((--[\w-]+)\)$/)
  return m && paths.has(m[1]) ? `{${paths.get(m[1])}}` : v
}
const convert = (group, v) => {
  v = alias(v)
  if (v.startsWith("{")) return v
  if (group === "leading") return parseFloat(v)
  const bezier = group === "ease" && v.match(/^cubic-bezier\((.+)\)$/)
  return bezier ? bezier[1].split(",").map(Number) : v
}
const dimensions = ["space", "radius", "size", "text", "tracking"]
const typeOf = (group, v) => {
  if (group === "color") return /color-mix|\bfrom\b/.test(v) ? undefined : "color"
  if (dimensions.includes(group)) return "dimension"
  if (group === "leading") return "number"
  if (group === "duration") return "duration"
  if (group === "ease" && v.startsWith("cubic-bezier(")) return "cubicBezier"
}

const tree = {}
let count = 0
const add = (path, leaf) => {
  const keys = path.split(".")
  const last = keys.pop()
  const parent = keys.reduce((node, key) => (node[key] ??= {}), tree)
  parent[last] = leaf
  count++
}

for (const t of vars.values()) {
  const path = paths.get(t.name)
  const group = path.split(".")[0]
  const value = convert(group, t.value)
  const modes = {}
  for (const [key, v] of Object.entries(t.modes)) {
    const c = convert(group, v)
    if (key === "dark" && JSON.stringify(c) === JSON.stringify(value)) continue // identical to light: no override
    modes[key] = c
  }
  const type = typeOf(group, t.value)
  add(path, {
    ...(type && { $type: type }),
    $value: value,
    ...(t.description && { $description: t.description }),
    $extensions: { "tangent.cssVar": t.name, ...(Object.keys(modes).length && { "tangent.modes": modes }) },
  })
}

// 5. Motion tokens from lib/motion-tokens.ts. Doc comments above keys become descriptions.
const notes = new Map([...read("lib/motion-tokens.ts").matchAll(/\/\*\*\s*(.*?)\s*\*\/\s*(\w+):/g)].map(m => [m[2], m[1]]))
const ms = s => `${Math.round(s * 1e6) / 1e3}ms`
const motion = {
  duration: v => ({ $type: "duration", $value: ms(v) }),
  stagger: v => ({ $type: "duration", $value: ms(v) }),
  ease: v => ({ $type: "cubicBezier", $value: [...v] }),
  spring: v => ({ $value: { ...v } }),
  blur: v => ({ $type: "dimension", $value: `${v}px` }),
}
for (const [group, entries] of Object.entries(motionTokens)) {
  for (const [key, v] of Object.entries(entries)) {
    const note = (notes.get(key) ?? notes.get(group))?.replace(" in seconds", "")
    const { $type, $value } = motion[group](v)
    add(`motion.${group}.${key}`, { ...($type && { $type }), $value, ...(note && { $description: note }) })
  }
}

const out = {
  $description: "Tangent UI design tokens, generated by scripts/build-tokens.mjs. Do not edit.",
  $extensions: {
    tangent: {
      version: pkg.version,
      source: "app/foundation.css + lib/motion-tokens.ts",
      themes: ["light", "dark"],
      accents,
      modeResolution: "Token $value is light with no accent. Active modes win in order: dark.accent.X, accent.X, dark. Missing modes fall through. The fallback modes apply where CSS relative color is unsupported.",
    },
  },
  ...tree,
}
mkdirSync(new URL("public/", root), { recursive: true })
writeFileSync(new URL("public/tokens.json", root), `${JSON.stringify(out, null, 2)}\n`)
console.log(`tokens: ${count}`)
