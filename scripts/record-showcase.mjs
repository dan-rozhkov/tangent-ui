// Records compact home-page showcase clips: node scripts/record-showcase.mjs [name...]
// Each demo is recorded in both themes with only the stage in frame (16:10, 960x600).
// Output: public/showcase/<name>-{light,dark}.{mp4,jpg}. BASE_URL defaults to http://localhost:3100.
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium } from "playwright"

import { scenarios } from "./scenarios.mjs"

const showcase = ["glass-tabbar", "action-morph", "morph-nav", "dock", "liquid-tab-bar", "orbit-menu", "share-sheet", "now-playing", "sheet-stack", "wallet-stack", "card-stack", "booking-pill"]
const names = process.argv.slice(2).length ? process.argv.slice(2) : showcase
const base = process.env.BASE_URL ?? "http://localhost:3100"
const defaultViewport = { width: 960, height: 600 } // recorded 1:1; media queries see this width
const scale = 1
const outSize = { width: 960, height: 600 }
// Per-component overrides: { viewport, zoom, css }. zoom scales the stage content (layout zoom, so it stays crisp and breakpoints keep the viewport width).
const config = {
  "morph-nav": { viewport: { width: 1280, height: 800 }, zoom: 1.25 },
}
const lead = 0.3 // seconds of settled stage kept before the scenario starts
const maxBytes = 500 * 1024
const out = new URL("../public/showcase/", import.meta.url).pathname
mkdirSync(out, { recursive: true })

// A visible cursor, since headless video has none. It shrinks on press so clicks read on screen.
const cursor = () => {
  addEventListener("DOMContentLoaded", () => {
    const dot = document.createElement("div")
    dot.style.cssText = "position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(120,120,120,.35);border:1.5px solid rgba(255,255,255,.9);box-shadow:0 1px 4px rgba(0,0,0,.35);pointer-events:none;z-index:2147483647;transition:transform .12s,opacity .1s;opacity:0"
    dot.id = "__dot"
    document.documentElement.append(dot)
    addEventListener("pointermove", e => { dot.style.left = e.clientX + "px"; dot.style.top = e.clientY + "px" }, true)
    addEventListener("pointerdown", () => { dot.style.transform = "scale(.7)" }, true)
    addEventListener("pointerup", () => { dot.style.transform = "" }, true)
  })
}

// Hide site chrome and page text; the stage fills the viewport on its own surface.
const frameCss = `
  header, aside, footer, article > header, nextjs-portal { display: none !important; }
  html, body { overflow: hidden !important; }
  [data-stage] { position: fixed !important; inset: 0 !important; z-index: 40; margin: 0 !important; width: auto !important; height: auto !important; min-height: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; outline: 0 !important; }
`

const encode = (src, dest, crf) =>
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(dest.start), "-i", src, "-vf", `scale=${outSize.width}:${outSize.height}:flags=lanczos`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", String(crf), "-preset", "slow", "-an", "-movflags", "+faststart", dest.file])

async function record(name, theme) {
  const scenario = scenarios[name]
  if (!scenario) throw new Error(`No scenario for "${name}"`)
  const { viewport = defaultViewport, zoom = 1.5, css = "" } = config[name] ?? {}
  const size = { width: viewport.width * scale, height: viewport.height * scale }
  const tmp = mkdtempSync(join(tmpdir(), `showcase-${name}-`))
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, colorScheme: theme, recordVideo: { dir: tmp, size }, permissions: ["clipboard-read", "clipboard-write"] })
  await context.addInitScript(cursor)
  await context.addInitScript(t => { try { localStorage.setItem("theme", t) } catch {} }, theme)
  const t0 = Date.now()
  const page = await context.newPage()
  await page.goto(`${base}/components/${name}`, { waitUntil: "networkidle" })
  await page.addStyleTag({ content: `${frameCss}[data-stage] > * { zoom: ${zoom}; }${css}` })
  await page.waitForTimeout(900)
  await page.mouse.move(viewport.width / 2, viewport.height / 2)
  await page.evaluate(() => { document.getElementById("__dot").style.opacity = "1" })
  const start = Math.max(0, (Date.now() - t0) / 1000 - lead)
  await scenario(page)
  await page.waitForTimeout(600)
  const video = page.video()
  await context.close()
  await browser.close()

  const webm = await video.path()
  const file = `${out}${name}-${theme}.mp4`
  let crf = 28
  for (; crf <= 32; crf += 2) {
    encode(webm, { file, start }, crf)
    if (statSync(file).size <= maxBytes) break
  }
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", file, "-ss", String(lead / 2), "-frames:v", "1", "-vf", `scale=${outSize.width}:${outSize.height}`, "-q:v", "4", `${out}${name}-${theme}.jpg`])
  rmSync(tmp, { recursive: true, force: true })
  console.log(`${name}-${theme}: ${Math.round(statSync(file).size / 1024)}KB crf ${Math.min(crf, 32)}`)
}

for (const name of names) for (const theme of (process.env.THEME ? [process.env.THEME] : ["light", "dark"])) {
  try { await record(name, theme) } catch (error) {
    console.warn(`${name}-${theme} failed (${error.message.split("\n")[0]}), retrying`)
    await record(name, theme)
  }
}
