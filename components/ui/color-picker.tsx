"use client"

import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react"
import { AnimatePresence, Reorder, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react"
import type { Transition } from "motion/react"
import { Check, Pipette, Plus } from "lucide-react"

import { TextMorph } from "@/components/ui/text-morph"
import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

export type ColorFormat = "hex" | "rgb" | "hsl" | "oklch"
export interface ColorSwatch {
  id: string
  color: string
}

/**
 * A color field whose swatch grows into a full picker. Pick saturation and brightness on the area, hue and opacity on the sliders, or type a value
 * in hex, RGB, HSL, or OKLCH; the format button morphs the text between them. The eyedropper appears where the browser supports it, saved
 * swatches can be added, applied, dragged or moved with Alt and the arrow keys, and removed with Delete. A contrast readout compares the color with
 * the background it will sit on. Arrow keys move every thumb, Shift takes bigger steps, and Escape closes the panel.
 */
export interface ColorPickerProps {
  /** Any color the picker can read: hex, rgb(), hsl(), or oklch(). */
  value?: string
  defaultValue?: string
  /** Receives the color as hex, with two alpha digits when it is not opaque. */
  onValueChange?: (hex: string) => void
  /** The background the color will sit on, for the contrast readout. */
  background?: string
  /** Name shown on the swatch, such as "Accent". */
  label?: string
  swatches?: ColorSwatch[]
  defaultSwatches?: ColorSwatch[]
  onSwatchesChange?: (swatches: ColorSwatch[]) => void
  /** Most saved swatches. Saving past it drops the oldest. */
  maxSwatches?: number
  defaultFormat?: ColorFormat
  className?: string
}

export type Hsva = { h: number; s: number; v: number; a: number }
type Rgba = { r: number; g: number; b: number; a: number }

const { spring, duration, blur } = motionTokens
const enterEase = [...motionTokens.ease.enter] as [number, number, number, number]
const standardEase = [...motionTokens.ease.standard] as [number, number, number, number]
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const round = (value: number, digits = 0) => {
  const f = 10 ** digits
  return Math.round(value * f) / f
}
const physical = (visualDuration: number, bounce: number): Transition => {
  const root = (2 * Math.PI) / (visualDuration * 1.2)
  return { type: "spring", stiffness: root * root, damping: 2 * (1 - bounce) * root, mass: 1, restDelta: 0.0005, restSpeed: 0.005 }
}
/** Thumbs chase the pointer on a quick spring with a little life, so a click lands with a soft settle and a drag trails by a hair. */
const thumbSpring = physical(0.26, 0.22)
/** Under a finger or mouse drag the thumb stays glued to the pointer: a stiff spring with no bounce, so it never trails or wobbles. */
const dragSpring = physical(0.1, 0)
const openSpring = physical(spring.morph.visualDuration, 0.1),
  closeSpring = physical(0.3, 0)
const instant: Transition = { duration: 0 }

/* Color math. sRGB channels are 0 to 1. */
function hsvToRgb({ h, s, v, a }: Hsva): Rgba {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return { r: f(5), g: f(3), b: f(1), a }
}
function rgbToHsv({ r, g, b, a }: Rgba, hue = 0): Hsva {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min
  let h = hue
  if (d > 1e-6) {
    if (max === r) h = 60 * (((g - b) / d) % 6)
    else if (max === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max, a }
}
function hslToRgb(h: number, s: number, l: number, a: number): Rgba {
  const k = (n: number) => (n + h / 30) % 12,
    c = s * Math.min(l, 1 - l)
  const f = (n: number) => l - c * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return { r: f(0), g: f(8), b: f(4), a }
}
function rgbToHsl({ r, g, b }: Rgba, hue: number) {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2,
    d = max - min
  const s = d < 1e-6 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return { h: d < 1e-6 ? hue : rgbToHsv({ r, g, b, a: 1 }).h, s, l }
}
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
function rgbToOklch({ r, g, b }: Rgba, hue: number) {
  const lr = toLinear(r),
    lg = toLinear(g),
    lb = toLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const C = Math.hypot(A, B)
  let H = (Math.atan2(B, A) * 180) / Math.PI
  if (H < 0) H += 360
  return { l: L, c: C, h: C < 0.0005 ? hue : H }
}
function oklchToRgb(L: number, C: number, H: number, a: number): Rgba {
  const A = C * Math.cos((H * Math.PI) / 180),
    B = C * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return {
    r: clamp(fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    g: clamp(fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    b: clamp(fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
    a,
  }
}
const byte = (c: number) => Math.round(clamp(c) * 255)
const hex2 = (c: number) => byte(c).toString(16).padStart(2, "0").toUpperCase()

export function toHex(hsva: Hsva) {
  const { r, g, b, a } = hsvToRgb(hsva)
  return `#${hex2(r)}${hex2(g)}${hex2(b)}${a < 0.999 ? hex2(a) : ""}`
}
function format(hsva: Hsva, kind: ColorFormat) {
  const rgb = hsvToRgb(hsva)
  const alpha = hsva.a < 0.999 ? ` / ${Math.round(hsva.a * 100)}%` : ""
  if (kind === "hex") return toHex(hsva)
  if (kind === "rgb") return `rgb(${byte(rgb.r)} ${byte(rgb.g)} ${byte(rgb.b)}${alpha})`
  if (kind === "hsl") {
    const { h, s, l } = rgbToHsl(rgb, hsva.h)
    return `hsl(${Math.round(h) % 360} ${Math.round(s * 100)}% ${Math.round(l * 100)}%${alpha})`
  }
  const { l, c, h } = rgbToOklch(rgb, hsva.h)
  return `oklch(${round(l * 100, 1)}% ${round(c, 3)} ${round(h, 1) % 360}${alpha})`
}
const readAlpha = (text?: string) =>
  text === undefined ? 1 : text.endsWith("%") ? clamp(parseFloat(text) / 100) : clamp(parseFloat(text))

/** Reads hex, rgb(), hsl(), and oklch() in modern or comma syntax. Returns null for anything else. */
export function parseColor(input: string, hue = 0): Hsva | null {
  const text = input.trim().toLowerCase()
  let match = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text)
  if (match) {
    let digits = match[1]
    if (digits.length <= 4)
      digits = digits
        .split("")
        .map((d) => d + d)
        .join("")
    const n = (i: number) => parseInt(digits.slice(i, i + 2), 16) / 255
    return rgbToHsv({ r: n(0), g: n(2), b: n(4), a: digits.length === 8 ? n(6) : 1 }, hue)
  }
  match = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+%?))?\s*\)$/.exec(text)
  if (match)
    return rgbToHsv({ r: clamp(+match[1] / 255), g: clamp(+match[2] / 255), b: clamp(+match[3] / 255), a: readAlpha(match[4]) }, hue)
  match = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%?[\s,]+([\d.]+)%?(?:\s*[/,]\s*([\d.]+%?))?\s*\)$/.exec(text)
  if (match) {
    const h = +match[1] % 360
    const next = rgbToHsv(hslToRgb(h, clamp(+match[2] / 100), clamp(+match[3] / 100), readAlpha(match[4])), h)
    return { ...next, h }
  }
  match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(text)
  if (match) {
    const L = match[2] ? +match[1] / 100 : +match[1]
    return rgbToHsv(oklchToRgb(clamp(L), +match[3], +match[4], readAlpha(match[5])), hue)
  }
  return null
}

