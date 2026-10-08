// Builds the shadcn registry (public/r/*.json) and public/llms.txt from the catalog and component sources, so agents and the shadcn CLI need no hand-kept list.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { join, posix } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const out = join(root, "public/r")
const NS = "@tangent"
const HOMEPAGE = "https://github.com/dan-rozhkov/tangent-ui"
const SKIP_PKGS = new Set(["react", "react-dom", "next"])

const { catalog, categories, categoryLabel } = await import(new URL("../lib/catalog.ts", import.meta.url))
const { version, dependencies: prodDeps = {}, devDependencies: devDeps = {} } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const pin = name => {
  const range = prodDeps[name] ?? devDeps[name]
  if (!range) throw new Error(`${name} is imported by a component but not declared in package.json`)
  return `${name}@${range}`
}
const names = new Set(catalog.map(item => item.name))
const read = path => readFileSync(join(root, path), "utf8")

// Import specifiers of a source file (static import/export-from only; strings and comments mentioning imports are ignored).
const specifiers = src => [
  ...[...src.matchAll(/^(?:import|export)\b[^"'`;]*?\bfrom\s*["']([^"']+)["']/gm)].map(m => m[1]),
  ...[...src.matchAll(/^import\s*["']([^"']+)["']/gm)].map(m => m[1]),
]
const pkgName = spec => (spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0])
const resolveFile = base => {
  for (const ext of ["", ".tsx", ".ts"]) if (existsSync(join(root, base + ext)) && /\.[a-z]+$/.test(base + ext)) return base + ext
  throw new Error(`cannot resolve ${base}`)
}
const localPath = (spec, from) => resolveFile(spec.startsWith("@/") ? spec.slice(2) : posix.join(posix.dirname(from), spec))

// Follows local imports from an entry file. Catalog siblings become registry dependencies, other siblings extra files, lib files lib items.
const libs = new Map() // name -> { path, deps, libs }
const libPaths = new Map() // name -> path, set before the walk so in-progress libs also clash
const libName = path => `lib-${posix.basename(path).replace(/\.[^.]+$/, "")}`
const walk = (entry, self) => {
  const files = [], deps = new Set(), regs = new Set(), seen = new Set()
  const visit = path => {
    if (seen.has(path)) return
    seen.add(path)
    files.push(path)
    for (const spec of specifiers(read(path))) {
      if (spec.startsWith("@/") || spec.startsWith(".")) {
        const target = localPath(spec, path)
        const base = posix.basename(target).replace(/\.[^.]+$/, "")
        if (target.startsWith("lib/")) regs.add(addLib(target))
        else if (target.startsWith("components/ui/") && names.has(base) && base !== self) regs.add(base)
        else if (target.startsWith("components/ui/")) visit(target)
        else throw new Error(`${path}: unsupported import ${spec}`)
      } else if (!SKIP_PKGS.has(pkgName(spec)) && !spec.startsWith("node:")) deps.add(pkgName(spec))
    }
  }
  visit(entry)
  return { files, deps, regs }
}
function addLib(path) {
  const name = libName(path)
  if (libPaths.get(name) && libPaths.get(name) !== path) throw new Error(`lib name ${name} is taken by both ${libPaths.get(name)} and ${path}`)
  libPaths.set(name, path)
  if (!libs.has(name)) {
    libs.set(name, null)
    const { files, deps, regs } = walk(path, null)
    regs.delete(name)
    libs.set(name, { path, files, deps, regs })
  }
  return name
}

const ref = name => `${NS}/${name}`
const sorted = set => [...set].sort()
const entries = []
// Gallery demo images live in this repo's public/ and are not part of the registry.
const assetRe = /["'`]\/(?:media|logos)\//
const ASSET_DOCS = "Images referenced by this component are gallery demo assets (/media/..., /logos/...) that the registry does not ship; replace the paths with your own images."
const libAssets = name => {
  const lib = libs.get(name)
  return lib.files.some(path => assetRe.test(read(path))) || [...lib.regs].some(libAssets)
}
const hasSource = name => existsSync(join(root, `components/ui/${name}.tsx`))
for (const item of catalog) {
  // Variants without their own file (theme-switch-rise) are views of a base component: they depend on it and ship no files.
  const base = hasSource(item.name) ? null : [...names].filter(name => hasSource(name) && item.name.startsWith(`${name}-`)).sort((a, b) => b.length - a.length)[0]
  if (!hasSource(item.name) && !base) throw new Error(`${item.name}: no source in components/ui`)
  const { files, deps, regs } = base ? { files: [], deps: new Set(), regs: new Set([base]) } : walk(`components/ui/${item.name}.tsx`, item.name)
  const lib = sorted(regs).filter(name => name.startsWith("lib-"))
  const ui = sorted(regs).filter(name => !name.startsWith("lib-"))
  entries.push({
    name: item.name,
    type: item.kind === "block" ? "registry:block" : "registry:ui",
    title: item.title,
    description: item.description,
    dependencies: sorted(deps).map(pin),
    registryDependencies: ["foundation", ...lib, ...ui].map(ref),
    files: files.map(path => ({ path, type: "registry:ui", content: read(path) })),
    ...((files.some(path => assetRe.test(read(path))) || lib.some(libAssets)) && { docs: ASSET_DOCS }),
    categories: [item.category],
    meta: { version, kind: item.kind },
  })
}
for (const [name, lib] of [...libs].sort(([a], [b]) => a.localeCompare(b))) {
  entries.push({
    name,
    type: "registry:lib",
    title: `Lib: ${posix.basename(lib.path)}`,
    description: `Shared helper ${lib.path} used by Tangent UI components.`,
    dependencies: sorted(lib.deps).map(pin),
    registryDependencies: sorted(lib.regs).map(ref),
    files: lib.files.map(path => ({ path, type: "registry:lib", content: read(path) })),
    ...(libAssets(name) && { docs: ASSET_DOCS }),
    meta: { version, kind: "lib" },
  })
}

// Foundation: CSS variables for light/dark/accent live under data-theme/data-accent selectors, which cssVars cannot express, so ship the stylesheets as files.
const globals = read("app/globals.css")
const section = (from, to, label) => {
  const start = globals.indexOf(from)
  const end = globals.indexOf(to, start + from.length)
  if (start < 0 || end < 0) throw new Error(`app/globals.css: ${label} markers not found`)
  return globals.slice(start, end)
}
// Only what the components need: the variants and the theme mapping. The consumer's own base layer, shadcn color aliases and theme stay untouched.
// tw-animate-css (animate-in, fade-in-0...) and shadcn/tailwind.css (data-open: variants) are still used by components, so they stay imported and stay dependencies.
const cssImports = [...globals.matchAll(/^@import "([^"]+)";$/gm)].map(m => m[1]).filter(spec => spec !== "tailwindcss")
for (const spec of ["tw-animate-css", "shadcn/tailwind.css", "./foundation.css"]) if (!cssImports.includes(spec)) throw new Error(`app/globals.css: @import "${spec}" not found`)
const cssPkgs = new Set(cssImports.filter(spec => !spec.startsWith(".")).map(pkgName))
const variants = section("/* The theme switches", "/* Foundation tokens exposed", "custom-variant")
const theme = section("/* Foundation tokens exposed", "\n@layer base", "@theme inline")
const aliasHead = "  /* shadcn aliases"
const aliasStart = theme.indexOf(aliasHead)
const aliasEnd = theme.indexOf("\n\n", aliasStart)
if (aliasStart < 0 || aliasEnd < 0) throw new Error("app/globals.css: shadcn aliases block not found")
// Aliases that component classes still resolve through (e.g. outline-ring) stay; the rest are dropped.
const uiSource = readdirSync(join(root, "components/ui")).filter(f => /\.tsx?$/.test(f)).map(f => read(`components/ui/${f}`)).join("\n")
const usedAliases = []
const aliasLines = theme.slice(aliasStart, aliasEnd).split("\n").slice(1).filter(line => {
  const name = line.match(/--color-([\w-]+):/)?.[1]
  return name && new RegExp(`(?<![\\w-])(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|decoration|caret|shadow|placeholder)-${name}(?![\\w-])`).test(uiSource) && usedAliases.push(name)
})
const themeCss = [
  ...cssImports.map(spec => `@import "${spec}";`),
  "",
  variants.trimEnd(),
  "",
  (theme.slice(0, aliasStart) + (aliasLines.length ? `  /* shadcn-style aliases that component classes still use. */\n${aliasLines.join("\n")}\n` : "") + theme.slice(aliasEnd + 1)).trimEnd(),
  "",
  "/* Bare `border` classes take the token color, as in a stock shadcn setup. */",
  "@layer base {\n  * {\n    @apply border-border;\n  }\n}",
  "",
].join("\n")
console.log(`foundation: kept aliases ${usedAliases.join(", ") || "none"}`)
entries.push({
  name: "foundation",
  type: "registry:file",
  title: "Foundation",
  description: "Design tokens (color, surface, radius, shadow, motion), light/dark and accent themes, and the Tailwind theme mapping every Tangent UI component needs.",
  dependencies: sorted(cssPkgs).map(pin),
  files: [
    { path: "app/foundation.css", type: "registry:file", target: "~/app/foundation.css", content: read("app/foundation.css") },
    { path: "app/tangent-theme.css", type: "registry:file", target: "~/app/tangent-theme.css", content: themeCss },
  ],
  docs: 'Import tangent-theme.css after tailwindcss in your global CSS: `@import "./tangent-theme.css";`. Theming uses data-theme="light|dark" and data-accent on <html>, and the `dark:` variant follows data-theme (if your app uses a .dark class, set data-theme too). Define the --font-body and --font-display CSS variables.',
  meta: { version, kind: "foundation" },
})

const items = entries.sort((a, b) => a.name.localeCompare(b.name))
const known = new Set(items.map(item => item.name))
for (const item of items)
  for (const dep of item.registryDependencies ?? [])
    if (!known.has(dep.slice(NS.length + 1))) throw new Error(`${item.name}: unresolved dependency ${dep}`)

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
const json = value => JSON.stringify(value, null, 2) + "\n"
for (const item of items) writeFileSync(join(out, `${item.name}.json`), json({ $schema: "https://ui.shadcn.com/schema/registry-item.json", ...item }))
const strip = ({ path, type, target }) => ({ path, type, ...(target && { target }) })
writeFileSync(
  join(out, "registry.json"),
  json({
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: "tangent",
    homepage: HOMEPAGE,
    items: items.map(item => ({ ...item, files: item.files.map(strip) })),
  }),
)

const lines = [
  "# Tangent UI",
  "",
  `> Animated React components and blocks for Next.js, built on Base UI, Motion and Tailwind, installable through the shadcn CLI. Version ${version}.`,
  "",
  "## Conventions",
  "",
  `- Install: add \`"registries": {"${NS}": "<site>/r/{name}.json"}\` to components.json, then \`npx shadcn add ${NS}/<name>\`. Every item depends on \`${NS}/foundation\`.`,
  "- Design tokens are listed at [/tokens.json](/tokens.json); colors, radii, shadows and easings are CSS variables from app/foundation.css.",
  "- Motion durations, easings and springs come from lib/motion-tokens; components do not hard-code timings.",
  "- Reduced motion follows the system, and `<html data-motion=\"reduce|full\">` overrides it (lib/reduced-motion).",
  "- Theming: `data-theme=\"light|dark\"` and `data-accent` on `<html>`; there is no `.dark` class.",
  "- No focus rings by product decision.",
  "- Each registry item is a JSON file with the full source inlined: [registry index](/r/registry.json).",
]
for (const category of categories) {
  const group = catalog.filter(item => item.category === category)
  if (!group.length) continue
  lines.push("", `## ${categoryLabel(category)}`, "", ...group.map(item => `- [${item.title}](/r/${item.name}.json): ${item.description}`))
}
writeFileSync(join(root, "public/llms.txt"), lines.join("\n") + "\n")

console.log(`registry: ${catalog.length} items, ${libs.size} libs, foundation, ${readdirSync(out).length} files in public/r`)
console.log(`llms.txt: ${catalog.length} links`)
