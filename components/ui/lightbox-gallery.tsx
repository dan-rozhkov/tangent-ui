"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react"
import Image from "next/image"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "motion/react"
import type { MotionValue } from "motion/react"
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

export interface LightboxImage {
  src: string
  /** Intrinsic width; with height it sets the aspect ratio in the grid, the zoom and the return flight. */
  width: number
  height: number
  alt: string
  /** First caption line. */
  title?: string
  /** Second caption line. */
  caption?: string
}

export interface LightboxGalleryProps {
  /** Photos in reading order. */
  images: LightboxImage[]
  /** Columns are added while each stays at least this wide, in px. There are always at least two. */
  minColumnWidth?: number
  /** Gap between photos in px. */
  gap?: number
  /** Accessible name of the gallery and its viewer. */
  label?: string
  /** Class on the root region. */
  className?: string
}

/** Corner radius in px. The flight divides it by the current scale, so it reads the same at every size. */
const RADIUS = 14
/** Room between slides, so a neighbour never peeks in from the edge of the viewport. */
const GUTTER = 32
const MAX_ZOOM = 4
const STEP_ZOOM = 1.6
const DOUBLE_ZOOM = 2.5
/** A drag down past this many px, or a fling faster than FLING px/s, dismisses. */
const DISMISS = 110
const FLING = 650
/** How far a released swipe or pan keeps travelling, in seconds of its velocity. */
const PROJECT = 0.2
/** Grid and placeholder share one sizes string, so the viewer's placeholder is the grid file the browser already has. */
const GRID_SIZES = "(max-width: 640px) 50vw, 33vw"

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
/** Past an edge, travel approaches `limit` px instead of following the pointer. */
const rubber = (distance: number, limit = 120) => (1 - 1 / ((distance * 0.55) / limit + 1)) * limit
const fade = { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard] as [number, number, number, number] }
const quick = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] as [number, number, number, number] }

const nameOf = (image: LightboxImage) => image.title ?? image.alt

/** The photo's resting box: contained in the stage, centered. */
function fitIn(image: LightboxImage | undefined, box: Rect | null): Rect | null {
  if (!box || !image) return null
  const ratio = Math.min(box.w / image.width, box.h / image.height)
  const w = image.width * ratio
  const h = image.height * ratio
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h }
}

