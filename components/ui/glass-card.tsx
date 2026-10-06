"use client"

import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react"
import type { MotionStyle, TargetAndTransition } from "motion/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

export interface GlassCardProps {
  /** Photo behind the glass. */
  image: string
  /** Alt text for the photo. Pass an empty string when it is decorative. */
  imageAlt: string
  /** Main line in the glass panel, such as a name or a product. */
  title: string
  /** Second line under the title. */
  subtitle?: ReactNode
  /** Small element at the end of the header, such as a price, a rating, or a status. */
  aside?: ReactNode
  /** Detail content revealed when the card expands. Buttons inside stay interactive and do not toggle the card. */
  children?: ReactNode
  /** Controlled expanded state. */
  open?: boolean
  /** Initial expanded state when uncontrolled. */
  defaultOpen?: boolean
  /** Called when the card expands or collapses. */
  onOpenChange?: (open: boolean) => void
  /** Maximum tilt in degrees. 0 turns tilt off. */
  tilt?: number
  /** Extra class on the card. Set its width here; the card keeps a 4 by 5 ratio. */
  className?: string
  /** Inline style on the card. */
  style?: CSSProperties
}

/** Gap between the card edge and the glass panel, in px. The panel radius follows from it, so the corners stay concentric. */
const INSET = 12
const CARD_RADIUS = 34
const PANEL_RADIUS = CARD_RADIUS - INSET
/** The photo leans in a little while the card is open. */
const OPEN_SCALE = 1.06
/** Tilt and light follow the pointer on a responsive spring and drift home on a softer one. */
const FOLLOW = motionTokens.spring.gentle
/** Rim refraction: width of the bent band along the panel edge and the largest shift, in px. */
const RIM_BEZEL = 14
const RIM_SHIFT = 12
/** Per channel spread of the rim shift, for a faint dispersion. */
const DISPERSION = 0.06

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/* ---------- environment ---------- */

const subscribeNothing = () => () => {}

