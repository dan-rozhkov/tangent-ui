"use client"

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import type { CSSProperties, ReactNode } from "react"
import { AnimatePresence, motion } from "motion/react"
import type { Variants } from "motion/react"
import { ArrowRightIcon, ArrowUpRightIcon, BookOpenIcon, CaretUpDownIcon, ChartBarIcon, ChartLineIcon, CheckIcon, DatabaseIcon, GearIcon, GitBranchIcon, MagnifyingGlassIcon, MinusIcon, PulseIcon, SparkleIcon, UsersIcon } from "@phosphor-icons/react"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { LineChart } from "@/components/ui/line-chart"
import type { LineChartDatum } from "@/components/ui/line-chart"
import SegmentedControl from "@/components/ui/segmented-control"
import { Sparkline } from "@/components/ui/sparkline"
import { avatar } from "@/lib/media"
import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { ReducedMotionConfig, useReducedMotion } from "@/lib/reduced-motion"

/* ---------------------------------------------------------------------------------------------------------------------
   Shared shell. Each variant adds its own classes for its one idea.
   ------------------------------------------------------------------------------------------------------------------ */

const shell = {
  hero: "relative @container/hero overflow-clip bg-background font-sans tracking-body text-foreground",
  title: "m-0 font-display text-[length:clamp(2.25rem,1.3rem_+_4.4cqi,4.5rem)] leading-display font-medium tracking-display text-balance",
  description: "m-0 text-(length:--text-lg) leading-body text-text-secondary text-pretty @max-[560px]/hero:text-base",
  /* The designed variants are one full screen each, edge to edge, like Hero signup. The small viewport unit keeps them from
     hiding under mobile browser bars. Your own content (HeroContent) keeps its natural height inside your page. */
  screen: "w-full min-h-svh",
}
const mono = "[font-family:var(--font-mono,ui-monospace,'SF_Mono',Menlo,monospace)]"

/* ---------------------------------------------------------------------------------------------------------------------
   Motion
   ------------------------------------------------------------------------------------------------------------------ */

type Bezier = [number, number, number, number]
const ease = {
  enter: [...motionTokens.ease.enter] as Bezier,
  standard: [...motionTokens.ease.standard] as Bezier,
  inOut: [...motionTokens.ease.inOut] as Bezier,
}

/** The one entrance a hero plays: children rise in reading order, once. */
const heroGroup: Variants = { hidden: {}, shown: { transition: { staggerChildren: motionTokens.stagger.line, delayChildren: 0.04 } } }
const heroRise: Variants = {
  hidden: { opacity: 0, y: 12, filter: `blur(${motionTokens.blur.subtle}px)` },
  shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.64, ease: ease.enter } },
}

const noop = () => () => {}
/**
 * Reduced motion, read only after hydration. The server cannot know the preference, so the first client render matches the
 * server's full motion markup and the reduced branch takes over on the next render, before anything has moved.
 */
function useHeroReducedMotion() {
  const hydrated = useSyncExternalStore(noop, () => true, () => false)
  return !!useReducedMotion() && hydrated
}

/* ---------------------------------------------------------------------------------------------------------------------
   Mesh
   ------------------------------------------------------------------------------------------------------------------ */

/**
 * One point of a mesh, in the same model the Gradient mesh editor saves: a position as a fraction of the box (0 to 1 from the
 * top left) and a reach. The color is not given here: it is read from the CSS variable `--mesh-{n}` on the element, so light
 * and dark themes each author their own palette in CSS and the canvas follows a theme switch without a remount.
 */
export interface HeroMeshPoint {
  x: number
  y: number
  /** Reach of the color as a fraction of the box, 0.15 to 1.2. */
  spread: number
}

export interface HeroMeshProps {
  points: readonly HeroMeshPoint[]
  /** Film grain, 0 to 1. */
  grain?: number
  /** Drift speed. 1 loops every 20 seconds; 0 holds the mesh still. */
  speed?: number
  className?: string
  style?: CSSProperties
}

type Rgb = [number, number, number]

/** Same loop as the Gradient mesh editor: integer frequencies, so the drift is seamless. */
const PERIOD = 20,
  TRAVEL = 0.075,
  BREATH = 0.08,
  MAX = 8
/** The drift is slow, so thirty frames a second is indistinguishable from sixty and halves the cost. */
const FRAME = 1000 / 30

const VS = `attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }`
const FS = `
precision mediump float;
uniform vec2 uRes;
uniform vec3 uBase;
uniform vec4 uP[${MAX}];
uniform vec3 uC[${MAX}];
uniform int uN;
uniform float uGrain;
float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main() {
  vec2 uv = vec2(gl_FragCoord.x / uRes.x, 1.0 - gl_FragCoord.y / uRes.y);
  vec3 col = uBase;
  for (int i = 0; i < ${MAX}; i++) {
    if (i >= uN) break;
    vec4 p = uP[i];
    float d = length((uv - p.xy) / max(p.z, 1e-4));
    col = mix(col, uC[i], 1.0 - smoothstep(0.0, 1.0, d));
  }
  float n = hash(floor(gl_FragCoord.xy)) + hash(floor(gl_FragCoord.xy) + 19.19) - 1.0;
  float lum = dot(col, vec3(.2126, .7152, .0722));
  col += n * (uGrain * .1 * (.55 + 1.8 * lum * (1.0 - lum)) + .6 / 255.0);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`

