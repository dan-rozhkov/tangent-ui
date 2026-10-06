// Records a demo from the running dev server as MP4: node scripts/record-demo.mjs <name> [--dark]
// Scenarios live in scripts/scenarios.mjs. Videos land in recordings/.
import { execFileSync } from "node:child_process"
import { mkdirSync, rmSync } from "node:fs"
import { chromium } from "playwright"

import { scenarios } from "./scenarios.mjs"

const [name, ...flags] = process.argv.slice(2)
const scenario = scenarios[name]
if (!scenario) throw new Error(`No scenario for "${name}". Known: ${Object.keys(scenarios).join(", ")}`)
const dark = flags.includes("--dark")
const base = process.env.BASE_URL ?? "http://localhost:3456"
const size = { width: 1440, height: 900 }

// A visible cursor, since headless video has none. It shrinks on press so clicks read on screen.
const cursor = () => {
  addEventListener("DOMContentLoaded", () => {
    const dot = document.createElement("div")
    dot.style.cssText = "position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(120,120,120,.35);border:1.5px solid rgba(255,255,255,.9);box-shadow:0 1px 4px rgba(0,0,0,.35);pointer-events:none;z-index:2147483647;transition:transform .12s"
    document.documentElement.append(dot)
    addEventListener("pointermove", e => { dot.style.left = e.clientX + "px"; dot.style.top = e.clientY + "px" }, true)
    addEventListener("pointerdown", () => { dot.style.transform = "scale(.7)" }, true)
    addEventListener("pointerup", () => { dot.style.transform = "" }, true)
  })
}

const out = new URL("../recordings/", import.meta.url).pathname
const tmp = `${out}.tmp-${name}`
mkdirSync(tmp, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, colorScheme: dark ? "dark" : "light", recordVideo: { dir: tmp, size }, permissions: ["clipboard-read", "clipboard-write"] })
await context.addInitScript(cursor)
await context.addInitScript(theme => { try { localStorage.setItem("theme", theme) } catch {} }, dark ? "dark" : "light")
const page = await context.newPage()
await page.goto(`${base}/components/${name}`, { waitUntil: "networkidle" })
await page.waitForTimeout(800)
// Crop the video to the demo stage (with a margin), so the component fills the frame.
await page.locator("[data-stage]").scrollIntoViewIfNeeded()
const stageBox = await page.locator("[data-stage]").boundingBox()
const margin = 24
const even = n => Math.floor(n / 2) * 2
const crop = {
  x: even(Math.max(0, stageBox.x - margin)),
  y: even(Math.max(0, stageBox.y - margin)),
  w: even(Math.min(size.width, stageBox.width + margin * 2)),
  // Extend to the bottom of the viewport: menus and popovers often open below the stage.
  h: even(size.height - Math.max(0, stageBox.y - margin)),
}

// Center the cursor on the stage first, so the video does not start with it in a corner.
await page.mouse.move(size.width / 2, size.height / 2)
await scenario(page)
await page.waitForTimeout(600)

const video = page.video()
await context.close()
await browser.close()

const webm = await video.path()
const file = `${out}${name}${dark ? "-dark" : ""}.mp4`
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-vf", `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", file])
rmSync(tmp, { recursive: true, force: true })
console.log(file)