function useMedia(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener("change", onChange)
      return () => list.removeEventListener("change", onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

let refractionSupport: boolean | undefined
/**
 * Only Chromium draws SVG filters inside backdrop-filter. WebKit and Gecko accept the syntax in CSS.supports and then
 * draw nothing, so the engine is checked as well; everywhere else the panel is frosted only.
 */
function supportsRefraction() {
  if (refractionSupport !== undefined) return refractionSupport
  const data = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData
  const chromium = data?.brands
    ? data.brands.some((entry) => entry.brand === "Chromium")
    : /\bChrome\/\d+/.test(navigator.userAgent) && !/\bFirefox\//.test(navigator.userAgent)
  refractionSupport = chromium && typeof CSS !== "undefined" && CSS.supports("backdrop-filter", "url(#a)")
  return refractionSupport
}

/**
 * Paints a displacement map for a rounded rectangle of w x h with corner radius r. Red carries the horizontal shift
 * and green the vertical one, 128 is no shift. Only a band along the edge bends, sampling inward, so the photo seems to
 * squeeze toward the rim like light through the rounded edge of a glass slab. The flat middle stays untouched.
 */
function paintRimMap(w: number, h: number, r: number) {
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const context = canvas.getContext("2d")
  if (!context) return undefined
  const image = context.createImageData(w, h)
  const hx = w / 2
  const hy = h / 2
  const radius = Math.min(r, hx, hy)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - hx
      const py = y + 0.5 - hy
      // Signed distance into the rounded rectangle, and the outward normal of the nearest edge.
      const qx = Math.abs(px) - (hx - radius)
      const qy = Math.abs(py) - (hy - radius)
      const ox = Math.max(qx, 0)
      const oy = Math.max(qy, 0)
      const length = Math.hypot(ox, oy)
      const depth = radius - length - Math.min(Math.max(qx, qy), 0)
      let nx = 0
      let ny = 0
      if (qx > 0 && qy > 0 && length > 0) {
        nx = ox / length
        ny = oy / length
      } else if (qx > qy) nx = 1
      else ny = 1
      nx *= px < 0 ? -1 : 1
      ny *= py < 0 ? -1 : 1
      let dx = 0
      let dy = 0
      if (depth > 0 && depth < RIM_BEZEL) {
        // Steepest right at the rim and flat by the end of the band, like the slope of a rounded edge.
        const bend = (1 - depth / RIM_BEZEL) ** 2.4
        dx = -nx * bend
        dy = -ny * bend
      }
      const index = (y * w + x) * 4
      image.data[index] = Math.round(128 + 127 * clamp(dx, -1, 1))
      image.data[index + 1] = Math.round(128 + 127 * clamp(dy, -1, 1))
      image.data[index + 2] = 128
      image.data[index + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  return canvas.toDataURL()
}

/* ---------- material ---------- */

/** Outer hairline, top and bottom rim light, inner glow, an optional contrast border, then a soft drop. */
const MATERIAL_SHADOW =
  "0 0 0 .5px var(--gc-hairline), inset 0 1px .5px -.5px var(--gc-rim), inset 0 -1px .5px -.5px var(--gc-rim-low), inset 0 0 18px var(--gc-glow), inset 0 0 0 var(--gc-border-width) var(--gc-border), 0 10px 28px -14px oklch(0% 0 0 / .45)"

/** A ring only as wide as the rim; everything inside the padding box is masked away. */
const RING_MASK: CSSProperties = {
  mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
  WebkitMask: "linear-gradient(#000 0 0) content-box xor, linear-gradient(#000 0 0)",
}

/**
 * A photo card with a glass info panel. The panel's rim catches a specular highlight under the pointer, the card tilts
 * a few degrees toward it, and a tap morphs the panel up into a detail sheet.
 */
export function GlassCard({
  image,
  imageAlt,
  title,
  subtitle,
  aside,
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  tilt = 6,
  className,
  style,
}: GlassCardProps) {
  const reduced = useReducedMotion() ?? false
  const reduceTransparency = useMedia("(prefers-reduced-transparency: reduce)")
  const refract = useSyncExternalStore(subscribeNothing, supportsRefraction, () => false) && !reduceTransparency
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const ids = { header: `gc-header-${uid}`, detail: `gc-detail-${uid}`, filter: `gc-glass-${uid}` }

  /* ---------- open state ---------- */
  const [innerOpen, setInnerOpen] = useState(defaultOpen)
  const isOpen = open ?? innerOpen
  const latest = useRef({ isOpen, onOpenChange })
  useLayoutEffect(() => {
    latest.current = { isOpen, onOpenChange }
  })
  const setOpen = useCallback(
    (next: boolean) => {
      if (next === latest.current.isOpen) return
      if (open === undefined) setInnerOpen(next)
      latest.current.onOpenChange?.(next)
    },
    [open],
  )
  const headerRef = useRef<HTMLButtonElement>(null)

  /* ---------- geometry ---------- */
  const rootRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const cardW = useMotionValue(320)
  const cardH = useMotionValue(400)
  const panelH = useMotionValue(0)
  // Only settled sizes repaint the refraction map; the frames in between stretch the last one.
  const [mapSize, setMapSize] = useState<{ w: number; h: number } | null>(null)
  const placed = useRef(false)
  const reducedRef = useRef(reduced)
  useLayoutEffect(() => {
    reducedRef.current = reduced
  }, [reduced])

  useLayoutEffect(() => {
    const root = rootRef.current
    const content = contentRef.current
    if (!root || !content) return
    let running: ReturnType<typeof animate> | undefined
    const measure = () => {
      const w = root.offsetWidth
      const h = root.offsetHeight
      cardW.set(w)
      cardH.set(h)
      const target = Math.min(content.offsetHeight, h - INSET * 2)
      const panelW = Math.max(1, Math.round(w - INSET * 2))
      const settle = () => setMapSize((size) => (size && size.w === panelW && size.h === Math.round(target) ? size : { w: panelW, h: Math.round(target) }))
      if (Math.abs(panelH.get() - target) < 0.5 && placed.current) return
      running?.stop()
      if (!placed.current || reducedRef.current) {
        // First layout, or reduced motion: the panel switches size without a morph.
        placed.current = true
        panelH.jump(target)
        settle()
        return
      }
      // Growing into the sheet is the shape morph; folding back is critically damped so it never overshoots the header.
      const grow = target > panelH.get()
      running = animate(panelH, target, grow ? motionTokens.spring.morph : motionTokens.spring.smooth)
      running.then(settle)
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    observer.observe(content)
    return () => {
      observer.disconnect()
      running?.stop()
    }
  }, [cardH, cardW, panelH])

  /* ---------- pointer light and tilt ---------- */
  // Pointer position in card px, and how strongly the light is on. Springs ease toward them; nothing re-renders.
  const pointerX = useMotionValue(0.3)
  const pointerY = useMotionValue(0.2)
  const lit = useMotionValue(0)
  const sx = useSpring(pointerX, FOLLOW)
  const sy = useSpring(pointerY, FOLLOW)
  const glow = useSpring(lit, motionTokens.spring.smooth)
  const lean = useMotionValue(0)
  const leanSpring = useSpring(lean, FOLLOW)
  const rotateY = useTransform(() => (sx.get() - 0.5) * 2 * tilt * leanSpring.get())
  const rotateX = useTransform(() => -(sy.get() - 0.5) * 2 * tilt * leanSpring.get())

  // Everything the light needs is written as CSS variables, in card px, so the panel can offset it by its own position.
  const lightX = useTransform(() => sx.get() * cardW.get())
  const lightY = useTransform(() => sy.get() * cardH.get())
  const panelTop = useTransform(() => cardH.get() - INSET - panelH.get())
  const lightVars = {
    "--gc-lx": useMotionTemplate`${lightX}px`,
    "--gc-ly": useMotionTemplate`${lightY}px`,
    "--gc-lit": glow,
    "--gc-panel-top": useMotionTemplate`${panelTop}px`,
  } as unknown as MotionStyle

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    // Touch has no hover, so it keeps the card flat and only taps.
    if (event.pointerType === "touch") return
    const rect = event.currentTarget.getBoundingClientRect()
    pointerX.set(clamp((event.clientX - rect.left) / rect.width, 0, 1))
    pointerY.set(clamp((event.clientY - rect.top) / rect.height, 0, 1))
    lit.set(1)
    lean.set(reduced || tilt === 0 ? 0 : 1)
  }
  function onPointerLeave(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return
    // Settle back level, with the light drifting to its resting spot near the top left.
    pointerX.set(0.3)
    pointerY.set(0.2)
    lit.set(0)
    lean.set(0)
  }
  useEffect(() => {
    if (reduced || tilt === 0) {
      lean.jump(0)
      leanSpring.jump(0)
    }
  }, [lean, leanSpring, reduced, tilt])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || !latest.current.isOpen) return
    event.preventDefault()
    event.stopPropagation()
    setOpen(false)
    headerRef.current?.focus()
  }

  /* ---------- refraction ---------- */
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false)
  const rimMap = useMemo(
    () => (mounted && refract && mapSize && mapSize.h > 0 ? paintRimMap(mapSize.w, mapSize.h, PANEL_RADIUS) : undefined),
    [mapSize, mounted, refract],
  )
  const mapImage = useRef<SVGFEImageElement>(null)
  useEffect(() => {
    // The map rectangle follows the panel every frame, so the rim band stays on the rim while it morphs.
    const update = () => {
      mapImage.current?.setAttribute("width", String(Math.max(1, cardW.get() - INSET * 2)))
      mapImage.current?.setAttribute("height", String(Math.max(1, panelH.get())))
    }
    update()
    const stops = [panelH.on("change", update), cardW.on("change", update)]
    return () => stops.forEach((stop) => stop())
  }, [cardW, panelH, rimMap])

  // Frost first, then bend the frosted photo at the rim.
  const backdrop = reduceTransparency ? "none" : rimMap ? `var(--gc-frost) url(#${ids.filter})` : "var(--gc-frost)"

  const detailMotion: { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition } = reduced
    ? {
        // Same keys as the full branch, so the first render matches the server whichever branch the client picks.
        initial: { opacity: 0, y: 0, filter: "blur(0px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard] } },
        exit: { opacity: 0, transition: { duration: motionTokens.duration.instant } },
      }
    : {
        initial: { opacity: 0, y: 10, filter: `blur(${motionTokens.blur.soft}px)` },
        animate: {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { duration: motionTokens.duration.considered, ease: [...motionTokens.ease.enter], delay: 0.06 },
        },
        exit: {
          opacity: 0,
          filter: `blur(${motionTokens.blur.subtle}px)`,
          transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.exit] },
        },
      }
  const openTransition = reduced ? { duration: 0 } : motionTokens.spring.smooth

  return (
    <motion.div
      ref={rootRef}
      className={cn(
        "relative aspect-[4/5] w-full min-w-0 select-none [-webkit-tap-highlight-color:transparent]",
        // Material tokens, per theme and for increased contrast and reduced transparency.
        "[--gc-tint:color-mix(in_oklab,var(--background)_50%,transparent)] [--gc-frost:blur(16px)_saturate(1.7)_brightness(1.05)]",
        "[--gc-hairline:oklch(0%_0_0/.08)] [--gc-rim:oklch(100%_0_0/.9)] [--gc-rim-low:oklch(100%_0_0/.45)] [--gc-glow:oklch(100%_0_0/.28)] [--gc-spec:oklch(100%_0_0)]",
        "[--gc-border-width:0px] [--gc-border:transparent]",
        "dark:[--gc-tint:color-mix(in_oklab,var(--background)_56%,transparent)] dark:[--gc-frost:blur(16px)_saturate(1.5)_brightness(.84)]",
        "dark:[--gc-hairline:oklch(100%_0_0/.08)] dark:[--gc-rim:oklch(100%_0_0/.38)] dark:[--gc-rim-low:oklch(100%_0_0/.14)] dark:[--gc-glow:oklch(100%_0_0/.06)] dark:[--gc-spec:oklch(100%_0_0/.8)]",
        "contrast-more:[--gc-tint:color-mix(in_oklab,var(--background)_94%,transparent)] contrast-more:[--gc-border-width:1px] contrast-more:[--gc-border:var(--border-strong)]",
        "[@media(prefers-reduced-transparency:reduce)]:[--gc-tint:var(--surface-raised)]",
        className,
      )}
      style={{ ...lightVars, ...style }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onKeyDown={onKeyDown}
    >
      <motion.div
        className="relative size-full overflow-hidden rounded-surface bg-surface-muted shadow-floating"
        style={{ rotateX, rotateY, transformPerspective: 900 }}
      >
        {/* The photo is a pointer shortcut for the header button; keyboard users use the header. */}
        <motion.div
          aria-hidden={imageAlt === "" ? true : undefined}
          className="absolute inset-0 cursor-pointer"
          initial={false}
          animate={{ scale: isOpen ? OPEN_SCALE : 1 }}
          transition={openTransition}
          onClick={() => setOpen(!latest.current.isOpen)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={imageAlt} draggable={false} className="size-full object-cover" />
        </motion.div>
        {/* The floor shade grounds the panel and deepens while it is open, so the sheet reads over any photo. */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,oklch(0%_0_0/.5),oklch(0%_0_0/.18)_38%,transparent_62%)]"
          initial={false}
          animate={{ opacity: isOpen ? 1 : 0.6 }}
          transition={reduced ? { duration: motionTokens.duration.standard } : motionTokens.spring.smooth}
        />
        {/* A faint sheen across the whole photo, so the light is felt before it reaches the glass. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[calc(var(--gc-lit)*.5)] mix-blend-soft-light"
          style={{ background: "radial-gradient(circle 70% at var(--gc-lx) var(--gc-ly), oklch(100% 0 0 / .5), transparent 70%)" }}
        />

        <motion.div
          className="absolute overflow-hidden text-foreground"
          style={{ left: INSET, right: INSET, bottom: INSET, height: panelH, borderRadius: PANEL_RADIUS }}
        >
          {/* The glass: tint, frost (plus rim refraction in Chromium), rim light and inner glow. The refracting
              layer carries its own radius; Chromium drops an ancestor's rounding on a composited backdrop filter. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[var(--gc-tint)]"
            style={{ borderRadius: PANEL_RADIUS, boxShadow: MATERIAL_SHADOW, backdropFilter: backdrop, WebkitBackdropFilter: backdrop }}
          />
          {/* Resting rim light: a thin ring, brightest at the top left and again at the bottom right. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 p-px opacity-70"
            style={{
              ...RING_MASK,
              borderRadius: PANEL_RADIUS,
              background:
                "linear-gradient(160deg, var(--gc-rim) 0%, color-mix(in oklab, var(--gc-rim) 8%, transparent) 30%, transparent 55%, color-mix(in oklab, var(--gc-rim) 6%, transparent) 78%, color-mix(in oklab, var(--gc-rim) 45%, transparent) 100%)",
            }}
          />
          {/* The specular highlight under the pointer: a masked gradient on the rim, plus a soft bloom inside. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 p-[1.5px] opacity-[var(--gc-lit)] mix-blend-plus-lighter"
            style={{
              ...RING_MASK,
              borderRadius: PANEL_RADIUS,
              background: `radial-gradient(circle 120px at calc(var(--gc-lx) - ${INSET}px) calc(var(--gc-ly) - var(--gc-panel-top)), var(--gc-spec), color-mix(in oklab, var(--gc-spec) 30%, transparent) 45%, transparent 75%)`,
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[calc(var(--gc-lit)*.6)] mix-blend-soft-light"
            style={{
              borderRadius: PANEL_RADIUS,
              background: `radial-gradient(circle 180px at calc(var(--gc-lx) - ${INSET}px) calc(var(--gc-ly) - var(--gc-panel-top)), color-mix(in oklab, var(--gc-spec) 40%, transparent), transparent 70%)`,
            }}
          />

          <div ref={contentRef} className="relative">
            <button
              ref={headerRef}
              id={ids.header}
              type="button"
              aria-expanded={isOpen}
              aria-controls={ids.detail}
              className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-3.5 text-left text-inherit outline-none"
              onClick={() => setOpen(!latest.current.isOpen)}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base leading-6 font-medium">{title}</span>
                {subtitle ? <span className="truncate text-sm leading-5 text-text-secondary">{subtitle}</span> : null}
              </span>
              {aside ? <span className="flex flex-none items-center gap-1 text-sm leading-5 font-medium tabular-nums">{aside}</span> : null}
            </button>
            <AnimatePresence initial={false} mode="popLayout">
              {isOpen ? (
                <motion.div
                  key="detail"
                  id={ids.detail}
                  role="region"
                  aria-labelledby={ids.header}
                  className="px-4 pb-4 text-sm leading-5 text-text-secondary select-text"
                  {...detailMotion}
                >
                  {children}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>

      {rimMap ? (
        <svg aria-hidden="true" width="0" height="0" className="pointer-events-none absolute size-0 overflow-hidden">
          <defs>
            <filter id={ids.filter} colorInterpolationFilters="sRGB">
              <feFlood floodColor="rgb(128,128,128)" result="neutral" />
              <feImage ref={mapImage} href={rimMap} x="0" y="0" preserveAspectRatio="none" result="image" />
              <feComposite in="image" in2="neutral" operator="over" result="map" />
              {/* Three shifted copies, one per color channel, screened back together for a faint dispersion. */}
              {[
                { name: "r", factor: 1 - DISPERSION, matrix: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" },
                { name: "g", factor: 1, matrix: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" },
                { name: "b", factor: 1 + DISPERSION, matrix: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" },
              ].map((channel) => (
                <Fragment key={channel.name}>
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="map"
                    scale={RIM_SHIFT * 2 * channel.factor}
                    xChannelSelector="R"
                    yChannelSelector="G"
                    result={`shift-${channel.name}`}
                  />
                  <feColorMatrix in={`shift-${channel.name}`} type="matrix" values={channel.matrix} result={`only-${channel.name}`} />
                </Fragment>
              ))}
              <feBlend in="only-r" in2="only-g" mode="screen" result="only-rg" />
              <feBlend in="only-rg" in2="only-b" mode="screen" />
            </filter>
          </defs>
        </svg>
      ) : null}
    </motion.div>
  )
}

export default GlassCard