function hashOf(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Resolves any CSS color (hex, oklch, color-mix) to sRGB through a one pixel 2D canvas. */
function toRgb(color: string, scratch: CanvasRenderingContext2D): Rgb {
  scratch.clearRect(0, 0, 1, 1)
  scratch.fillStyle = "#000"
  scratch.fillStyle = color
  scratch.fillRect(0, 0, 1, 1)
  const [r, g, b] = scratch.getImageData(0, 0, 1, 1).data
  return [r / 255, g / 255, b / 255]
}

/** The static CSS render of the same mesh: shown on the server, before the canvas paints, and when WebGL is missing. */
function cssMesh(points: readonly HeroMeshPoint[]): CSSProperties {
  const stops = [0, 0.2, 0.4, 0.6, 0.8, 1].map(t => [t, Math.round((1 - t * t * (3 - 2 * t)) * 100)] as const)
  const layers = points.map(
    (p, i) =>
      `radial-gradient(ellipse ${p.spread * 100}% ${p.spread * 100}% at ${p.x * 100}% ${p.y * 100}%, ${stops.map(([t, a]) => `color-mix(in srgb, var(--mesh-${i + 1}) ${a}%, transparent) ${t * 100}%`).join(", ")})`,
  )
  return { backgroundColor: "var(--mesh-base)", backgroundImage: layers.reverse().join(", ") }
}

/**
 * A lean, non-editing render of the Gradient mesh: a single WebGL triangle composites each point over the last with the
 * editor's smoothstep falloff and grain, drifting on the editor's seamless loop. It draws at thirty frames a second only while
 * it is on screen and the tab is visible, and draws one still frame under reduced motion.
 */
export function HeroMesh({ points, grain = 0.35, speed = 1, className, style }: HeroMeshProps) {
  const root = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const reduced = !!useReducedMotion()
  const key = JSON.stringify(points)

  useEffect(() => {
    const host = root.current,
      node = canvas.current
    if (!host || !node) return
    const gl = node.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" })
    const scratch = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
    if (!gl || !scratch) return
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, "a")
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const u = Object.fromEntries(["uRes", "uBase", "uP", "uC", "uN", "uGrain"].map(name => [name, gl.getUniformLocation(prog, name)]))

    const pts = (JSON.parse(key) as HeroMeshPoint[]).slice(0, MAX)
    const drift = pts.map((_, i) => {
      const h = hashOf(`mesh-${i}`)
      return { ph1: (h % 628) / 100, ph2: ((h >>> 10) % 628) / 100, k1: 1 + ((h >>> 20) % 2), k2: 1 + ((h >>> 22) % 2) }
    })
    const P = new Float32Array(MAX * 4),
      C = new Float32Array(MAX * 3)
    let base: Rgb = [1, 1, 1]

    const readColors = () => {
      const css = getComputedStyle(host)
      base = toRgb(css.getPropertyValue("--mesh-base").trim() || "#fff", scratch)
      pts.forEach((_, i) => {
        const c = toRgb(css.getPropertyValue(`--mesh-${i + 1}`).trim() || "#fff", scratch)
        C.set(c, i * 3)
      })
    }

    let width = 0,
      height = 0
    const size = () => {
      // The mesh has no detail finer than its grain, so one canvas pixel per CSS pixel is enough on any screen.
      width = Math.max(1, Math.round(host.clientWidth))
      height = Math.max(1, Math.round(host.clientHeight))
      node.width = width
      node.height = height
    }

    let t = hashOf(key) % PERIOD
    const draw = () => {
      const a = (2 * Math.PI * t) / PERIOD
      pts.forEach((p, i) => {
        const d = drift[i]
        P[i * 4] = p.x + TRAVEL * Math.sin(a * d.k1 + d.ph1)
        P[i * 4 + 1] = p.y + TRAVEL * Math.cos(a * d.k2 + d.ph2)
        P[i * 4 + 2] = p.spread * (1 + BREATH * Math.sin(a + d.ph1 * 0.7))
      })
      gl.viewport(0, 0, width, height)
      gl.uniform2f(u.uRes, width, height)
      gl.uniform3f(u.uBase, base[0], base[1], base[2])
      gl.uniform4fv(u.uP, P)
      gl.uniform3fv(u.uC, C)
      gl.uniform1i(u.uN, pts.length)
      gl.uniform1f(u.uGrain, grain)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      host.dataset.painted = ""
    }

    readColors()
    size()
    draw()

    const moving = !reduced && speed > 0
    let visible = false,
      frame = 0,
      last = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (now - last < FRAME) return
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
      last = now
      t = (t + dt * speed) % PERIOD
      draw()
    }
    const sync = () => {
      const run = moving && visible && document.visibilityState === "visible"
      if (run && !frame) {
        last = 0
        frame = requestAnimationFrame(tick)
      }
      if (!run && frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
    }
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      sync()
    })
    io.observe(host)
    const ro = new ResizeObserver(() => {
      size()
      draw()
    })
    ro.observe(host)
    const theme = () => {
      readColors()
      draw()
    }
    const mo = new MutationObserver(theme)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-accent", "class"] })
    const scheme = matchMedia("(prefers-color-scheme: dark)")
    scheme.addEventListener("change", theme)
    document.addEventListener("visibilitychange", sync)
    return () => {
      cancelAnimationFrame(frame)
      io.disconnect()
      ro.disconnect()
      mo.disconnect()
      scheme.removeEventListener("change", theme)
      document.removeEventListener("visibilitychange", sync)
      delete host.dataset.painted
    }
  }, [key, grain, speed, reduced])

  return (
    <div
      ref={root}
      className={cn("group/mesh pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{ ...cssMesh(points), ...style }}
      aria-hidden="true"
    >
      {/* The canvas fades in over its own CSS render once it has painted, so the first frame never flashes. */}
      <canvas
        ref={canvas}
        className="block size-full opacity-0 [transition:opacity_var(--duration-considered,.48s)_var(--ease-standard)] group-data-[painted]/mesh:opacity-100 motion-reduce:transition-none"
      />
    </div>
  )
}

/* ---------------------------------------------------------------------------------------------------------------------
   Content: your own headline in one of the three layouts
   ------------------------------------------------------------------------------------------------------------------ */

export interface HeroAction {
  label: string
  href?: string
  onClick?: () => void
  /** Opens in a new tab and shows an outward arrow. */
  external?: boolean
  /** Shown in place of the label for a moment after a press, such as "Trial started". Buttons only. */
  doneLabel?: string
}

export interface HeroInstallCommand {
  /** Short label, such as npm or pnpm. The first command is shown. */
  label: string
  command: string
}

export interface HeroContentProps {
  layout: "centered" | "split" | "minimal"
  announcement?: HeroAction | null
  title: string
  description?: string
  primaryAction?: HeroAction | null
  secondaryAction?: HeroAction | null
  install?: HeroInstallCommand[] | null
  media?: ReactNode
  meta?: string[]
  animateIn?: boolean
  className?: string
}

const arrow = "flex-none [transition:translate_var(--duration-fast)_var(--ease-standard)] pointer-fine:group-hover/act:translate-x-0.5 motion-reduce:transition-none"
const action =
  "group/act inline-flex h-control-md cursor-pointer items-center justify-center gap-2 rounded-control border border-transparent px-5 text-sm font-medium whitespace-nowrap no-underline [-webkit-tap-highlight-color:transparent] [transition:transform_var(--duration-fast)_var(--ease-standard),background-color_var(--duration-fast)_var(--ease-standard),opacity_var(--duration-fast)_var(--ease-standard)] active:[transform:scale(.97)] motion-reduce:transition-none motion-reduce:active:[transform:none] @max-[560px]/hero:flex-auto"
const actionKind = {
  primary: "bg-foreground text-background pointer-fine:hover:opacity-90",
  secondary: "border-border bg-surface text-foreground pointer-fine:hover:bg-surface-muted",
}
const announcementClass =
  "group/act inline-flex min-h-8 max-w-full cursor-pointer items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1 text-left text-sm text-text-secondary no-underline [transition:color_var(--duration-fast)_var(--ease-standard),border-color_var(--duration-fast)_var(--ease-standard)] pointer-fine:hover:border-border-strong pointer-fine:hover:text-foreground motion-reduce:transition-none"

/** A link or button that looks like a Button. Links keep native navigation; a button with `doneLabel` confirms in place. */
function ActionLink({ action: spec, kind, className }: { action: HeroAction; kind: "primary" | "secondary"; className?: string }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(() => setDone(false), 2400)
    return () => window.clearTimeout(timer)
  }, [done])
  const icon = spec.external ? (
    <ArrowUpRightIcon size={16} aria-hidden="true" />
  ) : kind === "primary" ? (
    <ArrowRightIcon className={arrow} size={16} aria-hidden="true" />
  ) : null
  if (spec.href)
    return (
      <a
        className={cn(action, actionKind[kind], className)}
        href={spec.href}
        onClick={spec.onClick}
        {...(spec.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {spec.label}
        {icon}
      </a>
    )
  return (
    <Button
      variant={kind}
      size="lg"
      // Buttons are library buttons; this only keeps them the height of the link actions beside them.
      className={cn("h-control-md min-h-control-md rounded-control text-sm @max-[560px]/hero:flex-auto", className)}
      onClick={() => {
        spec.onClick?.()
        if (spec.doneLabel) setDone(true)
      }}
    >
      {done ? (
        <>
          <CheckIcon size={16} aria-hidden="true" />
          {spec.doneLabel}
        </>
      ) : (
        <>
          {spec.label}
          {icon}
        </>
      )}
    </Button>
  )
}

const layouts = {
  centered: { inner: "", copy: "", actions: "" },
  split: {
    inner: "grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] items-center gap-12 @max-[800px]/hero:grid-cols-[minmax(0,1fr)] @max-[800px]/hero:gap-10",
    copy: "m-0 justify-items-start text-left",
    actions: "justify-start",
  },
  minimal: { inner: "", copy: "m-0 max-w-[860px] justify-items-start text-left", actions: "justify-start" },
}

/**
 * The hero with your own content: announcement, headline, description, actions, an optional install line, and an
 * optional visual beside the copy. Use it when none of the three designed variants fits the product.
 */
export function HeroContent({ layout, announcement, title, description, primaryAction, secondaryAction, install, media, meta, animateIn = true, className }: HeroContentProps) {
  const item = heroRise
  const command = install?.[0]
  const arrowIcon = <ArrowRightIcon className={arrow} size={14} aria-hidden="true" />
  // Reduced motion: Motion skips every transform (rise, zoom, tilt entrance); opacity still fades briefly.
  return (
    <ReducedMotionConfig>
      <section className={cn(shell.hero, className)}>
        <div className={cn("mx-auto grid max-w-[1200px] px-10 py-24 @max-[560px]/hero:px-4 @max-[560px]/hero:py-16", layouts[layout].inner)}>
          <motion.div
            className={cn("mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)] justify-items-center gap-5 text-center", layouts[layout].copy)}
            variants={heroGroup}
            initial={animateIn ? "hidden" : false}
            animate="shown"
          >
            {announcement && (
              <motion.div variants={item}>
                {announcement.href ? (
                  <a className={announcementClass} href={announcement.href} onClick={announcement.onClick}>
                    {announcement.label}
                    {arrowIcon}
                  </a>
                ) : (
                  <button type="button" className={announcementClass} onClick={announcement.onClick}>
                    {announcement.label}
                    {arrowIcon}
                  </button>
                )}
              </motion.div>
            )}
            <motion.h1 variants={item} className={cn(shell.title, "max-w-[16ch]")}>
              {title}
            </motion.h1>
            {description && (
              <motion.p variants={item} className={cn(shell.description, "max-w-[560px]")}>
                {description}
              </motion.p>
            )}
            {(primaryAction || secondaryAction) && (
              <motion.div variants={item} className={cn("mt-3 flex flex-wrap justify-center gap-3 @max-[560px]/hero:w-full", layouts[layout].actions)}>
                {primaryAction && <ActionLink action={primaryAction} kind="primary" />}
                {secondaryAction && <ActionLink action={secondaryAction} kind="secondary" />}
              </motion.div>
            )}
            {command && (
              <motion.div
                variants={item}
                className={cn("mt-2 flex h-control-md w-[min(100%,440px)] items-center gap-2 rounded-control border border-border bg-surface pr-1 pl-4 text-left text-[13px]", mono)}
              >
                <span className="text-text-muted" aria-hidden="true">
                  $
                </span>
                <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-foreground [font:inherit]">{command.command}</code>
                <CopyButton value={command.command} label="Copy install command" iconOnly variant="plain" />
              </motion.div>
            )}
            {meta && meta.length > 0 && (
              <motion.ul variants={item} className="m-0 mt-4 flex list-none flex-wrap gap-x-5 gap-y-2 border-t border-border-subtle p-0 pt-5 text-sm text-text-muted">
                {meta.map(entry => (
                  <li key={entry}>{entry}</li>
                ))}
              </motion.ul>
            )}
          </motion.div>
          {media && (
            <motion.div className="min-w-0" variants={item} initial={animateIn ? "hidden" : false} animate="shown">
              {media}
            </motion.div>
          )}
        </div>
      </section>
    </ReducedMotionConfig>
  )
}

/* ---------------------------------------------------------------------------------------------------------------------
   Mesh (minimal): editorial type over a mesh gradient
   ------------------------------------------------------------------------------------------------------------------ */

export interface HeroCadenceProps {
  primaryAction?: HeroAction
  secondaryAction?: HeroAction
  animateIn?: boolean
  className?: string
}

/** Six points, authored the way the Gradient mesh editor saves them. Colors live in CSS, one palette per theme. */
const CADENCE_MESH: HeroMeshPoint[] = [
  { x: 0.1, y: 0.88, spread: 0.72 },
  { x: 0.86, y: 0.12, spread: 0.66 },
  { x: 0.16, y: 0.14, spread: 0.56 },
  { x: 0.62, y: 0.62, spread: 0.5 },
  { x: 0.94, y: 0.92, spread: 0.48 },
  { x: 0.44, y: 0.3, spread: 0.34 },
]

/** Sample customers. The marks are the brands' own icons, drawn in the text color. */
const BRANDS = [
  { name: "Linear", logo: "/block-logos/linear.svg" },
  { name: "Vercel", logo: "/block-logos/vercel.svg" },
  { name: "Raycast", logo: "/block-logos/raycast.svg" },
  { name: "Notion", logo: "/block-logos/notion.svg" },
  { name: "Figma", logo: "/block-logos/figma.svg" },
  { name: "Stripe", logo: "/block-logos/stripe.svg" },
  { name: "Loom", logo: "/block-logos/loom.svg" },
]

const fadeText = (percent: number) => `text-[color:color-mix(in_oklab,var(--foreground)_${percent}%,transparent)]`

/** Minimal hero, one full screen: large type over a slowly drifting mesh gradient with grain, and the teams that use the product along the bottom edge. */
export function HeroCadence({
  primaryAction = { label: "Download for Mac", doneLabel: "Download started" },
  secondaryAction = { label: "Try it on the web", doneLabel: "Opening Cadence" },
  animateIn = true,
  className,
}: HeroCadenceProps) {
  const item = heroRise
  // Reduced motion: Motion skips every transform (rise, zoom, tilt entrance); opacity still fades briefly.
  return (
    <ReducedMotionConfig>
      <section
        className={cn(
          shell.hero,
          shell.screen,
          // Minimal: the mesh is the whole screen, and type does the rest. The copy sits in the optical centre; customers hold the bottom edge.
          "isolate grid",
          // A theme-aware scrim keeps body text above 4.5:1 wherever the mesh drifts.
          "after:pointer-events-none after:absolute after:inset-0 after:-z-1 after:bg-[linear-gradient(to_bottom,transparent_40%,color-mix(in_oklab,var(--background)_22%,transparent))] after:content-['']",
          className,
        )}
      >
        <HeroMesh
          className="-z-1 [--mesh-1:#bdd3ec] [--mesh-2:#c3c6ff] [--mesh-3:#ffd0b0] [--mesh-4:#f6bfd6] [--mesh-5:#cfe8dc] [--mesh-6:#fff3dc] [--mesh-base:#f2ede7] dark:[--mesh-1:#0d3a47] dark:[--mesh-2:#2a2f86] dark:[--mesh-3:#5a2a3c] dark:[--mesh-4:#3a1f5a] dark:[--mesh-5:#7a3a22] dark:[--mesh-6:#12142c] dark:[--mesh-base:#09090f]"
          points={CADENCE_MESH}
          grain={0.55}
          speed={0.45}
        />
        <motion.div
          className="mx-auto box-border grid w-full max-w-[1320px] grid-rows-[1fr_auto_auto_1fr_auto] gap-10 px-10 pt-[clamp(88px,12svh,128px)] pb-10 @max-[560px]/hero:gap-6 @max-[560px]/hero:px-4 @max-[560px]/hero:pt-20 @max-[560px]/hero:pb-6"
          variants={heroGroup}
          initial={animateIn ? "hidden" : false}
          animate="shown"
        >
          <motion.h1 variants={item} className={cn(shell.title, "row-start-2 max-w-[14ch] text-[length:clamp(2.75rem,1rem_+_7cqi,7rem)]")}>
            Your week, planned before Monday
          </motion.h1>
          <div className="row-start-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-16 gap-y-8 @max-[800px]/hero:grid-cols-[minmax(0,1fr)] @max-[800px]/hero:items-start">
            <motion.p variants={item} className={cn(shell.description, "max-w-[520px]", fadeText(76))}>
              Cadence reads your tasks, meetings and focus goals, then books time for the work that matters. When plans change, it moves everything for you.
            </motion.p>
            <motion.div variants={item} className="grid justify-items-end gap-3 @max-[800px]/hero:justify-items-start @max-[560px]/hero:w-full">
              <div className="flex flex-wrap gap-3 @max-[560px]/hero:w-full @max-[560px]/hero:*:flex-auto">
                <ActionLink action={primaryAction} kind="primary" />
                <ActionLink action={secondaryAction} kind="secondary" />
              </div>
              <p className={cn("m-0 text-sm", fadeText(62))}>Free for personal use. Teams from $8 a seat.</p>
            </motion.div>
          </div>
          <motion.div variants={item} className="row-start-5 grid gap-5 border-t border-[color-mix(in_oklab,var(--foreground)_14%,transparent)] pt-6">
            <p className={cn("m-0 text-sm", fadeText(62))}>Teams at these companies plan with Cadence</p>
            <ul
              className="m-0 flex list-none flex-wrap justify-between gap-x-8 gap-y-5 p-0 @max-[800px]/hero:grid @max-[800px]/hero:grid-cols-4 @max-[560px]/hero:grid-cols-3 @max-[560px]/hero:gap-x-3 @max-[560px]/hero:gap-y-4"
              aria-label="Sample customers"
            >
              {BRANDS.map(brand => (
                <li
                  key={brand.name}
                  className={cn("inline-flex items-center gap-[9px] text-lg font-medium tracking-body @max-[560px]/hero:text-base @max-[560px]/hero:nth-[n+7]:hidden", fadeText(78))}
                >
                  <i
                    className="size-[22px] bg-current [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] @max-[560px]/hero:size-[18px]"
                    style={{ maskImage: `url(${brand.logo})`, WebkitMaskImage: `url(${brand.logo})` }}
                    aria-hidden="true"
                  />
                  {brand.name}
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      </section>
    </ReducedMotionConfig>
  )
}

/* ---------------------------------------------------------------------------------------------------------------------
   Screenshot (centered): a live dashboard rising from the bottom edge
   ------------------------------------------------------------------------------------------------------------------ */


/** Sample data for Lumen, a revenue analytics product. Replace it with your own product's numbers. */

type LumenRange = "30d" | "90d" | "12m";

const lumenRanges: { value: LumenRange; label: string }[] = [
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "12m", label: "12M" },
];

/** A smooth, deterministic walk: a trend, one slow wave, and a little noise that repeats for the same seed. */
function walk(count: number, start: number, end: number, wave: number, seed: number) {
  let s = seed;
  const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - .5; };
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return Math.round(start + (end - start) * (t * t * .35 + t * .65) + Math.sin(t * Math.PI * 2.3) * wave + rand() * wave * .6);
  });
}

