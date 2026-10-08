"use client"

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
} from "react"
import { animate, motion, useMotionValue, useSpring, useTransform } from "motion/react"
import type { MotionValue } from "motion/react"

import { clamp } from "@/lib/gesture"
import { useMotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface FloatTab {
  /** Unique value. */
  value: string
  /** Visible label and accessible name. The trailing button shows only its icon and uses the label as its name. */
  label: string
  /** Icon at 22px; Phosphor icons are sized automatically. */
  icon: ReactNode
  /** Count shown in an accent dot on the icon. 0 or empty hides it. */
  unread?: number | string
}

export interface FloatTabsProps {
  tabs: FloatTab[]
  /** Controlled active tab. A value that matches no tab, or the trailing button, hides the lens. */
  value?: string
  /** Initial active tab when uncontrolled. Defaults to the first item. */
  defaultValue?: string
  /** Called when a tab or the trailing button is chosen by tap, drag, or keyboard. */
  onValueChange?: (value: string) => void
  /** A separate round glass tab beside the bar, such as search. */
  trailing?: FloatTab
  /** Controlled compact state. */
  compact?: boolean
  /** Initial compact state when uncontrolled. */
  defaultCompact?: boolean
  /** Called when the bar shrinks or grows. */
  onCompactChange?: (compact: boolean) => void
  /** Scroll container to watch. Leave it out to watch the window. */
  scrollRef?: RefObject<HTMLElement | null>
  /** Shrink on scroll down and grow on scroll up. */
  shrinkOnScroll?: boolean
  /** Accessible name of the navigation and its tab list. */
  label?: string
  className?: string
  style?: CSSProperties
}

/* ---------- geometry, in px ---------- */

/** Inset between the bar's rim and the lens at rest. */
const PAD = 4
/** Space between the bar and the trailing bubble. */
const BUBBLE_GAP = 10
/** Space kept free on both sides of the bar inside the nav. */
const SIDE = 12
const BAR_H = 62
const COMPACT_H = 48
const SLOT_MAX = 78
const SLOT_MIN = 56
const SLOT_COMPACT = 48
/** How far the icon sits above the bar's middle while the label shows under it. */
const ICON_RISE = 8
/** The bubble lens grows from this share of its size when the trailing button is chosen. */
const BUBBLE_LENS_FROM = 0.6
/** The bar lens shrinks to this share as it fades out for the trailing button. */
const LENS_HIDDEN_SCALE = 0.7

/* ---------- lens dynamics ---------- */

/** Lift grows with lens speed as 1 - e^(-speed / LIFT_SPEED): about .9 for a one tab hop, 1 for a far glide. */
const LIFT_SPEED = 140
/** A lifted lens is this much larger on both axes. */
const LIFT_GROW = 0.1
/** Speed stretch: up to this much wider and this much flatter, reached around STRETCH_SPEED px/s. */
const STRETCH_X = 0.16
const STRETCH_Y = 0.065
const STRETCH_SPEED = 700
/** Press lift on the selected tab, and the lift a drag grows to. */
const PRESS_LIFT = 0.6
const DRAG_LIFT = 1
/** An intent delay before a press lifts the lens, in s. */
const PRESS_DELAY = 0.09
/** Horizontal travel before a press turns into a drag. */
const DRAG_SLOP = 7
/** The lens chases the pointer on a stiff critically damped spring, faster than any token. */
const FOLLOW = { type: "spring", stiffness: 760, damping: 55 } as const
/** Lift falls back slower than it rises, after a short pause. */
const SETTLE = { type: "spring", visualDuration: 0.55, bounce: 0.05, delay: 0.1 } as const
/** Scroll travel that shrinks the bar, and the smaller travel back up that grows it. */
const COLLAPSE_AFTER = 36
const EXPAND_AFTER = 30

/* ---------- refraction (Chromium) ---------- */

/** How much the clear lens magnifies the backdrop under it when fully lifted. */
const MAGNIFY = 1.18
/** Rim refraction: width of the bent band and the largest shift, in px. */
const RIM_BEZEL = 15
const RIM_SHIFT = 13
/** Per channel spread of the rim and lens shift, for a slight dispersion. */
const DISPERSION = 0.07

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

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
 * Chromium renders SVG filters inside backdrop-filter. Safari and Firefox accept the syntax in CSS.supports but draw
 * nothing, so the engine is checked too; Chrome on iOS is WebKit and reports CriOS, not Chrome.
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

/* ---------- displacement maps ---------- */

/**
 * Paints a displacement map for a pill of w x h. Red carries the horizontal shift and green the vertical one, 128 is
 * no shift. "rim" bends only a band along the edge, sampling inward so the backdrop squeezes toward the rim like the
 * rounded edge of a glass slab. "lens" adds a shift toward the middle everywhere, which reads as magnification; its
 * values are normalized to the pill so the map can be stretched to any lens size. Blue stays neutral, so a pass can
 * select it to leave one axis alone.
 */
function paintMap(w: number, h: number, kind: "rim" | "lens") {
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const context = canvas.getContext("2d")
  if (!context) return undefined
  const image = context.createImageData(w, h)
  const hx = w / 2
  const hy = h / 2
  const radius = Math.min(hx, hy)
  const bezel = kind === "rim" ? RIM_BEZEL : Math.min(hx, hy) * 0.55
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - hx
      const py = y + 0.5 - hy
      // Signed distance to the rounded rectangle, and the outward normal of the nearest edge.
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
      if (depth > 0 && depth < bezel) {
        // Steepest at the rim, flat by the end of the bezel, like the slope of a rounded edge.
        const bend = (1 - depth / bezel) ** 2.2
        const strength = kind === "rim" ? 1 : 0.45
        dx -= nx * bend * strength
        dy -= ny * bend * strength
      }
      if (kind === "lens") {
        dx -= px / hx
        dy -= py / hy
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

/** Three shifted copies, one per color channel, screened back together. */
function Dispersed({
  input,
  map,
  scale,
  x,
  y,
  spread = DISPERSION,
}: {
  input: string
  map: string
  scale: number
  x: "R" | "B"
  y: "G" | "B"
  spread?: number
}) {
  const channels = [
    { name: "r", factor: 1 - spread, matrix: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" },
    { name: "g", factor: 1, matrix: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" },
    { name: "b", factor: 1 + spread, matrix: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" },
  ]
  return (
    <>
      {channels.map((channel) => (
        <feDisplacementMap
          key={`d${channel.name}`}
          in={input}
          in2={map}
          scale={scale * channel.factor}
          xChannelSelector={x}
          yChannelSelector={y}
          result={`shift-${channel.name}`}
          data-factor={channel.factor}
        />
      ))}
      {channels.map((channel) => (
        <feColorMatrix
          key={`m${channel.name}`}
          in={`shift-${channel.name}`}
          type="matrix"
          values={channel.matrix}
          result={`only-${channel.name}`}
        />
      ))}
      <feBlend in="only-r" in2="only-g" mode="screen" result="only-rg" />
      <feBlend in="only-rg" in2="only-b" mode="screen" />
    </>
  )
}


/* ---------- small parts ---------- */

/** Icons take the size of their slot. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-[22px] place-items-center [&_svg]:size-[22px] [&_svg]:shrink-0"
    >
      {children}
    </span>
  )
}

const hasUnread = (unread: number | string | undefined): unread is number | string =>
  unread !== undefined && unread !== 0 && unread !== ""

/** What screen readers hear after the name, such as "4 unread". */
const unreadText = (unread: number | string) => (typeof unread === "number" ? `${unread} unread` : unread)

function Badge({ unread }: { unread: number | string | undefined }) {
  if (!hasUnread(unread)) return null
  // The ring takes the glass color, so the dot reads as cut out of the icon.
  return (
    <span
      aria-hidden="true"
      className="absolute -top-[5px] left-[14px] inline-flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent px-1 text-[11px] leading-none font-medium text-accent-foreground tabular-nums shadow-[0_0_0_1.5px_var(--gtb-badge-ring)]"
    >
      {unread}
    </span>
  )
}

/** Outer hairline, top and bottom rim light, inner glow, an optional contrast border, then the drop shadows. */
const MATERIAL_SHADOW =
  "0 0 0 .5px var(--gtb-hairline), inset 0 1px .5px -.5px var(--gtb-rim), inset 0 -1px .5px -.5px var(--gtb-rim-low), inset 0 0 16px var(--gtb-glow), inset 0 0 0 var(--gtb-border-width) var(--gtb-border), var(--gtb-drop)"

/** The lens when it lifts: a whiter fill with its own top highlight, glow and shadow. */
const CLEAR_SHADOW =
  "inset 0 1px .5px -.5px var(--gtb-rim), inset 0 0 10px var(--gtb-clear-glow), 0 6px 18px -6px color-mix(in oklab,var(--shade) 28%, transparent)"

/** A thin specular ring, brightest at the top left and again at the bottom right, drawn only on the rim. */
function SpecularRing({ style }: { style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute rounded-pill p-px"
      style={{
        background:
          "linear-gradient(160deg, var(--gtb-rim) 0%, color-mix(in oklab, var(--gtb-rim) 8%, transparent) 30%, transparent 55%, color-mix(in oklab, var(--gtb-rim) 6%, transparent) 78%, color-mix(in oklab, var(--gtb-rim) 50%, transparent) 100%)",
        mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
        WebkitMask: "linear-gradient(#000 0 0) content-box xor, linear-gradient(#000 0 0)",
        inset: 0,
        ...style,
      }}
    />
  )
}

/** The glass itself: tint, frost (plus refraction in Chromium), rim light, inner glow and drop shadow. */
function Material({ backdrop }: { backdrop: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-pill bg-[var(--gtb-tint)]"
        style={{ boxShadow: MATERIAL_SHADOW, backdropFilter: backdrop, WebkitBackdropFilter: backdrop }}
      />
      <SpecularRing />
    </>
  )
}

interface TabProps {
  item: FloatTab
  index: number
  pos: MotionValue<number>
  shown: MotionValue<number>
  lift: MotionValue<number>
  slot: MotionValue<number>
  progress: MotionValue<number>
  selected: boolean
  focusable: boolean
  register: (index: number, node: HTMLButtonElement | null) => void
  onSelect: (index: number) => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void
}

function Tab({ item, index, pos, shown, lift, slot, progress, selected, focusable, register, onSelect, onKeyDown }: TabProps) {
  // How close the lens is to this tab. Tint and icon size follow the lens, not the selection, so they glide with it.
  const near = useTransform(() => shown.get() * (1 - Math.min(1, Math.abs(pos.get() - index))))
  const color = useTransform(near, (n) => `color-mix(in oklab, var(--gtb-active) ${(n * 100).toFixed(1)}%, var(--gtb-ink))`)
  const scale = useTransform(() => 1 + LIFT_GROW * lift.get() * near.get())
  const iconY = useTransform(progress, (p) => -ICON_RISE * (1 - p))
  const labelOpacity = useTransform(progress, (p) => Math.max(0, 1 - 2.5 * p))
  const labelScale = useTransform(progress, (p) => 1 - 0.12 * p)
  const labelY = useTransform(progress, (p) => 5 * p)
  return (
    <motion.button
      ref={(node) => register(index, node)}
      type="button"
      role="tab"
      aria-selected={selected}
      // The visible digit is hidden from screen readers; the name carries it as "3 new" instead.
      aria-label={hasUnread(item.unread) ? `${item.label} (${unreadText(item.unread)})` : undefined}
      tabIndex={focusable ? 0 : -1}
      data-index={index}
      className="relative h-full flex-none cursor-pointer border-0 bg-transparent p-0 outline-none [-webkit-tap-highlight-color:transparent]"
      style={{ width: slot, color }}
      onClick={() => onSelect(index)}
      onKeyDown={(event) => onKeyDown(event, index)}
    >
      <motion.span className="absolute top-1/2 left-1/2 -mt-[11px] -ml-[11px] size-[22px]" style={{ y: iconY, scale }}>
        <Icon>{item.icon}</Icon>
        <Badge unread={item.unread} />
      </motion.span>
      {/* Labels only fade when compact, so every tab keeps its name. */}
      <motion.span
        className="absolute inset-x-0.5 top-1/2 mt-2 truncate text-center text-xs leading-4 font-medium"
        style={{ y: labelY, scale: labelScale, opacity: labelOpacity }}
      >
        {item.label}
      </motion.span>
    </motion.button>
  )
}

/* ---------- the bar ---------- */

/**
 * A tab bar that hovers over the page in frosted glass: it blurs whatever scrolls beneath (and bends it at the rim in Chromium),
 * while a glass lens under the active tab slides, rises and magnifies as it travels, and can be dragged along the
 * tabs. An optional round trailing bubble sits beside it, and the bar shrinks to a compact pill of icons on scroll down.
 */
export function FloatTabs({
  tabs,
  value,
  defaultValue,
  onValueChange,
  trailing,
  compact,
  defaultCompact = false,
  onCompactChange,
  scrollRef,
  shrinkOnScroll = true,
  label = "Tabs",
  className,
  style,
}: FloatTabsProps) {
  const motionTokens = useMotionTokens()
  const reduced = useReducedMotion() ?? false
  const reduceTransparency = useMedia("(prefers-reduced-transparency: reduce)")
  const refract = useSyncExternalStore(subscribeNothing, supportsRefraction, () => false) && !reduceTransparency
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const ids = { bar: `gtb-bar-${uid}`, bubble: `gtb-bubble-${uid}`, lens: `gtb-lens-${uid}` }

  /* ---------- value ---------- */
  const [innerValue, setInnerValue] = useState(defaultValue ?? tabs[0]?.value)
  const current = value !== undefined ? value : innerValue
  const all = useMemo(() => (trailing ? [...tabs, trailing] : tabs), [trailing, tabs])
  const count = tabs.length
  const selectedIndex = tabs.findIndex((item) => item.value === current)
  const selectedAll = all.findIndex((item) => item.value === current)
  const actionSelected = !!trailing && trailing.value === current

  const latest = useRef({ current, onValueChange, onCompactChange })
  useLayoutEffect(() => {
    latest.current = { current, onValueChange, onCompactChange }
  })
  const choose = useCallback(
    (next: string) => {
      if (next === latest.current.current) return
      if (value === undefined) setInnerValue(next)
      latest.current.onValueChange?.(next)
    },
    [value],
  )

  /* ---------- compact ---------- */
  const [innerCompact, setInnerCompact] = useState(defaultCompact)
  const isCompact = compact ?? innerCompact
  const compactNow = useRef(isCompact)
  useLayoutEffect(() => {
    compactNow.current = isCompact
  }, [isCompact])
  const setCompact = useCallback(
    (next: boolean) => {
      if (next === compactNow.current) return
      compactNow.current = next
      if (compact === undefined) setInnerCompact(next)
      latest.current.onCompactChange?.(next)
    },
    [compact],
  )

  useEffect(() => {
    if (!shrinkOnScroll) return
    const element = scrollRef?.current ?? null
    const read = () => (element ? element.scrollTop : window.scrollY)
    let last = read()
    let travel = 0
    const onScroll = () => {
      const y = read()
      const delta = y - last
      last = y
      if (!delta) return
      // Count travel in one direction, so jitter and momentum reversals do not flip the bar. Near the top any step up
      // grows it.
      if (Math.sign(delta) !== Math.sign(travel)) travel = 0
      travel += delta
      if (delta < 0 && (y <= COLLAPSE_AFTER || travel < -EXPAND_AFTER)) setCompact(false)
      else if (delta > 0 && travel > COLLAPSE_AFTER) setCompact(true)
    }
    const target: HTMLElement | Window = element ?? window
    target.addEventListener("scroll", onScroll, { passive: true })
    return () => target.removeEventListener("scroll", onScroll)
  }, [shrinkOnScroll, scrollRef, setCompact])

  /* ---------- size ---------- */
  const navRef = useRef<HTMLElement>(null)
  const [navWidth, setNavWidth] = useState<number | null>(null)
  useEffect(() => {
    const nav = navRef.current
    if (!nav || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => setNavWidth(entry.contentRect.width))
    observer.observe(nav)
    return () => observer.disconnect()
  }, [])
  // Tabs share the room left after the bubble, from 78px down to 56px each.
  const room = (navWidth ?? 420) - SIDE * 2 - PAD * 2 - (trailing ? BAR_H + BUBBLE_GAP : 0)
  const slotOpen = clamp(room / Math.max(1, count), SLOT_MIN, SLOT_MAX)

  // One spring drives the compact morph: slot width, bar height, icon lift and label fade all read from it, so the
  // lens stays on its tab mid morph.
  const progress = useMotionValue(isCompact ? 1 : 0)
  const slotBase = useMotionValue(slotOpen)
  useLayoutEffect(() => slotBase.jump(slotOpen), [slotBase, slotOpen])
  useEffect(() => {
    const target = isCompact ? 1 : 0
    if (reduced) progress.jump(target)
    else animate(progress, target, motionTokens.spring.smooth)
  }, [isCompact, motionTokens.spring.smooth, progress, reduced])
  const slot = useTransform(() => lerp(slotBase.get(), SLOT_COMPACT, progress.get()))
  const barH = useTransform(progress, (p) => lerp(BAR_H, COMPACT_H, p))
  const barW = useTransform(() => count * slot.get() + PAD * 2)

  /* ---------- lens ---------- */
  // pos is the lens center in tab units, shown hides it in place for the trailing.
  const pos = useMotionValue(Math.max(0, selectedIndex))
  const shown = useMotionValue(selectedIndex >= 0 ? 1 : 0)
  const speedLiftGoal = useMotionValue(0)
  const speedLift = useSpring(speedLiftGoal, { visualDuration: 0.14, bounce: 0 })
  const stretchGoal = useMotionValue(0)
  const stretch = useSpring(stretchGoal, { visualDuration: 0.12, bounce: 0 })
  const pressLift = useMotionValue(0)
  const lift = useTransform(() => Math.max(speedLift.get(), pressLift.get()))
  const drag = useRef<{ pointer: number; startX: number; moved: boolean } | null>(null)
  const placed = useRef(false)

  // Speed lifts the lens and stretches it along its travel; both fall away as the spring slows.
  useEffect(() => {
    const update = () => {
      const speed = reduced || !pos.isAnimating() ? 0 : Math.abs(pos.getVelocity() * slot.get())
      speedLiftGoal.set(1 - Math.exp(-speed / LIFT_SPEED))
      stretchGoal.set(Math.tanh(speed / STRETCH_SPEED))
    }
    const stops = [pos.on("change", update), pos.on("animationComplete", update)]
    return () => stops.forEach((stop) => stop())
  }, [pos, reduced, slot, speedLiftGoal, stretchGoal])

  // The lens rectangle in bar coordinates, written by one handler so every layer reads the same frame.
  const lensX = useMotionValue(PAD)
  const lensY = useMotionValue(PAD)
  const lensW = useMotionValue(slotOpen)
  const lensH = useMotionValue(BAR_H - PAD * 2)
  const lensImage = useRef<SVGFEImageElement>(null)
  const lensPasses = useRef<SVGFilterElement>(null)
  const barImage = useRef<SVGFEImageElement>(null)
  const bubbleImage = useRef<SVGFEImageElement>(null)
  useEffect(() => {
    const update = () => {
      const s = slot.get()
      const h = barH.get()
      const l = lift.get()
      const st = stretch.get()
      // Lift grows the lens about its center; speed stretches it wide and flat; hiding shrinks it in place.
      const grow = (1 + LIFT_GROW * l) * lerp(LENS_HIDDEN_SCALE, 1, shown.get())
      const width = s * grow * (1 + STRETCH_X * st)
      const height = (h - PAD * 2) * grow * (1 - STRETCH_Y * st)
      const center = PAD + (pos.get() + 0.5) * s
      lensX.set(center - width / 2)
      lensY.set(h / 2 - height / 2)
      lensW.set(width)
      lensH.set(height)
      // Only the map rectangle and its strength follow the lens. Chromium drops a clip-path's or an ancestor's
      // rounding on a composited backdrop filter, so the refracting layer is the lens itself with its own radius.
      const image = lensImage.current
      if (image && l > 0.005) {
        image.setAttribute("width", String(width))
        image.setAttribute("height", String(height))
        const shrink = (1 - 1 / MAGNIFY) * l
        lensPasses.current?.querySelectorAll<SVGFEDisplacementMapElement>("feDisplacementMap").forEach((pass) => {
          const factor = Number(pass.dataset.factor ?? 1)
          const along = pass.dataset.axis === "y" ? height : width
          pass.setAttribute("scale", String(along * shrink * factor))
        })
      }
      barImage.current?.setAttribute("width", String(count * s + PAD * 2))
      barImage.current?.setAttribute("height", String(h))
      bubbleImage.current?.setAttribute("width", String(h))
      bubbleImage.current?.setAttribute("height", String(h))
    }
    update()
    const stops = [pos, slot, barH, lift, stretch, shown].map((source) => source.on("change", update))
    return () => stops.forEach((stop) => stop())
  }, [barH, count, lensH, lensW, lensX, lensY, lift, pos, shown, slot, stretch])

  useLayoutEffect(() => {
    if (selectedIndex < 0) {
      // The trailing takes the selection: the bar lens fades and shrinks where it is while the bubble lens grows.
      if (reduced) shown.jump(0)
      else animate(shown, 0, { duration: 0.2, ease: [...motionTokens.ease.standard] })
      return
    }
    if (drag.current?.moved) return
    const hidden = shown.get() < 0.05
    if (!placed.current || reduced || hidden) {
      // First placement, or back from the trailing: appear on the tab instead of travelling there.
      pos.jump(selectedIndex)
      if (!placed.current || reduced) shown.jump(1)
      else animate(shown, 1, { type: "spring", visualDuration: 0.3, bounce: 0 })
      placed.current = true
      return
    }
    animate(pos, selectedIndex, motionTokens.spring.morph)
    if (shown.get() < 1) animate(shown, 1, { type: "spring", visualDuration: 0.3, bounce: 0 })
  }, [motionTokens.ease.standard, motionTokens.spring.morph, pos, reduced, selectedIndex, shown])

  const clearOpacity = useTransform(() => shown.get() * lift.get())
  const clearVisibility = useTransform(clearOpacity, (o) => (o > 0.004 ? "visible" : "hidden"))

  /* ---------- pointer: press lift, drag, snap ---------- */
  const suppressClick = useRef(false)

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const tab = (event.target as HTMLElement).closest<HTMLElement>("[data-index]")
    if (!tab || event.button !== 0) return
    drag.current = { pointer: event.pointerId, startX: event.clientX, moved: false }
    // Until a drag captures the pointer, a release off the bar never reaches it, so the press also ends there.
    const pointer = event.pointerId
    const release = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", release)
      onPointerUp(next)
    }
    window.addEventListener("pointerup", release)
    window.addEventListener("pointercancel", release)
    // Pressing the selected tab lifts the lens after a short intent delay.
    if (Number(tab.dataset.index) === selectedIndex && !reduced)
      animate(pressLift, PRESS_LIFT, { ...motionTokens.spring.morph, delay: PRESS_DELAY })
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.pointer !== event.pointerId) return
    if (!state.moved) {
      // A press anywhere on the bar grabs the lens once it travels a few px sideways; vertical travel is ignored.
      if (Math.abs(event.clientX - state.startX) < DRAG_SLOP || selectedIndex < 0) return
      state.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
      if (!reduced) animate(pressLift, DRAG_LIFT, { type: "spring", visualDuration: 0.45, bounce: 0 })
    }
    // The lens center chases the pointer, held to the tabs; it never reaches the trailing.
    const rect = event.currentTarget.getBoundingClientRect()
    const target = clamp((event.clientX - rect.left - PAD) / slot.get() - 0.5, 0, count - 1)
    if (reduced) pos.jump(target)
    else animate(pos, target, FOLLOW)
  }

  const onPointerUp = (event: { pointerId: number }) => {
    const state = drag.current
    if (!state || state.pointer !== event.pointerId) return
    drag.current = null
    if (!reduced) animate(pressLift, 0, SETTLE)
    if (!state.moved) return
    // Some engines still send the click to the tab under the pointer; a drag must not select twice.
    suppressClick.current = true
    window.setTimeout(() => (suppressClick.current = false), 0)
    // Commit to the tab whose center is nearest the lens.
    const target = clamp(Math.round(pos.get()), 0, count - 1)
    if (target !== selectedIndex) choose(tabs[target].value)
    else if (reduced) pos.jump(target)
    else animate(pos, target, motionTokens.spring.morph)
  }

  /* ---------- selection and keyboard ---------- */
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const register = useCallback((index: number, node: HTMLButtonElement | null) => {
    tabRefs.current[index] = node
  }, [])

  const onSelect = useCallback(
    (index: number) => {
      if (suppressClick.current) return
      setCompact(false)
      choose(all[index].value)
    },
    [all, choose, setCompact],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const last = all.length - 1
      const target =
        event.key === "ArrowRight"
          ? index === last
            ? 0
            : index + 1
          : event.key === "ArrowLeft"
            ? index === 0
              ? last
              : index - 1
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? last
                : -1
      if (target < 0) return
      event.preventDefault()
      choose(all[target].value)
      tabRefs.current[target]?.focus()
    },
    [all, choose],
  )

  const focusable = selectedAll >= 0 ? selectedAll : 0

  /* ---------- maps ---------- */
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false)
  const targetH = isCompact ? COMPACT_H : BAR_H
  const targetW = Math.round(count * (isCompact ? SLOT_COMPACT : slotOpen) + PAD * 2)
  const barMap = useMemo(() => (mounted && refract ? paintMap(targetW, targetH, "rim") : undefined), [mounted, refract, targetH, targetW])
  const bubbleMap = useMemo(
    () => (mounted && refract && trailing ? paintMap(targetH, targetH, "rim") : undefined),
    [trailing, mounted, refract, targetH],
  )
  const lensMap = useMemo(() => (mounted && refract ? paintMap(160, 80, "lens") : undefined), [mounted, refract])

  // Frost first, then bend the frosted backdrop at the rim.
  const glass = (id: string, map: string | undefined) =>
    reduceTransparency ? "none" : map ? `var(--gtb-glass) url(#${id})` : "var(--gtb-glass)"

  const lensRect = { x: lensX, y: lensY, width: lensW, height: lensH }
  const instant = { duration: 0 }

  return (
    <nav
      ref={navRef}
      aria-label={label}
      className={cn(
        "pointer-events-none flex justify-center pb-[env(safe-area-inset-bottom)] select-none",
        // Material tokens, per theme and for increased contrast.
        "[--gtb-tint:color-mix(in_oklab,var(--background)_56%,transparent)] [--gtb-ink:color-mix(in_oklab,var(--foreground)_88%,transparent)] [--gtb-active:var(--foreground)]",
        "[--gtb-glass:blur(18px)_saturate(1.8)_brightness(1.04)] [--gtb-hairline:color-mix(in_oklab,var(--shade)_7%,transparent)] [--gtb-rim:color-mix(in_oklab,var(--sheen)_95%,transparent)] [--gtb-rim-low:color-mix(in_oklab,var(--sheen)_50%,transparent)] [--gtb-glow:color-mix(in_oklab,var(--sheen)_32%,transparent)]",
        "[--gtb-drop:0_10px_30px_-10px_color-mix(in_oklab,var(--shade)_30%,transparent),0_2px_8px_-2px_color-mix(in_oklab,var(--shade)_10%,transparent)] [--gtb-border-width:0px] [--gtb-border:transparent]",
        "[--gtb-fill:color-mix(in_oklab,var(--shade)_7%,transparent)] [--gtb-lens-ring:color-mix(in_oklab,var(--sheen)_45%,transparent)] [--gtb-clear:color-mix(in_oklab,var(--sheen)_42%,transparent)] [--gtb-clear-glow:color-mix(in_oklab,var(--sheen)_32%,transparent)] [--gtb-badge-ring:var(--background)]",
        "dark:[--gtb-tint:color-mix(in_oklab,var(--background)_58%,transparent)] dark:[--gtb-ink:color-mix(in_oklab,var(--foreground)_86%,transparent)] dark:[--gtb-glass:blur(18px)_saturate(1.6)_brightness(.86)]",
        "dark:[--gtb-hairline:color-mix(in_oklab,var(--sheen)_7%,transparent)] dark:[--gtb-rim:color-mix(in_oklab,var(--sheen)_36%,transparent)] dark:[--gtb-rim-low:color-mix(in_oklab,var(--sheen)_14%,transparent)] dark:[--gtb-glow:color-mix(in_oklab,var(--sheen)_5%,transparent)]",
        "dark:[--gtb-drop:0_12px_32px_-10px_color-mix(in_oklab,var(--shade)_65%,transparent),0_2px_8px_-2px_color-mix(in_oklab,var(--shade)_40%,transparent)] dark:[--gtb-fill:color-mix(in_oklab,var(--sheen)_13%,transparent)] dark:[--gtb-lens-ring:color-mix(in_oklab,var(--sheen)_10%,transparent)] dark:[--gtb-clear:color-mix(in_oklab,var(--sheen)_14%,transparent)] dark:[--gtb-clear-glow:color-mix(in_oklab,var(--sheen)_8%,transparent)]",
        "contrast-more:[--gtb-tint:color-mix(in_oklab,var(--background)_94%,transparent)] contrast-more:[--gtb-ink:var(--foreground)] contrast-more:[--gtb-border-width:1px] contrast-more:[--gtb-border:var(--border-strong)]",
        "dark:contrast-more:[--gtb-tint:color-mix(in_oklab,var(--background)_94%,transparent)] dark:contrast-more:[--gtb-ink:var(--foreground)]",
        // Reduced transparency: a solid raised surface.
        "[@media(prefers-reduced-transparency:reduce)]:[--gtb-tint:var(--surface-raised)]",
        className,
      )}
      style={style}
    >
      <div
        role="tablist"
        aria-label={label}
        aria-orientation="horizontal"
        className="flex items-center"
        style={{ paddingInline: SIDE, gap: BUBBLE_GAP }}
      >
        <motion.div
          className="pointer-events-auto relative [touch-action:pan-y]"
          style={{ width: barW, height: barH }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onLostPointerCapture={onPointerUp}
        >
          <Material backdrop={glass(ids.bar, barMap)} />
          {/* The lens sits under the tabs. Its soft fill is always there; the clear glass and its rim cross-fade in
              with the lift, so the lens is clear while it moves and soft at rest. */}
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 rounded-pill bg-[var(--gtb-fill)] shadow-[inset_0_0_0_.5px_var(--gtb-lens-ring)]"
            style={{ ...lensRect, opacity: shown }}
          />
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 rounded-pill bg-[var(--gtb-clear)]"
            style={{
              ...lensRect,
              opacity: clearOpacity,
              visibility: clearVisibility,
              boxShadow: CLEAR_SHADOW,
              // In Chromium the clear lens also bends and magnifies the backdrop under it.
              backdropFilter: refract && lensMap ? `url(#${ids.lens})` : undefined,
            }}
          />
          <motion.span aria-hidden="true" className="pointer-events-none absolute top-0 left-0" style={{ ...lensRect, opacity: clearOpacity, visibility: clearVisibility }}>
            <SpecularRing />
          </motion.span>
          <div className="relative flex h-full" style={{ paddingInline: PAD }}>
            {tabs.map((item, index) => (
              <Tab
                key={item.value}
                item={item}
                index={index}
                pos={pos}
                shown={shown}
                lift={lift}
                slot={slot}
                progress={progress}
                selected={index === selectedIndex}
                focusable={index === focusable}
                register={register}
                onSelect={onSelect}
                onKeyDown={onKeyDown}
              />
            ))}
          </div>
        </motion.div>
        {trailing ? (
          <motion.div className="pointer-events-auto relative flex-none [touch-action:pan-y]" style={{ width: barH, height: barH }}>
            <Material backdrop={glass(ids.bubble, bubbleMap)} />
            {/* The bubble's own lens grows in when the trailing button is chosen; the bar lens never travels here. */}
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute rounded-pill bg-[var(--gtb-fill)] shadow-[inset_0_0_0_.5px_var(--gtb-lens-ring)]"
              style={{ inset: PAD }}
              initial={false}
              animate={{ opacity: actionSelected ? 1 : 0, scale: actionSelected ? 1 : BUBBLE_LENS_FROM }}
              transition={
                reduced
                  ? instant
                  : { opacity: { duration: actionSelected ? 0.11 : 0.1, ease: "easeOut" }, scale: motionTokens.spring.morph }
              }
            />
            <button
              ref={(node) => register(count, node)}
              type="button"
              role="tab"
              aria-selected={actionSelected}
              aria-label={hasUnread(trailing.unread) ? `${trailing.label} (${unreadText(trailing.unread)})` : trailing.label}
              tabIndex={focusable === count ? 0 : -1}
              className={cn(
                "relative grid size-full cursor-pointer place-items-center rounded-pill border-0 bg-transparent p-0 outline-none [-webkit-tap-highlight-color:transparent]",
                "transition-[color] duration-240 ease-standard motion-reduce:transition-none",
                actionSelected ? "text-[var(--gtb-active)]" : "text-[var(--gtb-ink)]",
              )}
              onClick={() => onSelect(count)}
              onKeyDown={(event) => onKeyDown(event, count)}
            >
              <span className="relative">
                <Icon>{trailing.icon}</Icon>
                <Badge unread={trailing.unread} />
              </span>
            </button>
          </motion.div>
        ) : null}
      </div>
      {refract ? (
        <svg aria-hidden="true" width="0" height="0" className="pointer-events-none absolute size-0 overflow-hidden">
          <defs>
            {[
              { id: ids.bar, map: barMap, ref: barImage, width: targetW },
              { id: ids.bubble, map: bubbleMap, ref: bubbleImage, width: targetH },
            ].map((entry) =>
              entry.map ? (
                <filter key={entry.id} id={entry.id} colorInterpolationFilters="sRGB">
                  {/* token-audit-ignore: neutral displacement-map grey, not a theme color */}
                  <feFlood floodColor="rgb(128,128,128)" result="neutral" />
                  <feImage
                    ref={entry.ref}
                    href={entry.map}
                    x="0"
                    y="0"
                    width={entry.width}
                    height={targetH}
                    preserveAspectRatio="none"
                    result="image"
                  />
                  <feComposite in="image" in2="neutral" operator="over" result="map" />
                  <Dispersed input="SourceGraphic" map="map" scale={RIM_SHIFT * 2} x="R" y="G" />
                </filter>
              ) : null,
            )}
            {lensMap ? (
              <filter ref={lensPasses} id={ids.lens} colorInterpolationFilters="sRGB">
                {/* token-audit-ignore: neutral displacement-map grey, not a theme color */}
                <feFlood floodColor="rgb(128,128,128)" result="neutral" />
                <feImage ref={lensImage} href={lensMap} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="image" />
                <feComposite in="image" in2="neutral" operator="over" result="map" />
                {/* Vertical first, then horizontal with dispersion: two passes keep the magnification even on a
                    stretched lens. */}
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="map"
                  scale="0"
                  xChannelSelector="B"
                  yChannelSelector="G"
                  result="rows"
                  data-axis="y"
                  data-factor="1"
                />
                <Dispersed input="rows" map="map" scale={0} x="R" y="B" spread={DISPERSION / 2} />
              </filter>
            ) : null}
          </defs>
        </svg>
      ) : null}
    </nav>
  )
}

export default FloatTabs