/** WCAG contrast of a color, composited over the background, against that background. */
function contrast(hsva: Hsva, background: Rgba) {
  const fg = hsvToRgb(hsva)
  const mix = (c: number, bg: number) => c * fg.a + bg * (1 - fg.a)
  const lum = (r: number, g: number, b: number) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  const a = lum(mix(fg.r, background.r), mix(fg.g, background.g), mix(fg.b, background.b)),
    b = lum(background.r, background.g, background.b)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
const level = (ratio: number) => (ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA large" : "Fails")

const formats: ColorFormat[] = ["hex", "rgb", "hsl", "oklch"]
const formatNames: Record<ColorFormat, string> = { hex: "Hex", rgb: "RGB", hsl: "HSL", oklch: "OKLCH" }

const subscribe = () => () => {}
function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
function useEyeDropper() {
  return useSyncExternalStore(
    subscribe,
    () => "EyeDropper" in window,
    () => false,
  )
}
type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> }

/** Springs a motion value to a new target, or jumps under reduced motion. Retargeting keeps the current velocity. */
function useFollow(target: number, reduced: boolean, dragging = false) {
  const value = useMotionValue(target)
  useEffect(() => {
    if (reduced) {
      value.jump(target)
      return
    }
    const controls = animate(value, target, dragging ? dragSpring : thumbSpring)
    return () => controls.stop()
  }, [dragging, reduced, target, value])
  return value
}

/** Tracks a pointer drag over an element and reports its position as fractions of the element's box. */
function usePad(onMove: (x: number, y: number) => void, onActive: (active: boolean) => void) {
  const pointer = useRef<number | null>(null)
  const read = (event: ReactPointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    onMove(clamp((event.clientX - box.left) / box.width), clamp((event.clientY - box.top) / box.height))
  }
  return {
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (event.button !== 0 || pointer.current !== null) return
      pointer.current = event.pointerId
      event.currentTarget.setPointerCapture(event.pointerId)
      onActive(true)
      read(event)
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      if (event.pointerId === pointer.current) read(event)
    },
    onPointerUp(event: ReactPointerEvent<HTMLElement>) {
      if (event.pointerId !== pointer.current) return
      pointer.current = null
      onActive(false)
    },
    onPointerCancel(event: ReactPointerEvent<HTMLElement>) {
      if (event.pointerId !== pointer.current) return
      pointer.current = null
      onActive(false)
    },
  }
}