const months = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];

function series(range: LumenRange): LineChartDatum[] {
  if (range === "12m") {
    const now = walk(12, 9_800, 36_400, 2_600, 7), before = walk(12, 6_200, 21_900, 2_200, 19);
    return months.map((month, i) => ({ key: `m${i}`, label: `${month} ${i < 3 ? 2025 : 2026}`, axisLabel: i % 2 === 0 ? month : undefined, values: { mrr: now[i], last: before[i] } }));
  }
  const days = range === "30d" ? 30 : 13;
  const step = range === "30d" ? 1 : 7;
  const now = walk(days, range === "30d" ? 640 : 4_300, range === "30d" ? 1_960 : 9_800, range === "30d" ? 260 : 900, range === "30d" ? 3 : 11);
  const before = walk(days, range === "30d" ? 520 : 3_600, range === "30d" ? 1_180 : 6_100, range === "30d" ? 220 : 700, 29);
  const end = new Date(Date.UTC(2026, 8, 24));
  return now.map((value, i) => {
    const date = new Date(end.getTime() - (days - 1 - i) * step * 86_400_000);
    const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    const every = range === "30d" ? 7 : 3;
    return { key: date.toISOString().slice(0, 10), label, axisLabel: (days - 1 - i) % every === 0 ? label : undefined, values: { mrr: value, last: before[i] } };
  });
}