/** A masonry grid of photos that open in a fullscreen viewer. */
export function LightboxGallery({ images, minColumnWidth = 150, gap = 8, label = "Photo gallery", className }: LightboxGalleryProps) {
  const rootRef = useRef<HTMLElement>(null)
  const slots = useRef<(HTMLButtonElement | null)[]>([])
  const [width, setWidth] = useState(0)
  /** The open viewer, or null. It stays set while the photo flies home, so the slot stays empty until it lands. */
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(0)
  const closeRef = useRef<(velocity?: number) => void>(() => {})
  /** Keys are read on the popup, so they work wherever focus sits inside the viewer, or on the popup itself. */
  const keyRef = useRef<(event: ReactKeyboardEvent<HTMLDivElement>) => void>(() => {})

  // Columns follow the gallery's own width, not the viewport.
  useLayoutEffect(() => {
    const node = rootRef.current
    if (!node) return
    setWidth(node.clientWidth)
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const columns = useMemo(() => {
    const count = Math.max(2, Math.floor((width + gap) / (minColumnWidth + gap)) || 2)
    const columnWidth = width ? (width - gap * (count - 1)) / count : minColumnWidth
    const heights = new Array<number>(count).fill(0)
    const lists = Array.from({ length: count }, () => [] as number[])
    // Each photo goes under the shortest column, so reading order runs across the top and the columns end level.
    images.forEach((image, index) => {
      let target = 0
      for (let column = 1; column < count; column++) if (heights[column] < heights[target] - 0.5) target = column
      lists[target].push(index)
      heights[target] += (columnWidth * image.height) / image.width + gap
    })
    return lists
  }, [gap, images, minColumnWidth, width])

  const show = (index: number) => {
    setCurrent(index)
    setOpen(true)
  }

  return (
    <section ref={rootRef} aria-label={label} className={cn("w-full", className)}>
      <div className="flex items-start" style={{ gap }}>
        {columns.map((list, column) => (
          <div key={column} className="flex min-w-0 flex-1 flex-col" style={{ gap }}>
            {list.map(index => {
              const image = images[index]
              return (
                <button
                  key={`${image.src}-${index}`}
                  ref={node => {
                    slots.current[index] = node
                  }}
                  type="button"
                  aria-label={`Open ${nameOf(image)}, photo ${index + 1} of ${images.length}`}
                  aria-haspopup="dialog"
                  className={cn(
                    "relative block w-full cursor-zoom-in overflow-hidden bg-surface-muted outline-none [-webkit-tap-highlight-color:transparent]",
                    "transition-[filter,scale] duration-160 ease-standard pointer-fine:hover:brightness-[.94] focus-visible:scale-[.97] motion-reduce:transition-none",
                  )}
                  style={{ aspectRatio: `${image.width} / ${image.height}`, borderRadius: RADIUS, opacity: open && index === current ? 0 : 1 }}
                  onClick={() => show(index)}
                >
                  <Image src={image.src} alt="" fill sizes={GRID_SIZES} className="object-cover" draggable={false} />
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next, details) => {
          // The viewer stays open while the photo flies back; it closes itself when the photo lands.
          if (next) return
          details.cancel()
          closeRef.current()
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Popup
            aria-label={label}
            aria-modal="true"
            onKeyDown={event => keyRef.current(event)}
            className="fixed inset-0 z-50 overflow-hidden text-foreground outline-none"
            initialFocus={() => document.querySelector<HTMLElement>("[data-lightbox-close]")}
            finalFocus={() => slots.current[current] ?? true}
          >
            <Viewer
              images={images}
              index={current}
              onIndexChange={setCurrent}
              slotFor={index => slots.current[index] ?? null}
              onClosed={() => setOpen(false)}
              closeRef={closeRef}
              keyRef={keyRef}
            />
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </section>
  )
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

type Gesture =
  | { kind: "pending" | "swipe" | "dismiss" | "pan"; id: number; x: number; y: number; track: number; px: number; py: number; samples: { x: number; y: number; t: number }[] }
  | { kind: "pinch"; distance: number; mid: { x: number; y: number }; zoom: number; px: number; py: number }

function velocityOf(samples: { x: number; y: number; t: number }[], now: number) {
  const recent = samples.filter(sample => now - sample.t <= 100)
  const first = recent[0]
  const last = recent[recent.length - 1]
  if (!first || !last || first === last || now - last.t > 60) return { x: 0, y: 0 }
  const seconds = Math.max(0.008, (last.t - first.t) / 1000)
  return { x: (last.x - first.x) / seconds, y: (last.y - first.y) / seconds }
}

function Viewer({
  images,
  index,
  onIndexChange,
  slotFor,
  onClosed,
  closeRef,
  keyRef,
}: {
  images: LightboxImage[]
  index: number
  onIndexChange: (index: number) => void
  slotFor: (index: number) => HTMLElement | null
  onClosed: () => void
  closeRef: { current: (velocity?: number) => void }
  keyRef: { current: (event: ReactKeyboardEvent<HTMLDivElement>) => void }
}) {
  const reduced = useReducedMotion() ?? false
  const stageRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const photoRef = useRef<HTMLDivElement>(null)
  const thumbs = useRef<(HTMLButtonElement | null)[]>([])
  const [stage, setStage] = useState<Rect | null>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const [closing, setClosing] = useState(false)
  const count = images.length
  const pitch = viewportWidth + GUTTER

  /* The flight (fx, fy, fs), the dismiss drag (dx, dy) and the zoom (z, px, py) are separate values composed into one
     transform, so a drag can pick up a flight mid-air and a close can start from wherever the photo is. */
  const fx = useMotionValue(0)
  const fy = useMotionValue(0)
  const fs = useMotionValue(1)
  const dx = useMotionValue(0)
  const dy = useMotionValue(0)
  const z = useMotionValue(1)
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const track = useMotionValue(0)
  const shade = useMotionValue(0)
  const chrome = useMotionValue(0)
  const stageHeight = useMotionValue(1)

  const shrink = useTransform(() => 1 - clamp(dy.get() / stageHeight.get(), 0, 1) * 0.35)
  const x = useTransform(() => fx.get() + dx.get() + px.get())
  const y = useTransform(() => fy.get() + dy.get() + py.get())
  const scale = useTransform(() => fs.get() * shrink.get() * z.get())
  const radius = useTransform(() => RADIUS / Math.max(0.05, scale.get()))
  useMotionValueEvent(z, "change", value => setZoomed(value > 1.01))

  const stateRef = useRef({ index, stage, pitch, reduced, closing: false })
  useLayoutEffect(() => {
    stateRef.current = { index, stage, pitch, reduced, closing: stateRef.current.closing }
  })

  useLayoutEffect(() => {
    const node = stageRef.current
    if (!node) return
    const measure = () => {
      const box = node.getBoundingClientRect()
      setStage(previous =>
        previous && previous.x === box.left && previous.y === box.top && previous.w === box.width && previous.h === box.height
          ? previous
          : { x: box.left, y: box.top, w: box.width, h: box.height },
      )
      setViewportWidth(node.parentElement?.clientWidth ?? window.innerWidth)
      stageHeight.set(Math.max(1, box.height))
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [stageHeight])

  const fitFor = useCallback((at: number, box: Rect | null = stateRef.current.stage) => fitIn(images[at], box), [images])

  // Opening: the photo starts exactly over its grid slot and springs out to fit the stage.
  const opened = useRef(false)
  useLayoutEffect(() => {
    if (!stage || opened.current) return
    opened.current = true
    track.jump(-index * pitch)
    const slot = slotFor(index)?.getBoundingClientRect()
    const fit = fitFor(index, stage)
    if (reduced || !slot || !fit || !slot.width) {
      animate(shade, 1, fade)
      animate(chrome, 1, fade)
      return
    }
    fs.jump(slot.width / fit.w)
    fx.jump(slot.left + slot.width / 2 - (fit.x + fit.w / 2))
    fy.jump(slot.top + slot.height / 2 - (fit.y + fit.h / 2))
    animate(fs, 1, motionTokens.spring.morph)
    animate(fx, 0, motionTokens.spring.morph)
    animate(fy, 0, motionTokens.spring.morph)
    animate(shade, 1, { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] })
    animate(chrome, 1, { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter], delay: 0.08 })
  }, [chrome, fitFor, fs, fx, fy, index, pitch, reduced, shade, slotFor, stage, track])

  // Slides glide to the current index; a resize only re-places them.
  const placed = useRef({ pitch: 0, index: -1 })
  const swipeVelocity = useRef(0)
  useLayoutEffect(() => {
    if (!viewportWidth) return
    const target = -index * pitch
    const moved = placed.current.index !== index
    const resized = placed.current.pitch !== pitch
    placed.current = { pitch, index }
    if (!moved && !resized) return
    // The zoom belongs to the photo that was showing; the new one starts fitted.
    z.jump(1)
    px.jump(0)
    py.jump(0)
    if (resized || reduced || !opened.current) {
      track.jump(target)
      return
    }
    const velocity = swipeVelocity.current
    swipeVelocity.current = 0
    const controls = animate(track, target, { ...motionTokens.spring.smooth, velocity })
    return () => controls.stop()
  }, [index, pitch, px, py, reduced, track, viewportWidth, z])

  // The current thumbnail stays in view.
  useEffect(() => {
    thumbs.current[index]?.scrollIntoView({ block: "nearest", inline: "center", behavior: reduced ? "auto" : "smooth" })
  }, [index, reduced])

  const close = useCallback(
    (velocity = 0) => {
      const state = stateRef.current
      if (state.closing) return
      state.closing = true
      setClosing(true)
      const finish = () => onClosed()
      animate(chrome, 0, quick)
      if (state.reduced) {
        animate(shade, 0, { ...fade, onComplete: finish })
        return
      }
      const fit = fitFor(state.index)
      const now = photoRef.current?.getBoundingClientRect()
      const slot = slotFor(state.index)?.getBoundingClientRect()
      const visible = slot && slot.width > 0 && slot.bottom > 0 && slot.top < window.innerHeight && slot.right > 0 && slot.left < window.innerWidth
      if (fit && now && now.width) {
        // Fold the drag, zoom and swipe into the flight values so the photo leaves from exactly where it is.
        for (const value of [dx, dy, px, py, track, z]) value.stop()
        fs.jump(now.width / fit.w)
        fx.jump(now.left + now.width / 2 - (fit.x + fit.w / 2))
        fy.jump(now.top + now.height / 2 - (fit.y + fit.h / 2))
        dx.jump(0)
        dy.jump(0)
        px.jump(0)
        py.jump(0)
        z.jump(1)
        track.jump(-state.index * state.pitch)
      }
      if (!fit || !slot || !visible) {
        animate(shade, 0, { ...fade, onComplete: finish })
        animate(fs, fs.get() * 0.9, fade)
        return
      }
      const flight = { ...motionTokens.spring.smooth, visualDuration: 0.36 }
      animate(fx, slot.left + slot.width / 2 - (fit.x + fit.w / 2), flight)
      animate(fy, slot.top + slot.height / 2 - (fit.y + fit.h / 2), { ...flight, velocity })
      animate(fs, slot.width / fit.w, { ...flight, onComplete: finish })
      animate(shade, 0, { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard] })
    },
    [chrome, dx, dy, fitFor, fs, fx, fy, onClosed, px, py, shade, slotFor, track, z],
  )
  useLayoutEffect(() => {
    closeRef.current = close
  }, [close, closeRef])

  const go = useCallback(
    (step: number) => {
      const next = clamp(stateRef.current.index + step, 0, count - 1)
      if (next !== stateRef.current.index) onIndexChange(next)
    },
    [count, onIndexChange],
  )

  /** Keeps the zoomed photo covering the stage on each axis it overflows. */
  const panBounds = useCallback(
    (zoom: number) => {
      const fit = fitFor(stateRef.current.index)
      const box = stateRef.current.stage
      if (!fit || !box) return { x: 0, y: 0 }
      return { x: Math.max(0, (fit.w * zoom - box.w) / 2), y: Math.max(0, (fit.h * zoom - box.h) / 2) }
    },
    [fitFor],
  )

  /** Zooms to `target` keeping the screen point (sx, sy) still; the stage center when omitted. */
  const zoomTo = useCallback(
    (target: number, point?: { x: number; y: number }, instant = false) => {
      const fit = fitFor(stateRef.current.index)
      if (!fit) return
      const next = clamp(target, 1, MAX_ZOOM)
      const cx = fit.x + fit.w / 2
      const cy = fit.y + fit.h / 2
      const sx = (point?.x ?? cx) - cx
      const sy = (point?.y ?? cy) - cy
      const ratio = next / z.get()
      const bounds = panBounds(next)
      const nx = clamp(sx - (sx - px.get()) * ratio, -bounds.x, bounds.x)
      const ny = clamp(sy - (sy - py.get()) * ratio, -bounds.y, bounds.y)
      if (instant || stateRef.current.reduced) {
        for (const value of [z, px, py]) value.stop()
        z.jump(next)
        px.jump(nx)
        py.jump(ny)
        return
      }
      animate(z, next, motionTokens.spring.smooth)
      animate(px, nx, motionTokens.spring.smooth)
      animate(py, ny, motionTokens.spring.smooth)
    },
    [fitFor, panBounds, px, py, z],
  )

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.metaKey || event.ctrlKey) return
    const keys: Record<string, () => void> = {
      ArrowLeft: () => go(-1),
      ArrowRight: () => go(1),
      "+": () => zoomTo(z.get() * STEP_ZOOM),
      "=": () => zoomTo(z.get() * STEP_ZOOM),
      "-": () => zoomTo(z.get() / STEP_ZOOM),
      _: () => zoomTo(z.get() / STEP_ZOOM),
      "0": () => zoomTo(1),
    }
    const action = keys[event.key]
    if (!action) return
    event.preventDefault()
    action()
  }, [go, z, zoomTo])
  useLayoutEffect(() => {
    keyRef.current = onKeyDown
  }, [keyRef, onKeyDown])

  // Ctrl+scroll (and trackpad pinch, which arrives as ctrl+wheel) zooms around the pointer.
  useEffect(() => {
    const node = surfaceRef.current
    if (!node) return
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      if (stateRef.current.closing) return
      zoomTo(z.get() * Math.exp(-event.deltaY * 0.01), { x: event.clientX, y: event.clientY }, true)
    }
    node.addEventListener("wheel", wheel, { passive: false })
    return () => node.removeEventListener("wheel", wheel)
  }, [z, zoomTo])

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<Gesture | null>(null)
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null)

  const startPinch = () => {
    const [a, b] = [...pointers.current.values()]
    for (const value of [z, px, py, track, dx, dy]) value.stop()
    gesture.current = {
      kind: "pinch",
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      zoom: z.get(),
      px: px.get(),
      py: py.get(),
    }
  }

  const settleZoom = () => {
    const next = clamp(z.get(), 1, MAX_ZOOM)
    const bounds = panBounds(next)
    const transition = stateRef.current.reduced ? { duration: 0 } : motionTokens.spring.smooth
    animate(z, next, transition)
    animate(px, clamp(px.get(), -bounds.x, bounds.x), transition)
    animate(py, clamp(py.get(), -bounds.y, bounds.y), transition)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (stateRef.current.closing || (event.pointerType === "mouse" && event.button !== 0)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* The pointer is already gone. */
    }
    if (pointers.current.size === 2) return startPinch()
    if (pointers.current.size > 2) return
    gesture.current = {
      kind: "pending",
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      track: track.get(),
      px: px.get(),
      py: py.get(),
      samples: [{ x: event.clientX, y: event.clientY, t: event.timeStamp }],
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const state = gesture.current
    if (!state) return
    if (state.kind === "pinch") {
      const [a, b] = [...pointers.current.values()]
      if (!a || !b) return
      const fit = fitFor(stateRef.current.index)
      if (!fit) return
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      const raw = (state.zoom * distance) / state.distance
      // Past either limit the pinch resists, then settles back on release.
      const next = raw < 1 ? 1 - rubber(1 - raw, 0.3) : raw > MAX_ZOOM ? MAX_ZOOM + rubber(raw - MAX_ZOOM, 0.6) : raw
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const cx = fit.x + fit.w / 2
      const cy = fit.y + fit.h / 2
      // The photo point under the starting midpoint follows the current midpoint.
      z.set(next)
      px.set(mid.x - cx - (state.mid.x - cx - state.px) * (next / state.zoom))
      py.set(mid.y - cy - (state.mid.y - cy - state.py) * (next / state.zoom))
      return
    }
    if (event.pointerId !== state.id) return
    const deltaX = event.clientX - state.x
    const deltaY = event.clientY - state.y
    state.samples.push({ x: event.clientX, y: event.clientY, t: event.timeStamp })
    if (state.samples.length > 12) state.samples.shift()
    if (state.kind === "pending") {
      if (Math.hypot(deltaX, deltaY) < 6) return
      for (const value of [track, dx, dy, px, py, fx, fy, fs, shade]) value.stop()
      state.kind = z.get() > 1.01 ? "pan" : Math.abs(deltaX) > Math.abs(deltaY) ? "swipe" : "dismiss"
      // Re-anchor so the move does not jump by the slop distance.
      state.x = event.clientX
      state.y = event.clientY
      state.track = track.get()
      state.px = px.get()
      state.py = py.get()
      return
    }
    const { index: at, pitch: step } = stateRef.current
    if (state.kind === "swipe") {
      const rest = -at * step
      let next = state.track + deltaX
      // Past the first or last photo the track stretches like rubber.
      if (next > 0) next = rubber(next)
      if (next < -(count - 1) * step) next = -(count - 1) * step - rubber(-(count - 1) * step - next)
      track.set(Number.isFinite(next) ? next : rest)
      return
    }
    if (state.kind === "dismiss") {
      const down = deltaY >= 0 ? deltaY : -rubber(-deltaY, 60)
      dy.set(down)
      dx.set(deltaX)
      const progress = clamp(down / (stageHeight.get() * 0.75), 0, 1)
      shade.set(1 - progress)
      chrome.set(1 - clamp(progress * 3, 0, 1))
      return
    }
    // Pan: free inside the bounds, rubber beyond them.
    const bounds = panBounds(z.get())
    const bend = (value: number, limit: number) => (value > limit ? limit + rubber(value - limit, 80) : value < -limit ? -limit - rubber(-limit - value, 80) : value)
    px.set(bend(state.px + deltaX, bounds.x))
    py.set(bend(state.py + deltaY, bounds.y))
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return
    const state = gesture.current
    if (!state) return
    if (state.kind === "pinch") {
      if (pointers.current.size < 2) {
        gesture.current = null
        settleZoom()
      }
      return
    }
    if (event.pointerId !== state.id) return
    gesture.current = null
    const velocity = velocityOf(state.samples, event.timeStamp)
    const { index: at, pitch: step, reduced: still } = stateRef.current
    const spring = (velocityValue: number) => (still ? { duration: 0 } : { ...motionTokens.spring.smooth, velocity: velocityValue })

    if (state.kind === "pending") {
      if (event.type === "pointercancel") return
      // A tap: double tap zooms on touch (mouse uses dblclick); a mouse click beside the photo closes.
      if (event.pointerType !== "mouse") {
        const previous = lastTap.current
        if (previous && event.timeStamp - previous.t < 320 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 30) {
          lastTap.current = null
          zoomTo(z.get() > 1.01 ? 1 : DOUBLE_ZOOM, { x: event.clientX, y: event.clientY })
        } else lastTap.current = { t: event.timeStamp, x: event.clientX, y: event.clientY }
        return
      }
      const photo = photoRef.current?.getBoundingClientRect()
      const inside = photo && event.clientX >= photo.left && event.clientX <= photo.right && event.clientY >= photo.top && event.clientY <= photo.bottom
      if (!inside && z.get() <= 1.01) close()
      return
    }
    if (state.kind === "swipe") {
      const offset = track.get() + at * step
      const projected = offset + (still ? 0 : velocity.x * PROJECT)
      const threshold = Math.min(stateRef.current.stage?.w ?? step, step) * 0.35
      const direction = projected < -threshold ? 1 : projected > threshold ? -1 : 0
      const next = clamp(at + direction, 0, count - 1)
      if (next !== at) {
        swipeVelocity.current = still ? 0 : velocity.x
        onIndexChange(next)
      } else animate(track, -at * step, spring(velocity.x))
      return
    }
    if (state.kind === "dismiss") {
      if (dy.get() > DISMISS || (dy.get() > 0 && velocity.y > FLING)) return close(Math.max(0, velocity.y))
      animate(dx, 0, spring(velocity.x))
      animate(dy, 0, spring(velocity.y))
      animate(shade, 1, still ? { duration: 0 } : motionTokens.spring.smooth)
      animate(chrome, 1, still ? { duration: 0 } : quick)
      return
    }
    // A released pan glides on with its momentum and lands inside the bounds.
    const bounds = panBounds(z.get())
    animate(px, clamp(px.get() + (still ? 0 : velocity.x * PROJECT), -bounds.x, bounds.x), spring(velocity.x))
    animate(py, clamp(py.get() + (still ? 0 : velocity.y * PROJECT), -bounds.y, bounds.y), spring(velocity.y))
  }

  const onDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const photo = photoRef.current?.getBoundingClientRect()
    if (!photo || event.clientX < photo.left || event.clientX > photo.right || event.clientY < photo.top || event.clientY > photo.bottom) return
    zoomTo(z.get() > 1.01 ? 1 : DOUBLE_ZOOM, { x: event.clientX, y: event.clientY })
  }

  const image = images[index]
  const near = (at: number) => Math.abs(at - index) <= 2

  return (
    <div className="absolute inset-0">
      <motion.div aria-hidden="true" className="absolute inset-0 bg-background" style={{ opacity: shade }} />
      {/* The stage is laid out in CSS so chrome sizes and breakpoints stay in one place; slides are placed from its box. */}
      <div ref={stageRef} aria-hidden="true" className="pointer-events-none absolute inset-x-4 top-16 bottom-32 sm:inset-x-20" />
      <div
        ref={surfaceRef}
        className={cn("absolute inset-0 touch-none select-none", zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-default")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        {/* With reduced motion there is no flight: the photos fade in and out with the backdrop. */}
        {stage ? (
          <motion.div className="absolute inset-0" style={{ x: track, opacity: reduced ? shade : 1 }}>
            {images.map((slide, at) => {
              if (!near(at)) return null
              const fit = fitIn(slide, stage)
              if (!fit) return null
              const isCurrent = at === index
              return (
                <Slide
                  key={`${slide.src}-${at}`}
                  image={slide}
                  current={isCurrent}
                  left={fit.x + at * pitch}
                  top={fit.y}
                  width={fit.w}
                  height={fit.h}
                  photoRef={isCurrent ? photoRef : undefined}
                  transform={isCurrent ? { x, y, scale, radius } : undefined}
                />
              )
            })}
          </motion.div>
        ) : null}
      </div>

      <motion.div className={cn("pointer-events-none absolute inset-0", closing && "[&_*]:pointer-events-none!")} style={{ opacity: chrome }}>
        <div className="pointer-events-auto absolute inset-x-0 top-0 flex h-16 items-center justify-between gap-3 px-4">
          <p aria-live="polite" aria-atomic="true" className="m-0 min-w-16 text-sm tabular-nums text-text-secondary">
            {index + 1} of {count}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Zoom"
              aria-pressed={zoomed}
              className={roundButton}
              onClick={() => zoomTo(zoomed ? 1 : DOUBLE_ZOOM)}
            >
              {zoomed ? <ZoomOut size={18} strokeWidth={1.75} aria-hidden="true" /> : <ZoomIn size={18} strokeWidth={1.75} aria-hidden="true" />}
            </button>
            <button type="button" aria-label="Close" data-lightbox-close="" className={roundButton} onClick={() => close()}>
              <X size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Previous photo"
          disabled={index === 0}
          className={cn(roundButton, sideButton, "left-4")}
          onClick={() => go(-1)}
        >
          <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Next photo"
          disabled={index === count - 1}
          className={cn(roundButton, sideButton, "right-4")}
          onClick={() => go(1)}
        >
          <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex h-32 flex-col items-center justify-end gap-2.5 pb-4">
          <div className="min-h-10 max-w-[min(32rem,calc(100%-2rem))] text-center">
            {image?.title ? <p className="m-0 truncate text-sm leading-body font-medium">{image.title}</p> : null}
            {image?.caption ? <p className="m-0 truncate text-xs leading-body text-text-secondary">{image.caption}</p> : null}
          </div>
          <div role="group" aria-label="Photos" className="flex max-w-[calc(100%-2rem)] gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {images.map((thumb, at) => (
              <button
                key={`${thumb.src}-${at}`}
                ref={node => {
                  thumbs.current[at] = node
                }}
                type="button"
                aria-label={`Photo ${at + 1}, ${nameOf(thumb)}`}
                aria-current={at === index ? "true" : undefined}
                className={cn(
                  "relative size-10 flex-none cursor-pointer overflow-hidden rounded-[8px] bg-surface-muted opacity-56 outline-none [-webkit-tap-highlight-color:transparent]",
                  "transition-[opacity,scale] duration-160 ease-standard pointer-fine:hover:opacity-84 focus-visible:opacity-84 motion-reduce:transition-none",
                  "aria-[current='true']:scale-[1.08] aria-[current='true']:opacity-100",
                )}
                onClick={() => onIndexChange(at)}
              >
                <Image src={thumb.src} alt="" fill sizes="40px" className="object-cover" draggable={false} />
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/** 40px round controls on the muted surface. No focus ring: focus brightens the fill instead. */
const roundButton = [
  "pointer-events-auto grid size-10 cursor-pointer place-items-center rounded-pill bg-surface-muted text-foreground outline-none [-webkit-tap-highlight-color:transparent]",
  "transition-[background-color,opacity] duration-160 ease-standard pointer-fine:hover:not-disabled:bg-border focus-visible:bg-border motion-reduce:transition-none",
  "aria-pressed:bg-foreground aria-pressed:text-background disabled:cursor-default disabled:opacity-40",
].join(" ")
/** Side arrows hide below 640px, where swiping navigates. */
const sideButton = "absolute top-1/2 -translate-y-1/2 max-sm:hidden"

function Slide({
  image,
  current,
  left,
  top,
  width,
  height,
  photoRef,
  transform,
}: {
  image: LightboxImage
  current: boolean
  left: number
  top: number
  width: number
  height: number
  photoRef?: { current: HTMLDivElement | null }
  transform?: { x: MotionValue<number>; y: MotionValue<number>; scale: MotionValue<number>; radius: MotionValue<number> }
}) {
  const [loaded, setLoaded] = useState(false)
  return (
    <motion.div
      ref={photoRef}
      aria-hidden={current ? undefined : true}
      inert={!current}
      className="absolute overflow-hidden bg-surface-muted will-change-transform"
      style={{ left, top, width, height, borderRadius: transform?.radius ?? RADIUS, x: transform?.x, y: transform?.y, scale: transform?.scale }}
    >
      {/* The grid's file is already cached, so the photo is never blank while the full size loads over it. */}
      <Image src={image.src} alt="" fill sizes={GRID_SIZES} className="object-cover" draggable={false} aria-hidden="true" />
      <Image
        src={image.src}
        alt={current ? image.alt : ""}
        fill
        sizes="100vw"
        loading={current ? "eager" : "lazy"}
        className={cn("object-cover transition-opacity duration-240 ease-standard motion-reduce:transition-none", loaded ? "opacity-100" : "opacity-0")}
        draggable={false}
        onLoad={() => setLoaded(true)}
      />
    </motion.div>
  )
}

export default LightboxGallery