/** Arrow keys step by a small amount, Shift by ten, Page keys by ten, Home and End to the ends. */
function stepFor(event: ReactKeyboardEvent, axis: "x" | "y" | "both") {
  const big = event.shiftKey || event.key.startsWith("Page")
  const size = big ? 10 : 1
  const map: Record<string, [number, number]> = {
    ArrowRight: [size, 0],
    ArrowLeft: [-size, 0],
    ArrowUp: axis === "both" ? [0, size] : [size, 0],
    ArrowDown: axis === "both" ? [0, -size] : [-size, 0],
    PageUp: [10, 0],
    PageDown: [-10, 0],
  }
  return map[event.key] ?? null
}

/* The gradient stops sit at the thumb's travel ends, so the color under the thumb is the value it reports. */
const HUE_TRACK =
  "linear-gradient(to right, #f00 11px, #ff0 calc(11px + (100% - 22px) * .1666), #0f0 calc(11px + (100% - 22px) * .3333), #0ff 50%, #00f calc(11px + (100% - 22px) * .6666), #f0f calc(11px + (100% - 22px) * .8333), #f00 calc(100% - 11px))"
const ALPHA_TRACK = "linear-gradient(to right, transparent 11px, var(--picker-opaque) calc(100% - 11px)), var(--checker)"

const thumbBaseClass = [
  "absolute size-[22px] cursor-grab rounded-full [translate:-50%_-50%]",
  "shadow-[0_0_0_3px_#fff,0_2px_8px_oklch(0%_0_0/.3),inset_0_0_0_1px_oklch(0%_0_0/.12)]",
  "[transition:scale_var(--duration-spring)_var(--ease-spring)] motion-reduce:transition-none",
].join(" ")

const iconButtonClass = [
  "grid size-8 cursor-pointer place-items-center rounded-xl border-0 bg-transparent p-0 text-text-secondary",
  "[transition:background-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard),transform_var(--duration-fast)_var(--ease-standard)]",
  "active:[transform:scale(.94)] pointer-fine:hover:bg-surface-muted pointer-fine:hover:text-foreground motion-reduce:transition-none",
].join(" ")

interface SliderProps {
  label: string
  value: number
  valueText: string
  max: number
  unit: number
  onChange: (value: number) => void
  className?: string
  style?: CSSProperties
  reduced: boolean
  fill: string
  onActive: (active: boolean) => void
  active: boolean
}
function Slider({ label, value, valueText, max, unit, onChange, className, style, reduced, fill, onActive, active }: SliderProps) {
  const x = useFollow(value / max, reduced, active)
  const left = useTransform(x, (v) => `${v * 100}%`)
  const pad = usePad((fx) => onChange(fx * max), onActive)
  return (
    <div
      className={cn(
        "relative mx-[11px] h-3.5 cursor-pointer touch-none rounded-pill",
        "before:absolute before:inset-y-0 before:-inset-x-[11px] before:rounded-[inherit] before:[background:var(--track)] before:shadow-[inset_0_0_0_1px_oklch(0%_0_0/.08)] before:content-['']",
        className,
      )}
      style={style}
      {...pad}
    >
      <motion.div
        className={cn(
          thumbBaseClass,
          "top-1/2 [background:var(--checker)] data-active:scale-120 data-active:cursor-grabbing",
          "after:absolute after:inset-0 after:rounded-[inherit] after:[background:var(--thumb-fill)] after:content-['']",
        )}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        aria-valuetext={valueText}
        style={{ left, "--thumb-fill": fill } as unknown as CSSProperties}
        data-active={active || undefined}
        onKeyDown={(event) => {
          if (event.key === "Home" || event.key === "End") {
            event.preventDefault()
            onChange(event.key === "Home" ? 0 : max)
            return
          }
          const step = stepFor(event, "x")
          if (!step) return
          event.preventDefault()
          onChange(clamp(value + step[0] * unit, 0, max))
        }}
      />
    </div>
  )
}