const lumenSeries: Record<LumenRange, LineChartDatum[]> = { "30d": series("30d"), "90d": series("90d"), "12m": series("12m") };

interface LumenKpi {
  id: string;
  label: string;
  tone: "accent" | "success" | "warning" | "danger";
  byRange: Record<LumenRange, { value: string; change: string; data: number[] }>;
}

const lumenKpis: LumenKpi[] = [
  { id: "mrr", label: "MRR", tone: "accent", byRange: {
    "30d": { value: "$482.9K", change: "+8.2%", data: walk(12, 446, 483, 4, 5) },
    "90d": { value: "$482.9K", change: "+19.9%", data: walk(12, 402, 483, 6, 9) },
    "12m": { value: "$482.9K", change: "+51.7%", data: walk(12, 318, 483, 8, 13) },
  } },
  { id: "nrr", label: "Net retention", tone: "success", byRange: {
    "30d": { value: "118%", change: "+3 pts", data: walk(12, 112, 118, 1.5, 17) },
    "90d": { value: "116%", change: "+5 pts", data: walk(12, 109, 116, 1.8, 21) },
    "12m": { value: "114%", change: "+9 pts", data: walk(12, 103, 114, 2.4, 23) },
  } },
  { id: "new", label: "New customers", tone: "success", byRange: {
    "30d": { value: "214", change: "+12%", data: walk(12, 5, 9, 2, 31) },
    "90d": { value: "602", change: "+18%", data: walk(12, 38, 56, 6, 37) },
    "12m": { value: "2,140", change: "+34%", data: walk(12, 120, 214, 16, 41) },
  } },
  { id: "churn", label: "Churned MRR", tone: "success", byRange: {
    "30d": { value: "$6.1K", change: "−14%", data: walk(12, 9, 6, 1.2, 43) },
    "90d": { value: "$21.4K", change: "−9%", data: walk(12, 26, 21, 2, 47) },
    "12m": { value: "$96.8K", change: "−22%", data: walk(12, 12, 7, 1.4, 53) },
  } },
];

interface LumenMover {
  name: string;
  logo: string;
  /** Mono marks draw in the text color through a mask; color marks keep their own colors. */
  mono?: boolean;
  change: string;
  amount: number;
}

const lumenMovers: LumenMover[] = [
  { name: "Linear", logo: "/block-logos/linear-color.svg", change: "Moved to Enterprise", amount: 4_200 },
  { name: "Raycast", logo: "/block-logos/raycast-color.svg", change: "Added 120 seats", amount: 2_850 },
  { name: "Vercel", logo: "/block-logos/vercel.svg", mono: true, change: "Annual prepay", amount: 1_900 },
  { name: "Loom", logo: "/block-logos/loom-color.svg", change: "Removed 40 seats", amount: -1_240 },
  { name: "Supabase", logo: "/block-logos/supabase-color.svg", change: "Added forecasting", amount: 980 },
  { name: "Framer", logo: "/block-logos/framer.svg", mono: true, change: "Upgraded to Scale", amount: 760 },
];

const lumenInsight: Record<LumenRange, { lead: string; rest: string }> = {
  "30d": { lead: "MRR grew $36.4K this month.", rest: "62% came from 14 expansions on the Scale plan, led by Linear." },
  "90d": { lead: "MRR grew $80.6K this quarter.", rest: "Expansion outpaced new business for the first time since March." },
  "12m": { lead: "MRR grew $164.5K in twelve months.", rest: "Net retention above 110% did more than new logos did." },
};


/** A soft mesh across the whole screen: cool tints at the top, a warm one low behind the window, all a few steps off the page. */
const LUMEN_MESH: HeroMeshPoint[] = [
  { x: 0.1, y: 0.92, spread: 0.7 },
  { x: 0.92, y: 0.86, spread: 0.66 },
  { x: 0.14, y: 0.08, spread: 0.64 },
  { x: 0.86, y: 0.04, spread: 0.6 },
  { x: 0.5, y: 0.38, spread: 0.46 },
]

const NAV = [
  { label: "Overview", icon: PulseIcon, active: true },
  { label: "Revenue", icon: ChartLineIcon },
  { label: "Customers", icon: UsersIcon },
  { label: "Cohorts", icon: ChartBarIcon },
  { label: "Forecasts", icon: SparkleIcon },
  { label: "Reports", icon: BookOpenIcon },
]
const VIEWS = [
  { label: "Enterprise expansion", tone: "accent" },
  { label: "Churn risk", tone: "danger" },
  { label: "EU customers", tone: "neutral" },
]

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
const compact = (value: number) => (value >= 1000 ? `$${+(value / 1000).toFixed(1)}K` : `$${value}`)

/** Width the dashboard is designed at, wide and narrow. It is drawn at that size and scaled to fit, like a screenshot. */
const WIDE = 1200,
  NARROW = 600

export interface HeroLumenProps {
  primaryAction?: HeroAction
  secondaryAction?: HeroAction
  animateIn?: boolean
  className?: string
}

/**
 * Centered hero, one full screen: a headline over a drifting mesh, and a live revenue dashboard rising from the bottom edge. The
 * window settles from a tilt as it enters and runs off the bottom of the screen into a fade. It is real markup built from library
 * charts; its range control works.
 */
export function HeroLumen({
  primaryAction = { label: "Start free trial", doneLabel: "Trial started" },
  secondaryAction = { label: "Book a demo", doneLabel: "Demo requested" },
  animateIn = true,
  className,
}: HeroLumenProps) {
  const calm = !!useReducedMotion()
  const item = heroRise
  const stage = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: WIDE, scale: 1 })

  useLayoutEffect(() => {
    const node = stage.current
    if (!node) return
    const measure = () => {
      const css = getComputedStyle(node)
      const width = node.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight)
      const design = width < 720 ? NARROW : WIDE
      // On a phone the window keeps a legible size and crops evenly at both edges instead of shrinking to fit.
      setBox({ width: design, scale: design === NARROW ? Math.max(0.6, Math.min(1, width / design)) : Math.min(1, width / design) })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const narrow = box.width === NARROW
  const height = narrow ? 700 : 760

  // Reduced motion: Motion skips every transform (rise, zoom, tilt entrance); opacity still fades briefly.
  return (
    <ReducedMotionConfig>
      <section
        className={cn(
          shell.hero,
          // Centered, one full screen: copy over a drifting mesh, and a product window that rises from the bottom edge and runs off it.
          // The hero is exactly one screen tall (never shorter than 600px); the window takes whatever height the copy leaves.
          "isolate flex h-svh min-h-[600px] w-full flex-col pt-[clamp(88px,14svh,144px)] text-center",
          className,
        )}
      >
        <HeroMesh
          className="-z-1 [--mesh-1:#ffe6d8] [--mesh-2:#e3dcff] [--mesh-3:#dbe4ff] [--mesh-4:#f0e0ff] [--mesh-5:#e0eefc] [--mesh-base:var(--background)] dark:[--mesh-1:#2a1822] dark:[--mesh-2:#1c1a44] dark:[--mesh-3:#141c40] dark:[--mesh-4:#231842] dark:[--mesh-5:#0e2133]"
          points={LUMEN_MESH}
          grain={0.18}
          speed={0.55}
        />
        <motion.div
          className="relative mx-auto grid max-w-[900px] justify-items-center gap-5 px-10 @max-[560px]/hero:gap-4 @max-[560px]/hero:px-4"
          variants={heroGroup}
          initial={animateIn ? "hidden" : false}
          animate="shown"
        >
          <motion.h1 variants={item} className={cn(shell.title, "max-w-[14ch] text-[length:clamp(2.5rem,1.2rem_+_5cqi,var(--text-5xl))]")}>
            See every dollar of revenue move
          </motion.h1>
          <motion.p variants={item} className={cn(shell.description, "max-w-[590px]")}>
            Lumen connects Stripe, HubSpot and your warehouse, then explains each change in MRR the moment it happens. No SQL, no stale spreadsheets.
          </motion.p>
          <motion.div variants={item} className="mt-3 flex flex-wrap justify-center gap-3 @max-[560px]/hero:mt-2 @max-[560px]/hero:w-full @max-[560px]/hero:*:flex-auto">
            <ActionLink action={primaryAction} kind="primary" />
            <ActionLink action={secondaryAction} kind="secondary" />
          </motion.div>
          <motion.p variants={item} className="m-0 text-sm text-text-muted">
            Free for 14 days. Connects in about four minutes.
          </motion.p>
        </motion.div>

        {/* Stage: fills the rest of the screen and is the visible crop. The window runs past its bottom edge; the mask fades it into the
            mesh, so there is no hard edge. The halo above leaves room for the light behind the window. */}
        <motion.div
          ref={stage}
          className="relative mx-auto mt-[calc(var(--space-12)-var(--halo))] box-border min-h-0 w-full max-w-[calc(1200px+2*var(--space-10))] flex-[1_1_0] overflow-hidden px-10 pt-(--halo) [--halo:96px] [mask-image:linear-gradient(to_bottom,#000_62%,transparent_100%)] @max-[560px]/hero:mt-[calc(var(--space-10)-var(--halo))] @max-[560px]/hero:px-0 @max-[560px]/hero:[--halo:56px]"
          initial={animateIn ? { opacity: 0, y: 56 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={calm ? { duration: motionTokens.duration.standard } : { duration: 1.1, ease: [...motionTokens.ease.enter], delay: 0.32 }}
        >
          <div
            className="absolute inset-x-[10%] top-[calc(var(--halo)-110px)] -z-1 h-60 bg-[radial-gradient(50%_50%_at_50%_50%,var(--hero-glow),transparent_72%)] blur-[36px] [--hero-glow:color-mix(in_oklab,color-mix(in_oklab,var(--accent)_35%,#7d8cff)_36%,transparent)] dark:[--hero-glow:color-mix(in_oklab,color-mix(in_oklab,var(--accent)_30%,#6e7cff)_58%,transparent)]"
            aria-hidden="true"
          />
          <div className="flex justify-center [perspective-origin:50%_0%] [perspective:2200px]">
            <motion.div
              className="relative flex-none origin-top will-change-transform motion-reduce:will-change-auto"
              style={{ width: box.width * box.scale, height: height * box.scale }}
              initial={animateIn ? { rotateX: 22, scale: 0.94 } : false}
              animate={{ rotateX: 0, scale: 1 }}
              transition={{ duration: 1.5, ease: [...motionTokens.ease.enter], delay: 0.36 }}
            >
              {/* The scale is a Motion value rather than a CSS transform, so layout animations inside (the date range highlight)
                  are projected through it and slide exactly between options at any screen width. */}
              <motion.div className="absolute top-0 left-0" style={{ width: box.width, height, scale: box.scale, originX: 0, originY: 0 }}>
                <LumenDashboard narrow={narrow} />
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </section>
    </ReducedMotionConfig>
  )
}

const card = "grid min-w-0 content-start gap-3.5 rounded-xl border border-border-subtle bg-surface px-[18px] py-4"

/** The Lumen app window. Everything is content except the range control, which changes the data the whole screen shows. */
function LumenDashboard({ narrow }: { narrow: boolean }) {
  const [range, setRange] = useState<LumenRange>("30d")
  const insight = lumenInsight[range]
  return (
    <div
      className={cn(
        "relative grid h-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-border bg-surface text-left text-sm text-foreground",
        "shadow-[0_1px_1px_rgb(20_24_40/.04),0_24px_48px_-16px_rgb(20_24_40/.16),0_60px_120px_-40px_rgb(40_48_110/.22)]",
        "dark:border-[color-mix(in_oklab,var(--foreground)_14%,transparent)] dark:shadow-[inset_0_1px_0_color-mix(in_oklab,var(--foreground)_9%,transparent),0_24px_48px_-16px_rgb(0_0_0/.6),0_60px_140px_-40px_rgb(40_50_140/.35)]",
        // A thin light catches the top edge, the way a real display does in a dark room.
        "dark:after:pointer-events-none dark:after:absolute dark:after:inset-x-[12%] dark:after:top-0 dark:after:h-px dark:after:bg-[linear-gradient(to_right,transparent,color-mix(in_oklab,#b9c2ff_70%,transparent),transparent)] dark:after:content-['']",
      )}
      data-narrow={narrow || undefined}
      role="group"
      aria-label="Lumen revenue dashboard, sample data"
    >
      <div className="relative flex h-10 items-center justify-center border-b border-border-subtle bg-[color-mix(in_oklab,var(--surface-muted)_55%,var(--surface))]" aria-hidden="true">
        <span className="absolute left-4 flex gap-[7px] [&>i]:size-[11px] [&>i]:rounded-full [&>i]:bg-[color-mix(in_oklab,var(--foreground)_14%,transparent)]">
          <i />
          <i />
          <i />
        </span>
        <span className="rounded-lg bg-surface px-3.5 py-[3px] text-xs text-text-muted shadow-[inset_0_0_0_1px_var(--border-subtle)]">app.lumen.so/acme/overview</span>
      </div>
      <div className={cn("grid min-h-0", narrow ? "grid-cols-[minmax(0,1fr)]" : "grid-cols-[224px_minmax(0,1fr)]")}>
        {!narrow && (
          <aside className="flex flex-col gap-0.5 border-r border-border-subtle bg-[color-mix(in_oklab,var(--surface-muted)_40%,var(--surface))] px-3 py-3.5">
            <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-2.5">
              <span className="grid size-[22px] place-items-center rounded-md bg-foreground text-xs font-medium text-background">A</span>
              <span className="flex-1 font-medium">Acme Cloud</span>
              <CaretUpDownIcon size={14} className="text-text-muted" />
            </div>
            <div className="mb-2.5 flex items-center gap-2 rounded-[9px] border border-border-subtle bg-surface px-2 py-1.5 text-text-muted">
              <MagnifyingGlassIcon size={14} />
              Search<kbd className="ml-auto font-sans text-xs">⌘K</kbd>
            </div>
            <div className="grid gap-px">
              {NAV.map(({ label, icon: Icon, active }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-text-secondary data-[active]:bg-accent-subtle data-[active]:font-medium data-[active]:text-foreground [&>svg]:text-text-muted data-[active]:[&>svg]:text-accent"
                  data-active={active || undefined}
                >
                  <Icon size={15} />
                  {label}
                </div>
              ))}
            </div>
            <div className="mx-2 mt-[18px] mb-1.5 text-xs text-text-muted">Saved views</div>
            <div className="grid gap-px">
              {VIEWS.map(view => (
                <div key={view.label} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-text-secondary">
                  <i className="mx-[3px] size-2 rounded-full bg-text-muted data-[tone=accent]:bg-accent data-[tone=danger]:bg-danger" data-tone={view.tone} />
                  {view.label}
                </div>
              ))}
            </div>
            <div className="mt-auto flex items-center gap-2.5 border-t border-border-subtle px-1.5 pt-3 pb-0.5">
              <Avatar name="Chloe Nguyen" src={avatar("chloe-nguyen")} size="sm" />
              <span className="grid flex-1 leading-[1.3]">
                <strong className="font-medium">Chloe Nguyen</strong>
                <small className="text-xs text-text-muted">Data analyst</small>
              </span>
              <GearIcon size={15} className="text-text-muted" />
            </div>
          </aside>
        )}
        <div className="grid min-w-0 content-start gap-4 px-6 py-[22px]">
          <header className="flex items-center justify-between gap-4">
            <div>
              <h2 className="m-0 text-lg font-medium tracking-body">Revenue overview</h2>
              <p className="m-0 mt-0.5 text-xs text-text-muted">Synced with Stripe 2 minutes ago</p>
            </div>
            <SegmentedControl label="Date range" options={lumenRanges} value={range} onValueChange={value => setRange(value as LumenRange)} className="flex-none" />
          </header>

          <div className={cn("grid gap-3", narrow ? "grid-cols-2" : "grid-cols-4")}>
            {lumenKpis.map(kpi => {
              const now = kpi.byRange[range]
              return (
                <div
                  key={kpi.id}
                  // KPI tiles reuse Sparkline; its caption wraps so the label sits above a larger value.
                  className="min-w-0 rounded-xl border border-border-subtle bg-surface px-4 pt-3.5 pb-3 [&_figcaption]:flex-wrap [&_figcaption]:gap-y-1 [&_figcaption>:first-child]:basis-full [&_figcaption>:first-child]:text-xs [&_figcaption>:first-child]:text-text-muted [&_figcaption_small]:self-center [&_figcaption_strong]:ml-0 [&_figcaption_strong]:text-(length:--text-2xl) [&_figcaption_strong]:tracking-body"
                >
                  <Sparkline label={kpi.label} value={now.value} change={now.change} data={now.data} tone={kpi.tone} width={220} height={34} interactive={false} />
                </div>
              )
            })}
          </div>

          <div className={cn("grid gap-3", narrow ? "grid-cols-[minmax(0,1fr)]" : "grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]")}>
            <div className={card}>
              <div className="flex items-start justify-between gap-4">
                <p className="m-0 flex max-w-[46ch] gap-2 leading-[1.45] text-text-secondary [&_strong]:font-medium [&_strong]:text-foreground">
                  <SparkleIcon size={15} className="mt-0.5 flex-none text-accent" />
                  <span>
                    <strong>{insight.lead}</strong> {insight.rest}
                  </span>
                </p>
                <div className={cn("flex flex-none gap-3.5 text-xs text-text-muted [&_span]:inline-flex [&_span]:items-center [&_span]:gap-1.5", narrow && "hidden")} aria-hidden="true">
                  <span>
                    <i className="h-0.5 w-3.5 rounded-[2px] bg-accent" />
                    This period
                  </span>
                  <span>
                    <i className="h-0.5 w-3.5 rounded-[2px] bg-[repeating-linear-gradient(to_right,color-mix(in_oklab,var(--foreground)_46%,var(--surface))_0_4px,transparent_4px_7px)]" />
                    Last period
                  </span>
                </div>
              </div>
              <LineChart
                label="Net new MRR"
                data={lumenSeries[range]}
                series={[
                  { key: "mrr", label: "This period", area: true },
                  { key: "last", label: "Last period", dashed: true },
                ]}
                height={narrow ? 210 : 232}
                legend={false}
                formatValue={value => money.format(value)}
                formatTick={compact}
              />
            </div>
            {!narrow && (
              <div className={card}>
                <div className="flex justify-between font-medium">
                  Biggest movers<span className="text-xs font-normal text-text-muted">MRR change</span>
                </div>
                <ul className="m-0 grid list-none p-0">
                  {lumenMovers.map(mover => (
                    <li key={mover.name} className="flex items-center gap-3 border-t border-border-subtle py-2.5 first:border-t-0 first:pt-0.5">
                      <span
                        className="size-5 flex-none bg-contain bg-center bg-no-repeat data-[mono]:bg-foreground data-[mono]:[mask-position:center] data-[mono]:[mask-repeat:no-repeat] data-[mono]:[mask-size:contain]"
                        data-mono={mover.mono || undefined}
                        style={mover.mono ? { maskImage: `url(${mover.logo})`, WebkitMaskImage: `url(${mover.logo})` } : { backgroundImage: `url(${mover.logo})` }}
                      />
                      <span className="grid min-w-0 flex-1 leading-[1.3]">
                        <strong className="font-medium">{mover.name}</strong>
                        <small className="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-text-muted">{mover.change}</small>
                      </span>
                      <span className="font-medium text-success tabular-nums data-[down]:text-danger" data-down={mover.amount < 0 || undefined}>
                        {mover.amount < 0 ? "−" : "+"}
                        {money.format(Math.abs(mover.amount))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------------------------------------------------
   Workflow (split): a live workflow graph that routes sample events
   ------------------------------------------------------------------------------------------------------------------ */

type NodeId = "trigger" | "lookup" | "branch" | "slack" | "linear" | "warehouse"
type Status = "idle" | "running" | "done" | "skipped"

/** Sample events. Each one runs the same workflow; the branch decides which actions it reaches. */
const EVENTS = [
  { customer: "Northwind Labs", amount: "$4,800", plan: "Enterprise, 212 seats", routed: true, issue: "ONB-482", total: 412, ms: { lookup: 118, branch: 2, slack: 164, linear: 231, warehouse: 58 } },
  { customer: "Tidepool", amount: "$240", plan: "Team, 9 seats", routed: false, issue: "", total: 171, ms: { lookup: 96, branch: 1, slack: 0, linear: 0, warehouse: 61 } },
  { customer: "Halcyon Health", amount: "$12,600", plan: "Enterprise, 540 seats", routed: true, issue: "ONB-483", total: 436, ms: { lookup: 131, branch: 2, slack: 149, linear: 244, warehouse: 66 } },
] as const
type RelayEvent = (typeof EVENTS)[number]

/**
 * One run in phases. Odd phases run a step, even phases carry the data along the edges out of it; the last phase holds the
 * finished run on screen before the next event arrives. Durations in milliseconds.
 */
const PHASES = [900, 420, 380, 640, 380, 360, 440, 760, 2800]
const DONE = PHASES.length - 1
const STEPS: Record<NodeId, [start: number, end: number]> = { trigger: [1, 2], lookup: [3, 4], branch: [5, 6], slack: [7, 8], linear: [7, 8], warehouse: [7, 8] }
const ACTIONS = ["slack", "linear", "warehouse"] as const

function statusOf(id: NodeId, phase: number, event: RelayEvent): Status {
  const [start, end] = STEPS[id]
  if ((id === "slack" || id === "linear") && !event.routed && phase >= 6) return "skipped"
  return phase < start ? "idle" : phase < end ? "running" : "done"
}

/** The graph is drawn at a fixed size and scaled to its column, like a screenshot, so it never reflows mid run. */
type Box = { x: number; y: number; w: number; h: number }
const LAYOUTS = {
  wide: {
    width: 640,
    height: 524,
    summary: 480,
    nodes: {
      trigger: { x: 170, y: 0, w: 300, h: 60 },
      lookup: { x: 170, y: 112, w: 300, h: 60 },
      branch: { x: 170, y: 224, w: 300, h: 60 },
      slack: { x: 0, y: 356, w: 200, h: 84 },
      linear: { x: 220, y: 356, w: 200, h: 84 },
      warehouse: { x: 440, y: 356, w: 200, h: 84 },
    } as Record<NodeId, Box>,
  },
  narrow: {
    width: 344,
    height: 316,
    summary: 0,
    nodes: {
      trigger: { x: 0, y: 0, w: 344, h: 52 },
      lookup: { x: 0, y: 78, w: 344, h: 52 },
      branch: { x: 0, y: 156, w: 344, h: 52 },
      slack: { x: 0, y: 244, w: 108, h: 72 },
      linear: { x: 118, y: 244, w: 108, h: 72 },
      warehouse: { x: 236, y: 244, w: 108, h: 72 },
    } as Record<NodeId, Box>,
  },
}
type Layout = (typeof LAYOUTS)[keyof typeof LAYOUTS]

const EDGES: { from: NodeId; to: NodeId; phase: number }[] = [
  { from: "trigger", to: "lookup", phase: 2 },
  { from: "lookup", to: "branch", phase: 4 },
  { from: "branch", to: "slack", phase: 6 },
  { from: "branch", to: "linear", phase: 6 },
  { from: "branch", to: "warehouse", phase: 6 },
]

function edgePath(layout: Layout, from: NodeId, to: NodeId) {
  const a = layout.nodes[from],
    b = layout.nodes[to]
  const x1 = a.x + a.w / 2,
    y1 = a.y + a.h,
    x2 = b.x + b.w / 2,
    y2 = b.y
  const mid = (y2 - y1) / 2
  return `M ${x1} ${y1} C ${x1} ${y1 + mid} ${x2} ${y2 - mid} ${x2} ${y2}`
}

const RESULTS: Record<(typeof ACTIONS)[number], (event: RelayEvent) => string> = {
  slack: event => `Sent in ${event.ms.slack} ms`,
  linear: event => `${event.issue} in ${event.ms.linear} ms`,
  warehouse: event => `Saved in ${event.ms.warehouse} ms`,
}

const glyph = "text-text-secondary"
const spinner =
  "block size-[13px] flex-none animate-spin rounded-full border-[1.5px] border-[color-mix(in_oklab,var(--accent)_22%,transparent)] border-t-accent [animation-duration:.7s] motion-reduce:animate-none"
const logo = (name: string) => (
  <span className="size-[18px] bg-center bg-contain bg-no-repeat" style={{ backgroundImage: `url(/block-logos/${name}.svg)` }} aria-hidden="true" />
)

export interface HeroRelayProps {
  primaryAction?: HeroAction
  secondaryAction?: HeroAction
  animateIn?: boolean
  className?: string
}

/**
 * Split hero, one full screen: the copy beside a live workflow graph on a dotted canvas. Sample Stripe events arrive on their
 * own and run the workflow node by node; the data draws along each edge, the branch decides which actions run, and every step
 * reports its time. "Send test event" runs the next sample at once. The run pauses off screen, and under reduced motion each
 * event shows its finished run without playing.
 */
export function HeroRelay({
  primaryAction = { label: "Start building", doneLabel: "Workspace created" },
  secondaryAction = { label: "Read the docs", doneLabel: "Opening docs" },
  animateIn = true,
  className,
}: HeroRelayProps) {
  const item = heroRise
  const reduced = useHeroReducedMotion()
  const root = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<keyof typeof LAYOUTS>("wide")
  const [scale, setScale] = useState(1)
  const [run, setRun] = useState({ index: 0, count: 2418, phase: 0 })
  const [visible, setVisible] = useState(false)

  useLayoutEffect(() => {
    const node = stage.current
    if (!node) return
    const measure = () => {
      const width = node.clientWidth
      const next = width < 520 ? "narrow" : "wide"
      setMode(next)
      setScale(Math.min(1, width / LAYOUTS[next].width))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // The run only plays while the hero is on screen and the tab is visible.
  useEffect(() => {
    const node = root.current
    if (!node) return
    let onScreen = false
    const sync = () => setVisible(onScreen && document.visibilityState === "visible")
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      sync()
    })
    io.observe(node)
    document.addEventListener("visibilitychange", sync)
    return () => {
      io.disconnect()
      document.removeEventListener("visibilitychange", sync)
    }
  }, [])

  useEffect(() => {
    if (reduced || !visible) return
    const timer = window.setTimeout(
      () =>
        setRun(current =>
          current.phase < DONE ? { ...current, phase: current.phase + 1 } : { index: (current.index + 1) % EVENTS.length, count: current.count + 1, phase: 0 },
        ),
      PHASES[run.phase],
    )
    return () => window.clearTimeout(timer)
  }, [run.phase, run.index, reduced, visible])

  const sendTest = () => setRun(current => ({ index: (current.index + 1) % EVENTS.length, count: current.count + 1, phase: 1 }))

  const layout = LAYOUTS[mode]
  const event = EVENTS[run.index]
  // Reduced motion: every event is shown as its finished run; the button moves to the next one at once.
  const phase = reduced ? DONE : run.phase
  const status = (id: NodeId) => statusOf(id, phase, event)
  const narrow = mode === "narrow"

  // Reduced motion: Motion skips every transform (rise, tilt entrance); opacity still fades briefly.
  return (
    <ReducedMotionConfig>
      <section
        ref={root}
        className={cn(
          shell.hero,
          shell.screen,
          // Split, one full screen: the whole hero is a workflow canvas. A dot grid fills the screen, strongest behind the graph, and the
          // copy sits on the quiet side of it.
          "isolate grid items-center bg-[color-mix(in_oklab,var(--accent)_2%,var(--background))]",
          "[--dot:color-mix(in_oklab,var(--foreground)_13%,transparent)] [--node-shadow:0_1px_1px_rgb(20_24_40/.04),0_8px_24px_-12px_rgb(20_24_40/.14)] [--wire:color-mix(in_oklab,var(--foreground)_17%,transparent)]",
          "dark:[--dot:color-mix(in_oklab,var(--foreground)_17%,transparent)] dark:[--node-shadow:inset_0_1px_0_color-mix(in_oklab,var(--foreground)_7%,transparent),0_12px_32px_-14px_rgb(0_0_0/.7)] dark:[--wire:color-mix(in_oklab,var(--foreground)_20%,transparent)]",
          "before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:bg-[radial-gradient(circle_at_1px_1px,var(--dot)_1px,transparent_1.5px)] before:bg-[length:22px_22px] before:[mask-image:radial-gradient(70%_80%_at_72%_52%,#000_30%,transparent_85%)] before:content-['']",
          "@max-[900px]/hero:before:[mask-image:radial-gradient(90%_60%_at_50%_78%,#000_30%,transparent_85%)]",
          className,
        )}
      >
        <div className="mx-auto box-border grid w-full max-w-[1320px] grid-cols-[minmax(0,.92fr)_minmax(0,1fr)] items-center gap-16 px-10 pt-[clamp(88px,12svh,120px)] pb-12 @max-[900px]/hero:grid-cols-[minmax(0,1fr)] @max-[900px]/hero:gap-10 @max-[560px]/hero:gap-8 @max-[560px]/hero:px-4 @max-[560px]/hero:pt-20 @max-[560px]/hero:pb-6">
          <motion.div className="grid justify-items-start gap-5 text-left @max-[560px]/hero:gap-4" variants={heroGroup} initial={animateIn ? "hidden" : false} animate="shown">
            <motion.h1 variants={item} className={cn(shell.title, "max-w-[12ch] text-[length:clamp(2.5rem,1.2rem_+_4.6cqi,4.5rem)]")}>
              Every event, handled in milliseconds
            </motion.h1>
            <motion.p variants={item} className={cn(shell.description, "max-w-[500px]")}>
              Relay turns webhooks from Stripe, GitHub and Postgres into typed workflows with retries, branches and a trace of every run. Write steps in TypeScript, or wire them on the canvas.
            </motion.p>
            <motion.div variants={item} className="mt-3 flex flex-wrap gap-3 @max-[560px]/hero:mt-1 @max-[560px]/hero:w-full @max-[560px]/hero:*:flex-auto">
              <ActionLink action={primaryAction} kind="primary" />
              <ActionLink action={secondaryAction} kind="secondary" />
            </motion.div>
            <motion.p variants={item} className="m-0 text-sm text-text-muted">
              Free for 10,000 runs a month. No card needed.
            </motion.p>
          </motion.div>

          {/* The graph column: a small toolbar and the scaled graph under it. */}
          <motion.div
            className="grid min-w-0 justify-items-center gap-4 @max-[560px]/hero:gap-3"
            initial={animateIn ? { opacity: 0, y: 24 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: ease.enter, delay: 0.28 }}
          >
            <div className="flex w-[min(100%,640px)] items-center justify-between gap-3">
              <span className={cn("inline-flex min-w-0 items-center gap-2 text-[13px] text-text-secondary", mono)}>
                <i
                  className="size-[7px] flex-none rounded-full bg-text-muted [transition:background-color_var(--duration-standard)_var(--ease-standard)] data-[on]:bg-success motion-reduce:transition-none"
                  data-on={visible || reduced || undefined}
                  aria-hidden="true"
                />
                on-invoice-paid.ts
              </span>
              <Button variant="secondary" size="sm" onClick={sendTest}>
                Send test event
              </Button>
            </div>
            <div ref={stage} className="relative w-[min(100%,640px)]" style={{ height: layout.height * scale }}>
              <div
                className="absolute top-0 left-1/2 origin-top -translate-x-1/2"
                role="group"
                aria-label={`Relay workflow, sample run for ${event.customer}`}
                style={{ width: layout.width, height: layout.height, transform: `scale(${scale})` }}
              >
                <svg className="absolute inset-0 overflow-visible" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
                  {EDGES.map(edge => {
                    const d = edgePath(layout, edge.from, edge.to)
                    const skipped = status(edge.to) === "skipped"
                    const lit = phase >= edge.phase && !skipped
                    return (
                      <g key={`${edge.from}-${edge.to}`}>
                        <path d={d} className="fill-none stroke-(--wire) stroke-[1.25] data-[skipped]:opacity-70 data-[skipped]:[stroke-dasharray:3_4]" data-skipped={skipped || undefined} />
                        <motion.path
                          d={d}
                          className="fill-none stroke-accent stroke-[1.75] [stroke-linecap:round]"
                          initial={false}
                          animate={{ pathLength: lit ? 1 : 0, opacity: lit ? 1 : 0 }}
                          transition={lit && !reduced ? { pathLength: { duration: PHASES[edge.phase] / 1000, ease: ease.inOut }, opacity: { duration: 0.08 } } : { duration: 0 }}
                        />
                      </g>
                    )
                  })}
                </svg>

                <RelayNode box={layout.nodes.trigger} status={status("trigger")} icon={logo("stripe-color")} title="Invoice paid" sub={`${event.customer}, ${event.amount}`} />
                <RelayNode
                  box={layout.nodes.lookup}
                  status={status("lookup")}
                  icon={logo("hubspot-color")}
                  title="Find account in HubSpot"
                  sub={status("lookup") === "done" ? event.plan : "Plan, seats and owner"}
                  meta={`${event.ms.lookup} ms`}
                />
                <RelayNode
                  box={layout.nodes.branch}
                  status={status("branch")}
                  icon={<GitBranchIcon size={17} className={glyph} aria-hidden="true" />}
                  title="Amount over $1,000"
                  sub={status("branch") === "done" ? (event.routed ? "Yes, alert the team" : "No, record only") : "Condition"}
                  meta={`${event.ms.branch} ms`}
                />
                {ACTIONS.map(id => {
                  const s = status(id)
                  const copy = {
                    slack: { icon: logo("slack-color"), title: narrow ? "Slack" : "Post to #revenue", waiting: "Slack" },
                    linear: { icon: logo("linear-color"), title: narrow ? "Linear" : "Create Linear issue", waiting: "Onboarding team" },
                    warehouse: { icon: <DatabaseIcon size={16} className={glyph} aria-hidden="true" />, title: narrow ? "Warehouse" : "Save to warehouse", waiting: "Postgres" },
                  }[id]
                  const sub =
                    s === "skipped" ? "Skipped" : s === "done" ? (narrow ? `${event.ms[id]} ms` : RESULTS[id](event)) : s === "running" ? "Running" : narrow ? "Waiting" : copy.waiting
                  return <RelayNode key={id} box={layout.nodes[id]} compact status={s} icon={copy.icon} title={copy.title} sub={sub} />
                })}

                {!narrow && (
                  <div
                    className="absolute left-0 flex h-11 items-center justify-between gap-3 border-t border-border-subtle px-0.5 text-[13px] text-text-muted"
                    style={{ top: layout.summary, width: layout.width }}
                  >
                    <span className="inline-flex items-center gap-3">
                      <code className={cn("rounded-md border border-border-subtle bg-surface px-[7px] py-px text-xs text-text-secondary", mono)}>invoice.paid</code>
                      <span>
                        Run <span className="tabular-nums">{run.count.toLocaleString("en-US")}</span>
                      </span>
                    </span>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={phase === DONE ? `done-${run.count}` : phase === 0 ? "waiting" : "running"}
                        className="inline-flex items-center gap-[7px] data-[done]:text-foreground data-[done]:[&>svg]:text-success"
                        data-done={phase === DONE || undefined}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: motionTokens.duration.fast, ease: ease.standard }}
                      >
                        {phase === DONE ? (
                          <>
                            <CheckIcon size={14} aria-hidden="true" />
                            <span>
                              Completed in <span className="tabular-nums">{event.total} ms</span>
                            </span>
                          </>
                        ) : phase === 0 ? (
                          "Waiting for the next event"
                        ) : (
                          <>
                            <i className={spinner} aria-hidden="true" />
                            Running
                          </>
                        )}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </ReducedMotionConfig>
  )
}

function RelayNode({ box, status, icon, title, sub, meta, compact = false }: { box: Box; status: Status; icon: ReactNode; title: string; sub: string; meta?: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        // A node: what the step is, what it found, and its state. The running step takes the accent.
        "absolute flex items-center gap-3 rounded-[14px] border border-border bg-surface px-3.5 text-[13px] leading-[1.3] [box-shadow:var(--node-shadow)]",
        "[transition:border-color_var(--duration-standard)_var(--ease-standard),opacity_var(--duration-standard)_var(--ease-standard),background-color_var(--duration-standard)_var(--ease-standard)] motion-reduce:transition-none",
        "data-[status=running]:border-[color-mix(in_oklab,var(--accent)_70%,var(--border))] data-[status=running]:bg-[color-mix(in_oklab,var(--accent)_4%,var(--surface))]",
        "data-[status=skipped]:opacity-50 data-[status=skipped]:[box-shadow:none]",
        // Compact nodes on a phone: icon and state on top, the name and its result under them.
        compact && "grid grid-cols-[1fr_auto] grid-rows-[auto_auto] content-center gap-x-1 gap-y-2 px-3.5 @max-[560px]/hero:gap-y-1.5 @max-[560px]/hero:px-2.5",
      )}
      data-status={status}
      data-compact={compact || undefined}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h } as CSSProperties}
    >
      <span className="grid size-5 flex-none place-items-center">{icon}</span>
      <span className={cn("grid min-w-0 flex-1", compact && "col-span-full")}>
        <strong className="overflow-hidden font-medium text-ellipsis whitespace-nowrap">{title}</strong>
        <small className="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-text-muted">{sub}</small>
      </span>
      <span className={cn("grid flex-none justify-items-end", compact && "col-start-2 row-start-1")}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={status}
            className="inline-flex items-center gap-1.5"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={motionTokens.spring.snappy}
          >
            {status === "running" ? (
              <i className={spinner} role="img" aria-label="Running" />
            ) : status === "done" ? (
              <>
                {meta && <span className="text-xs text-text-muted tabular-nums">{meta}</span>}
                <CheckIcon size={14} className="text-success" role="img" aria-label="Done" />
              </>
            ) : status === "skipped" ? (
              <MinusIcon size={14} className="text-text-muted" role="img" aria-label="Skipped" />
            ) : (
              <i className="block size-2.5 rounded-full border-[1.5px] border-[color:var(--wire)]" role="img" aria-label="Waiting" />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
    </div>
  )
}

/* ---------------------------------------------------------------------------------------------------------------------
   HeroSection
   ------------------------------------------------------------------------------------------------------------------ */

export type HeroSectionVariant = "centered" | "split" | "minimal"

export interface HeroSectionProps {
  /**
   * `centered` is a headline over a drifting mesh with a live dashboard rising from the bottom edge, `split` sets the copy
   * beside a live workflow graph that runs sample events node by node, and `minimal` is large type over a mesh gradient.
   * Each design fills one full screen.
   */
  variant?: HeroSectionVariant
  /** Plays the entrance once on mount. Defaults to true. */
  animateIn?: boolean
  /** The main call to action. With `doneLabel` and no `href`, the button confirms in place. */
  primaryAction?: HeroAction | null
  /** The second call to action. */
  secondaryAction?: HeroAction | null
  /**
   * Your own headline. When set, the hero renders your content in the chosen layout (see `HeroContent`) instead of the
   * designed sample, together with the props below.
   */
  title?: string
  description?: string
  announcement?: HeroAction | null
  /** Install commands for your own content; the first one is shown with a copy button. */
  install?: HeroInstallCommand[] | null
  /** A visual beside your own content in the split layout. */
  media?: ReactNode
  /** Small facts under your own content, such as the version and license. */
  meta?: string[]
  /** Kept for compatibility; highlighted phrases render as plain text. */
  highlight?: string
  className?: string
}

/**
 * A full screen landing page hero in three designs: a product screenshot in perspective over a drifting mesh, a live workflow
 * graph that routes sample events, and editorial type over a mesh gradient.
 */
export function HeroSection({ variant = "centered", animateIn = true, primaryAction, secondaryAction, title, description, announcement, install, media, meta, className }: HeroSectionProps) {
  if (title)
    return (
      <HeroContent
        layout={variant}
        title={title}
        description={description}
        announcement={announcement}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
        install={install}
        media={media}
        meta={meta}
        animateIn={animateIn}
        className={className}
      />
    )
  const actions = { primaryAction: primaryAction ?? undefined, secondaryAction: secondaryAction ?? undefined }
  if (variant === "split") return <HeroRelay animateIn={animateIn} className={className} {...actions} />
  if (variant === "minimal") return <HeroCadence animateIn={animateIn} className={className} {...actions} />
  return <HeroLumen animateIn={animateIn} className={className} {...actions} />
}

const variantOptions = [
  { value: "centered", label: "Screenshot" },
  { value: "split", label: "Workflow" },
  { value: "minimal", label: "Mesh" },
]

/**
 * Preview: the hero, full screen, with a small glass switch floating over its top edge. The switch takes no space of its own,
 * so every design fills the screen exactly. Switching replays the entrance.
 */
export function HeroSectionBlock({ variant: initial = "centered" }: { variant?: HeroSectionVariant }) {
  const [variant, setVariant] = useState<HeroSectionVariant>(initial)
  return (
    <div className="relative grid min-h-svh w-full [&>section]:min-h-[inherit]">
      <HeroSection key={variant} variant={variant} />
      {/* The segmented control drops its own well; the glass is its surface. */}
      <div
        className={cn(
          "absolute top-4 left-1/2 z-20 flex max-w-[calc(100%-2*var(--space-4))] -translate-x-1/2 rounded-pill border border-[color-mix(in_oklab,var(--foreground)_10%,transparent)]",
          "bg-[color-mix(in_oklab,var(--surface)_64%,transparent)] shadow-[0_1px_1px_rgb(20_24_40/.04),0_10px_30px_-12px_rgb(20_24_40/.22)] backdrop-blur-[18px] backdrop-saturate-150",
          "dark:border-[color-mix(in_oklab,var(--foreground)_14%,transparent)] dark:bg-[color-mix(in_oklab,var(--surface)_58%,transparent)] dark:shadow-[inset_0_1px_0_color-mix(in_oklab,var(--foreground)_8%,transparent),0_10px_30px_-12px_rgb(0_0_0/.6)]",
        )}
      >
        <SegmentedControl
          label="Hero design"
          options={variantOptions}
          value={variant}
          onValueChange={value => setVariant(value as HeroSectionVariant)}
          className="rounded-pill border-0 bg-transparent [&_button]:rounded-pill"
        />
      </div>
    </div>
  )
}

export default HeroSectionBlock