/** A chip over a checkerboard, so opacity reads as opacity. */
function Chip({ color, className }: { color: string; className?: string }) {
  return (
    <span className={cn("relative block size-8 flex-none overflow-hidden rounded-full [background:var(--checker)]", className)}>
      <span className="absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_oklch(0%_0_0/.1)]" style={{ background: color }} />
    </span>
  )
}

function Label({ label, hex, grow }: { label: string; hex: string; grow?: boolean }) {
  return (
    <span className={cn("grid min-w-0 text-start leading-[1.15]", grow && "flex-1")}>
      <span className="text-xs leading-[1.15] text-text-secondary">{label}</span>
      <span className="text-sm leading-[1.15] font-medium tabular-nums">{hex}</span>
    </span>
  )
}

let swatchCount = 0
const newId = () => `swatch-${Date.now().toString(36)}-${swatchCount++}`

export function ColorPicker({
  value,
  defaultValue = "#2F6BFF",
  onValueChange,
  background = "#FFFFFF",
  label = "Color",
  swatches: swatchesProp,
  defaultSwatches,
  onSwatchesChange,
  maxSwatches = 7,
  defaultFormat = "hex",
  className,
}: ColorPickerProps) {
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, "")
  const hydrated = useHydrated()
  const reduced = !!useReducedMotion() && hydrated
  const canPick = useEyeDropper()

  const [hsva, setHsva] = useState<Hsva>(() => parseColor(value ?? defaultValue) ?? { h: 220, s: 0.8, v: 1, a: 1 })
  const [synced, setSynced] = useState(value)
  if (value !== undefined && value !== synced) {
    setSynced(value)
    if (value.toUpperCase() !== toHex(hsva)) {
      const next = parseColor(value, hsva.h)
      if (next) setHsva(next)
    }
  }
  const [ownSwatches, setOwnSwatches] = useState<ColorSwatch[]>(defaultSwatches ?? [])
  const swatches = swatchesProp ?? ownSwatches
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(false)
  const [kind, setKind] = useState<ColorFormat>(defaultFormat)
  const [draft, setDraft] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [morph, setMorph] = useState<{ id: number; from: string; to: string; phase: 0 | 1 } | null>(null)
  const [active, setActive] = useState<"area" | "hue" | "alpha" | null>(null)
  const [focusSwatch, setFocusSwatch] = useState<string | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const areaThumb = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const swatchRefs = useRef(new Map<string, HTMLButtonElement>())
  const dragged = useRef(false)
  const fieldX = useMotionValue(0)
  /** Whether the panel is meant to be open right now, read when a closing animation finishes. */
  const openNow = useRef(false)

  const hex = toHex(hsva)
  const rgb = hsvToRgb(hsva)
  const css = `rgb(${byte(rgb.r)} ${byte(rgb.g)} ${byte(rgb.b)} / ${round(hsva.a, 3)})`
  const opaque = `rgb(${byte(rgb.r)} ${byte(rgb.g)} ${byte(rgb.b)})`
  const pure = `hsl(${hsva.h} 100% 50%)`
  const bg = parseColor(background)
  const ratio = contrast(hsva, bg ? hsvToRgb(bg) : { r: 1, g: 1, b: 1, a: 1 })
  const text = format(hsva, kind)

  function commit(next: Hsva) {
    setHsva(next)
    const nextHex = toHex(next)
    if (nextHex !== hex) onValueChange?.(nextHex)
  }
  function setSwatches(next: ColorSwatch[]) {
    if (!swatchesProp) setOwnSwatches(next)
    onSwatchesChange?.(next)
  }

  // The surface: one progress value grows the swatch's box into the panel's box; the content fades in behind the leading edge.
  const progress = useMotionValue(0),
    fade = useMotionValue(0)
  const sizeW = useMotionValue(300),
    sizeH = useMotionValue(420),
    sizew = useMotionValue(160),
    sizeh = useMotionValue(44)
  const clipPath = useTransform(() => {
    const q = clamp(progress.get())
    return `inset(0px ${round((sizeW.get() - sizew.get()) * (1 - q), 2)}px ${round((sizeH.get() - sizeh.get()) * (1 - q), 2)}px 0px round ${round(22 + 4 * q, 2)}px)`
  })
  const contentOpacity = useTransform(progress, [0.35, 0.9], [0, 1])
  const contentY = useTransform(progress, [0, 1], [-10, 0])

  useLayoutEffect(() => {
    if (!shown) return
    const panel = panelRef.current,
      trigger = triggerRef.current
    if (!panel || !trigger) return
    const measure = () => {
      sizeW.set(panel.offsetWidth)
      sizeH.set(panel.offsetHeight)
      sizew.set(trigger.offsetWidth)
      sizeh.set(trigger.offsetHeight)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [shown, sizeW, sizeH, sizew, sizeh])

  useEffect(() => {
    if (!shown) return
    if (reduced) {
      progress.jump(open ? 1 : progress.get())
      const controls = animate(fade, open ? 1 : 0, { duration: duration.fast, ease: standardEase })
      controls.then(() => {
        if (!openNow.current) {
          progress.jump(0)
          setShown(false)
        }
      })
      return () => controls.stop()
    }
    fade.jump(1)
    const controls = animate(progress, open ? 1 : 0, open ? openSpring : closeSpring)
    if (!open)
      controls.then(() => {
        if (!openNow.current) setShown(false)
      })
    return () => controls.stop()
  }, [fade, open, progress, reduced, shown])

  useEffect(() => {
    if (open) requestAnimationFrame(() => areaThumb.current?.focus({ preventScroll: true }))
  }, [open])

  function show() {
    openNow.current = true
    setShown(true)
    setOpen(true)
  }
  function hide(returnFocus = true) {
    openNow.current = false
    setOpen(false)
    setDraft(null)
    setInvalid(false)
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true })
  }

  const dismiss = useEffectEvent((event: Event) => {
    if (event instanceof KeyboardEvent) {
      if (event.key !== "Escape") return
      hide(!!rootRef.current?.contains(document.activeElement))
      return
    }
    if (!rootRef.current?.contains(event.target as Node)) hide(false)
  })
  useEffect(() => {
    if (!open) return
    const listener = (event: Event) => dismiss(event)
    document.addEventListener("pointerdown", listener, true)
    document.addEventListener("keydown", listener)
    return () => {
      document.removeEventListener("pointerdown", listener, true)
      document.removeEventListener("keydown", listener)
    }
  }, [open])

  // The saturation and brightness area.
  const areaX = useFollow(hsva.s, reduced, active === "area"),
    areaY = useFollow(1 - hsva.v, reduced, active === "area")
  const areaLeft = useTransform(areaX, (v) => `${v * 100}%`),
    areaTop = useTransform(areaY, (v) => `${v * 100}%`)
  const areaPad = usePad(
    (x, y) => commit({ ...hsva, s: x, v: 1 - y }),
    (on) => setActive(on ? "area" : null),
  )

  // Format morph: the new text mounts showing the old string, then morphs to the new one, and the live field returns once it settles.
  useEffect(() => {
    if (!morph || morph.phase === 1) return
    const frame = requestAnimationFrame(() =>
      setMorph((current) => (current && current.id === morph.id ? { ...current, phase: 1 } : current)),
    )
    return () => cancelAnimationFrame(frame)
  }, [morph])
  useEffect(() => {
    if (!morph || morph.phase === 0) return
    const timer = window.setTimeout(() => setMorph((current) => (current?.id === morph.id ? null : current)), 620)
    return () => window.clearTimeout(timer)
  }, [morph])

  function cycleFormat() {
    const next = formats[(formats.indexOf(kind) + 1) % formats.length]
    setKind(next)
    setDraft(null)
    setInvalid(false)
    if (!reduced) setMorph({ id: Date.now(), from: text, to: format(hsva, next), phase: 0 })
  }

  function submitDraft() {
    if (draft === null) return true
    const next = parseColor(draft, hsva.h)
    if (!next) {
      setInvalid(true)
      if (!reduced) animate(fieldX, [0, -5, 4, -2, 0], { duration: 0.32, ease: standardEase })
      return false
    }
    commit(next)
    setDraft(null)
    setInvalid(false)
    return true
  }

  function pickFromScreen() {
    if (!canPick) return
    const Ctor = (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper
    new Ctor()
      .open()
      .then((result) => {
        const next = parseColor(result.sRGBHex, hsva.h)
        if (next) commit({ ...next, a: hsva.a })
      })
      .catch(() => {})
  }

  function saveSwatch() {
    const entry = { id: newId(), color: hex }
    setSwatches([entry, ...swatches].slice(0, maxSwatches))
    setFocusSwatch(entry.id)
  }
  function onSwatchKey(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    const item = swatches[index]
    const move = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault()
      const next = swatches.filter((entry) => entry.id !== item.id)
      setSwatches(next)
      const neighbor = next[Math.min(index, next.length - 1)]
      setFocusSwatch(neighbor?.id ?? null)
      requestAnimationFrame(() =>
        neighbor
          ? swatchRefs.current.get(neighbor.id)?.focus({ preventScroll: true })
          : inputRef.current?.focus({ preventScroll: true }),
      )
      return
    }
    if (!move && event.key !== "Home" && event.key !== "End") return
    event.preventDefault()
    if (move && event.altKey) {
      const to = index + move
      if (to < 0 || to >= swatches.length) return
      const next = [...swatches]
      next.splice(index, 1)
      next.splice(to, 0, item)
      setSwatches(next)
      requestAnimationFrame(() => swatchRefs.current.get(item.id)?.focus({ preventScroll: true }))
      return
    }
    const target =
      event.key === "Home" ? 0 : event.key === "End" ? swatches.length - 1 : (index + move + swatches.length) % swatches.length
    setFocusSwatch(swatches[target].id)
    swatchRefs.current.get(swatches[target].id)?.focus({ preventScroll: true })
  }

  const ratioValue = useFollow(ratio, reduced)
  const ratioText = useTransform(ratioValue, (v) => v.toFixed(2))
  const grade = level(ratio)
  const hidden = reduced ? { opacity: 0 } : { opacity: 0, y: "0.3em", filter: `blur(${blur.subtle}px)` }
  const swatchTab = swatches.some((entry) => entry.id === focusSwatch) ? focusSwatch : swatches[0]?.id
  const style = { "--picker-color": css, "--picker-opaque": opaque, "--picker-hue": pure, "--picker-bg": background } as CSSProperties

  return (
    /* The swatch is the panel's top left corner: the panel opens over it and grows out of its box. Leave room below and to the right. */
    <div
      ref={rootRef}
      className={cn(
        "relative inline-block font-body tracking-body text-foreground",
        "[--picker-fill:var(--surface)] [--picker-width:min(19rem,calc(100vw_-_32px))] [--checker:repeating-conic-gradient(oklch(88%_0_0)_0_25%,oklch(100%_0_0)_0_50%)_0_0/10px_10px]",
        "dark:[--picker-fill:var(--surface-raised)] dark:[--checker:repeating-conic-gradient(oklch(42%_0_0)_0_25%,oklch(30%_0_0)_0_50%)_0_0/10px_10px]",
        className,
      )}
      style={style}
    >
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "flex h-11 cursor-pointer items-center gap-2.5 rounded-[22px] border border-border bg-(--picker-fill) py-1.5 pr-4 pl-1.5 text-inherit shadow-resting [-webkit-tap-highlight-color:transparent]",
          "[transition:border-color_var(--duration-fast)_var(--ease-standard)] pointer-fine:hover:border-border-strong contrast-more:border-border-strong",
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${uid}-panel` : undefined}
        onClick={() => (open ? hide() : show())}
      >
        <Chip color={css} />
        <Label label={label} hex={hex} />
      </button>

      {/* The floating layer. Its drop shadow follows the clipped shape, so the shadow grows with the panel. */}
      {shown && (
        <div
          className={cn(
            "pointer-events-none absolute top-[-1px] left-[-1px] z-20 data-open:pointer-events-auto",
            "[filter:drop-shadow(0_18px_36px_oklch(0%_0_0/.12))_drop-shadow(0_2px_6px_oklch(0%_0_0/.06))] dark:[filter:drop-shadow(0_20px_44px_oklch(0%_0_0/.5))]",
          )}
          data-open={open || undefined}
        >
          <motion.div
            ref={panelRef}
            id={`${uid}-panel`}
            role="dialog"
            aria-label={`${label} color`}
            className="w-(--picker-width) rounded-panel border border-border bg-(--picker-fill) pb-3.5 will-change-[clip-path] contrast-more:border-border-strong"
            inert={!open}
            style={{ clipPath, opacity: fade }}
          >
            <div className="flex h-11 items-center gap-2.5 py-1.5 pr-1.5 pl-1.5">
              <Chip color={css} />
              <Label label={label} hex={hex} grow />
              <motion.span className="flex gap-0.5" style={{ opacity: contentOpacity }}>
                {canPick && (
                  <button type="button" className={iconButtonClass} aria-label="Pick a color from the screen" onClick={pickFromScreen}>
                    <Pipette size={18} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                )}
                <button type="button" className={iconButtonClass} aria-label="Done" onClick={() => hide()}>
                  <Check size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </motion.span>
            </div>

            {/* One column locked to the panel: a wider grade label ("AA large") must never widen the area and sliders mid drag. */}
            <motion.div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 px-3.5 pt-2" style={{ opacity: contentOpacity, y: contentY }}>
              {/* Saturation runs left to right, brightness bottom to top, over the pure hue. */}
              <div
                className={cn(
                  "group/area relative h-41 cursor-crosshair touch-none rounded-2xl shadow-[inset_0_0_0_1px_oklch(0%_0_0/.08)]",
                  "[background:linear-gradient(to_top,#000,transparent),linear-gradient(to_right,#fff,transparent),var(--picker-hue)]",
                )}
                data-active={active === "area" || undefined}
                {...areaPad}
              >
                <motion.div
                  ref={areaThumb}
                  className={cn(thumbBaseClass, "bg-(--picker-opaque) group-data-active/area:scale-120 group-data-active/area:cursor-grabbing")}
                  role="slider"
                  tabIndex={0}
                  aria-roledescription="2D slider"
                  aria-label="Saturation and brightness"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(hsva.s * 100)}
                  aria-valuetext={`Saturation ${Math.round(hsva.s * 100)}%, brightness ${Math.round(hsva.v * 100)}%`}
                  style={{ left: areaLeft, top: areaTop }}
                  onKeyDown={(event) => {
                    const step = stepFor(event, "both")
                    if (!step) return
                    event.preventDefault()
                    commit({ ...hsva, s: clamp(hsva.s + step[0] / 100), v: clamp(hsva.v + step[1] / 100) })
                  }}
                />
              </div>

              <Slider
                label="Hue"
                value={hsva.h}
                valueText={`${Math.round(hsva.h)} degrees`}
                max={360}
                unit={1}
                style={{ "--track": HUE_TRACK } as CSSProperties}
                reduced={reduced}
                fill={pure}
                onChange={(h) => commit({ ...hsva, h: clamp(h, 0, 359.9) })}
                active={active === "hue"}
                onActive={(on) => setActive(on ? "hue" : null)}
              />
              <Slider
                label="Opacity"
                value={hsva.a * 100}
                valueText={`${Math.round(hsva.a * 100)}%`}
                max={100}
                unit={1}
                style={{ "--track": ALPHA_TRACK } as CSSProperties}
                reduced={reduced}
                fill={css}
                onChange={(a) => commit({ ...hsva, a: clamp(a / 100) })}
                active={active === "alpha"}
                onActive={(on) => setActive(on ? "alpha" : null)}
              />

              <motion.div
                className={cn(
                  "mt-0.5 flex h-10 items-stretch overflow-hidden rounded-[14px] border border-border bg-surface-muted",
                  "[transition:border-color_var(--duration-fast)_var(--ease-standard)] data-invalid:border-danger contrast-more:not-data-invalid:border-border-strong",
                )}
                data-invalid={invalid || undefined}
                style={{ x: fieldX }}
              >
                <button
                  type="button"
                  className={cn(
                    "flex min-w-14 cursor-pointer items-center justify-center border-r border-border bg-transparent px-2.5 text-xs font-medium text-foreground",
                    "[transition:background-color_var(--duration-fast)_var(--ease-standard)] pointer-fine:hover:bg-foreground/5",
                  )}
                  onClick={cycleFormat}
                  aria-label={`Format: ${formatNames[kind]}. Switch format`}
                >
                  <TextMorph>{formatNames[kind]}</TextMorph>
                </button>
                <span className="relative flex min-w-0 flex-1">
                  <input
                    ref={inputRef}
                    className="w-full min-w-0 border-0 bg-transparent px-2.5 text-xs text-foreground tabular-nums caret-foreground data-morphing:text-transparent"
                    value={draft ?? text}
                    spellCheck={false}
                    autoComplete="off"
                    aria-label={`${label} in ${formatNames[kind]}`}
                    aria-invalid={invalid || undefined}
                    aria-describedby={invalid ? `${uid}-error` : undefined}
                    data-morphing={morph ? "" : undefined}
                    onChange={(event) => {
                      setDraft(event.target.value)
                      setInvalid(false)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        if (submitDraft()) event.currentTarget.select()
                      }
                      if (event.key === "Escape" && draft !== null) {
                        event.stopPropagation()
                        event.nativeEvent.stopImmediatePropagation()
                        setDraft(null)
                        setInvalid(false)
                      }
                    }}
                    onBlur={() => {
                      if (!submitDraft()) {
                        setDraft(null)
                        setInvalid(false)
                      }
                    }}
                  />
                  {morph && (
                    <span
                      className="pointer-events-none absolute inset-0 flex items-center overflow-hidden px-2.5 text-xs whitespace-nowrap text-foreground tabular-nums"
                      aria-hidden="true"
                    >
                      <TextMorph>{morph.phase === 0 ? morph.from : morph.to}</TextMorph>
                    </span>
                  )}
                </span>
              </motion.div>
              <p id={`${uid}-error`} className="mx-0.5 mt-[-10px] mb-[-4px] min-h-0 text-xs text-danger empty:hidden" aria-live="polite">
                {invalid ? "Enter a hex, RGB, HSL, or OKLCH color" : ""}
              </p>

              <div className="flex items-center gap-2.5 text-sm">
                <span
                  className="grid h-7 w-9 flex-none place-items-center rounded-[9px] border border-border bg-(--picker-bg) font-medium text-(--picker-color)"
                  aria-hidden="true"
                >
                  Aa
                </span>
                <span className="min-w-[4.4ch] font-medium tabular-nums">
                  <motion.span>{ratioText}</motion.span>:1
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-text-secondary max-[360px]:hidden">against background</span>
                <span
                  className={cn(
                    "relative inline-grid h-[22px] items-center rounded-pill px-2 text-xs font-medium whitespace-nowrap",
                    "[transition:background-color_var(--duration-standard)_var(--ease-standard),color_var(--duration-standard)_var(--ease-standard)]",
                    "data-[grade=pass]:bg-success/14 data-[grade=pass]:text-success data-[grade=large]:bg-warning/16 data-[grade=large]:text-warning",
                    "data-[grade=fail]:bg-danger/12 data-[grade=fail]:text-danger",
                  )}
                  data-grade={grade === "Fails" ? "fail" : grade === "AA large" ? "large" : "pass"}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={grade}
                      initial={hidden}
                      animate={{ opacity: 1, y: "0em", filter: "blur(0px)" }}
                      exit={{ ...hidden, transition: { duration: duration.instant } }}
                      transition={reduced ? { duration: duration.instant } : { duration: duration.standard, ease: enterEase }}
                    >
                      {grade}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <span className="sr-only">{`Contrast ${ratio.toFixed(2)} to 1, ${grade === "Fails" ? "fails" : `passes ${grade}`}`}</span>
              </div>

              <div className="flex min-h-8 items-center gap-1.5">
                <button
                  type="button"
                  className={cn(
                    "grid size-[30px] flex-none cursor-pointer place-items-center rounded-full border border-dashed border-border-strong bg-transparent p-0 text-text-secondary",
                    "[transition:color_var(--duration-fast)_var(--ease-standard),border-color_var(--duration-fast)_var(--ease-standard),transform_var(--duration-fast)_var(--ease-standard)]",
                    "active:[transform:scale(.92)] pointer-fine:hover:border-foreground pointer-fine:hover:text-foreground motion-reduce:transition-none",
                  )}
                  onClick={saveSwatch}
                  aria-label={`Save ${hex}`}
                >
                  <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <Reorder.Group
                  as="div"
                  axis="x"
                  values={swatches}
                  onReorder={setSwatches}
                  className="flex min-w-0 flex-1 gap-1.5"
                  role="listbox"
                  aria-label="Saved colors"
                  aria-orientation="horizontal"
                >
                  <AnimatePresence initial={false}>
                    {swatches.map((entry, index) => (
                      <Reorder.Item
                        key={entry.id}
                        value={entry}
                        as="div"
                        className="relative flex-none touch-pan-y"
                        dragElastic={0.12}
                        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4, transition: { duration: duration.fast } }}
                        transition={reduced ? instant : { ...spring.snappy, layout: spring.smooth }}
                        whileDrag={reduced ? undefined : { scale: 1.15, zIndex: 2 }}
                        onDragStart={() => {
                          dragged.current = true
                        }}
                        onDragEnd={() =>
                          requestAnimationFrame(() => {
                            dragged.current = false
                          })
                        }
                      >
                        <button
                          ref={(node) => {
                            if (node) swatchRefs.current.set(entry.id, node)
                            else swatchRefs.current.delete(entry.id)
                          }}
                          type="button"
                          role="option"
                          aria-selected={entry.color.toUpperCase() === hex}
                          className="group/swatch grid size-[30px] cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 data-current:shadow-[inset_0_0_0_2px_var(--foreground)]"
                          data-current={entry.color.toUpperCase() === hex || undefined}
                          aria-label={`${entry.color}. Alt and arrow keys to move, Delete to remove`}
                          tabIndex={entry.id === swatchTab ? 0 : -1}
                          onFocus={() => setFocusSwatch(entry.id)}
                          onKeyDown={(event) => onSwatchKey(event, index)}
                          onClick={() => {
                            if (dragged.current) return
                            const next = parseColor(entry.color, hsva.h)
                            if (next) commit(next)
                          }}
                        >
                          <Chip
                            color={entry.color}
                            className="size-[26px] [transition:scale_var(--duration-spring)_var(--ease-spring)] group-data-current/swatch:scale-78 motion-reduce:transition-none"
                          />
                        </button>
                      </Reorder.Item>
                    ))}
                  </AnimatePresence>
                </Reorder.Group>
              </div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default ColorPicker
