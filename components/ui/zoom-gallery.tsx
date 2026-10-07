"use client"

import { memo, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react"
import Image from "next/image"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "motion/react"
import type { MotionValue } from "motion/react"
import { CaretLeftIcon, CaretRightIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, XIcon } from "@phosphor-icons/react"

import { motionTokens as presets } from "@/lib/motion-tokens"
import { useMotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"
import { clamp, pointerVelocity, rubberBand, type Sample } from "@/lib/gesture"

export interface ZoomShot {
  src: string
  /** Intrinsic width; with height it sets the aspect ratio in the grid, the zoom and the return flight. */
  width: number
  height: number
  alt: string
  /** Bold first line of the caption. */
  name?: string
  /** Smaller second line of the caption. */
  note?: string
}

export interface ZoomGalleryProps {
  /** Photos in reading order. Keep the array and its items stable between renders, so grid tiles skip re-rendering. */
  shots: ZoomShot[]
  /** Columns are added while each stays at least this wide, in px. There are always at least two. */
  minTile?: number
  /** Space between tiles in px. */
  spacing?: number
  /** Accessible name of the gallery and its viewer. */
  label?: string
  /** Class on the root region. */
  className?: string
}

/** Corner radius in px. The flight divides it by the current scale, so it reads the same at every size. */
const RADIUS = 12
const MAX_ZOOM = 4
/** `+` and `-` multiply or divide the zoom by this. */
const STEP_ZOOM = 1.5
/** Ctrl+wheel zooms by exp(-deltaY * WHEEL_ZOOM), so a notch feels the same at every zoom. */
const WHEEL_ZOOM = 0.003
/** A drag down past this many px, or a downward fling faster than FLING px/s, dismisses. */
const DISMISS = 110
const FLING = 600
/** While dragging down, scale, veil and chrome each fall linearly with the distance: per px, and the px at which they reach 0. */
const DRAG_SHRINK = 0.00074
const DRAG_VEIL = 636
const DRAG_CHROME = 254
/** A sideways release moves on past this share of the stage, or on a flick faster than SWIPE_FLING px/s. */
const SWIPE_SHARE = 0.3
const SWIPE_FLING = 500
/** How far a released pan keeps travelling, in seconds of its velocity. */
const PROJECT = 0.2

/* Flights are critically damped: out of the grid a little quicker than `smooth`, home again on `smooth`'s stiffer cousin. */
const openFlight = { type: "spring", stiffness: 289, damping: 37 } as const
const closeFlight = { type: "spring", stiffness: 196, damping: 28 } as const
/** A cancelled dismiss drag springs home a touch underdamped, so it lands with a little weight. */
const dragReturn = { type: "spring", stiffness: 272, damping: 26 } as const
const outCubic = [0.33, 1, 0.68, 1] as [number, number, number, number]
/** Grid and placeholder share one sizes string, so the viewer's placeholder is the grid file the browser already has. */
const GRID_SIZES = "(min-width: 900px) 260px, (min-width: 600px) 34vw, 50vw"

/** Past an edge, the track stretches toward this many px instead of following the pointer. */
const EDGE_STRETCH = 120
const fade = { duration: 0.1, ease: [...presets.ease.standard] as [number, number, number, number] }

const nameOf = (image: ZoomShot) => image.name ?? image.alt

/** The photo's resting box: contained in the stage, centered. */
function fitIn(image: ZoomShot | undefined, box: Rect | null): Rect | null {
  if (!box || !image) return null
  const ratio = Math.min(box.w / image.width, box.h / image.height)
  const w = image.width * ratio
  const h = image.height * ratio
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h }
}

/** A masonry grid of photos that open in a fullscreen viewer. */
export function ZoomGallery({ shots, minTile = 150, spacing = 8, label = "Image gallery", className }: ZoomGalleryProps) {
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
    const count = Math.max(2, Math.floor((width + spacing) / (minTile + spacing)) || 2)
    const columnWidth = width ? (width - spacing * (count - 1)) / count : minTile
    const heights = new Array<number>(count).fill(0)
    const lists = Array.from({ length: count }, () => [] as number[])
    // Each photo goes under the shortest column, so reading order runs across the top and the columns end level.
    shots.forEach((image, index) => {
      let target = 0
      for (let column = 1; column < count; column++) if (heights[column] < heights[target] - 0.5) target = column
      lists[target].push(index)
      heights[target] += (columnWidth * image.height) / image.width + spacing
    })
    return lists
  }, [spacing, shots, minTile, width])

  // Stable, so the memoized tiles skip every re-render caused by the viewer changing `current`.
  const show = useCallback((index: number) => {
    setCurrent(index)
    setOpen(true)
  }, [])
  const register = useCallback((index: number, node: HTMLButtonElement | null) => {
    slots.current[index] = node
  }, [])

  return (
    <section ref={rootRef} aria-label={label} className={cn("w-full", className)}>
      <div className="flex items-start" style={{ gap: spacing }}>
        {columns.map((list, column) => (
          <div key={column} className="flex min-w-0 flex-1 flex-col" style={{ gap: spacing }}>
            {list.map(index => {
              const image = shots[index]
              return (
                <GridTile
                  key={`${image.src}-${index}`}
                  image={image}
                  index={index}
                  total={shots.length}
                  hidden={open && index === current}
                  onOpen={show}
                  register={register}
                />
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
            className="fixed inset-0 z-[1000] overflow-hidden text-foreground outline-none"
            initialFocus={() => document.querySelector<HTMLElement>("[data-zoom-close]")}
            finalFocus={() => slots.current[current] ?? true}
          >
            <Viewer
              shots={shots}
              label={label}
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

/** One grid photo. Memoized so a swipe in the viewer, which changes `current`, re-renders only the tile that hides or reveals. */
const GridTile = memo(function GridTile({
  image,
  index,
  total,
  hidden,
  onOpen,
  register,
}: {
  image: ZoomShot
  index: number
  total: number
  hidden: boolean
  onOpen: (index: number) => void
  register: (index: number, node: HTMLButtonElement | null) => void
}) {
  return (
    <button
      ref={node => register(index, node)}
      type="button"
      aria-label={`Open ${nameOf(image)}, photo ${index + 1} of ${total}`}
      aria-haspopup="dialog"
      className={cn(
        "relative block w-full cursor-zoom-in overflow-hidden bg-surface-muted outline-none [-webkit-tap-highlight-color:transparent]",
        "transition-[filter,scale] duration-160 ease-standard pointer-fine:hover:brightness-[.94] focus-visible:scale-[.97] motion-reduce:transition-none",
      )}
      style={{ aspectRatio: `${image.width} / ${image.height}`, borderRadius: RADIUS, opacity: hidden ? 0 : 1 }}
      onClick={() => onOpen(index)}
    >
      <Image src={image.src} alt="" fill sizes={GRID_SIZES} className="object-cover" draggable={false} />
    </button>
  )
})

type Range = readonly [number, number]

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

type Gesture =
  | { kind: "pending" | "swipe" | "dismiss" | "pan"; id: number; x: number; y: number; track: number; px: number; py: number; samples: Sample[] }
  | { kind: "pinch"; distance: number; mid: { x: number; y: number }; zoom: number; px: number; py: number }

function Viewer({
  shots,
  label,
  index,
  onIndexChange,
  slotFor,
  onClosed,
  closeRef,
  keyRef,
}: {
  shots: ZoomShot[]
  label: string
  index: number
  onIndexChange: (index: number) => void
  slotFor: (index: number) => HTMLElement | null
  onClosed: () => void
  closeRef: { current: (velocity?: number) => void }
  keyRef: { current: (event: ReactKeyboardEvent<HTMLDivElement>) => void }
}) {
  const motionTokens = useMotionTokens()
  const reduced = useReducedMotion() ?? false
  const stageRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const photoRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<Rect | null>(null)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const [zoomed, setZoomed] = useState(false)
  const [closing, setClosing] = useState(false)
  const count = shots.length
  const viewportWidth = viewport.w
  /** Slides sit one viewport apart; the frame padding keeps a neighbour from peeking in. */
  const pitch = viewportWidth

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

  const shrink = useTransform(() => Math.max(0.4, 1 - Math.max(0, dy.get()) * DRAG_SHRINK))
  const x = useTransform(() => fx.get() + dx.get() + px.get())
  const y = useTransform(() => fy.get() + dy.get() + py.get())
  const scale = useTransform(() => fs.get() * shrink.get() * z.get())
  const radius = useTransform(() => RADIUS / Math.max(0.05, scale.get()))
  // Zoom changes every frame; only the flip across 1.01 needs a render.
  const zoomedRef = useRef(false)
  useMotionValueEvent(z, "change", value => {
    const next = value > 1.01
    if (zoomedRef.current === next) return
    zoomedRef.current = next
    setZoomed(next)
  })

  const stateRef = useRef({ index, stage, pitch, viewport, reduced, closing: false })
  useLayoutEffect(() => {
    stateRef.current = { index, stage, pitch, viewport, reduced, closing: stateRef.current.closing }
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
      const w = node.parentElement?.clientWidth ?? window.innerWidth
      const h = node.parentElement?.clientHeight ?? window.innerHeight
      setViewport(previous => (previous.w === w && previous.h === h ? previous : { w, h }))
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  const fitFor = useCallback((at: number, box: Rect | null = stateRef.current.stage) => fitIn(shots[at], box), [shots])

  /* Opening: the photo starts exactly over its grid slot and springs out to fit the stage. This runs on mount, before
     the slides exist, so their first painted frame is already the grid slot rather than the fitted rect. */
  const opened = useRef(false)
  useLayoutEffect(() => {
    const node = stageRef.current
    if (!node || opened.current) return
    opened.current = true
    const box = node.getBoundingClientRect()
    track.jump(-index * (node.parentElement?.clientWidth ?? window.innerWidth))
    const slot = slotFor(index)?.getBoundingClientRect()
    const fit = fitFor(index, { x: box.left, y: box.top, w: box.width, h: box.height })
    if (reduced || !slot || !fit || !slot.width) {
      animate(shade, 1, fade)
      animate(chrome, 1, fade)
      return
    }
    // One uniform scale and translate on one spring, so the photo never stretches on the way out.
    fs.jump(slot.width / fit.w)
    fx.jump(slot.left + slot.width / 2 - (fit.x + fit.w / 2))
    fy.jump(slot.top + slot.height / 2 - (fit.y + fit.h / 2))
    animate(fs, 1, openFlight)
    animate(fx, 0, openFlight)
    animate(fy, 0, openFlight)
    // The backdrop is nearly opaque before the photo is halfway out; the chrome follows a beat later.
    animate(shade, 1, { duration: 0.24, ease: [...presets.ease.enter] })
    animate(chrome, 1, { duration: 0.19, ease: outCubic, delay: 0.02 })
  }, [chrome, fitFor, fs, fx, fy, index, reduced, shade, slotFor, track])

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
  }, [index, motionTokens.spring.smooth, pitch, px, py, reduced, track, viewportWidth, z])

  /* The opening frame mounts only the current slide; the neighbours, all off screen, follow a frame later in a
     transition, so React can slice their render between frames of the flight. */
  const [warm, setWarm] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => startTransition(() => setWarm(true)))
    return () => cancelAnimationFrame(frame)
  }, [])

  const close = useCallback(
    (velocity = 0) => {
      const state = stateRef.current
      if (state.closing) return
      state.closing = true
      setClosing(true)
      const finish = () => onClosed()
      animate(chrome, 0, { duration: 0.05, ease: "linear" })
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
      animate(fx, slot.left + slot.width / 2 - (fit.x + fit.w / 2), closeFlight)
      animate(fy, slot.top + slot.height / 2 - (fit.y + fit.h / 2), { ...closeFlight, velocity })
      animate(fs, slot.width / fit.w, { ...closeFlight, onComplete: finish })
      animate(shade, 0, { duration: 0.26, ease: outCubic })
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

  /** Pan limits per axis: a photo larger than the viewport keeps covering it, a smaller one stays inside it. */
  const panBounds = useCallback(
    (zoom: number): { x: Range; y: Range } => {
      const fit = fitFor(stateRef.current.index)
      const { w, h } = stateRef.current.viewport
      if (!fit || !w || !h) return { x: [0, 0], y: [0, 0] }
      const axis = (start: number, size: number, room: number): Range => {
        const center = start + size / 2
        const a = (size * zoom) / 2 - center
        const b = room - center - (size * zoom) / 2
        return [Math.min(0, a, b), Math.max(0, a, b)]
      }
      return { x: axis(fit.x, fit.w, w), y: axis(fit.y, fit.h, h) }
    },
    [fitFor],
  )

  /** The double click and the zoom button fill the viewport's width; a photo that nearly does already doubles. */
  const fillZoom = useCallback(() => {
    const fit = fitFor(stateRef.current.index)
    const width = stateRef.current.viewport.w
    if (!fit || !width) return 2
    const fill = width / fit.w
    return clamp(fill >= 1.5 ? fill : 2, 1, MAX_ZOOM)
  }, [fitFor])

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
      const nx = clamp(sx - (sx - px.get()) * ratio, ...bounds.x)
      const ny = clamp(sy - (sy - py.get()) * ratio, ...bounds.y)
      if (instant || stateRef.current.reduced) {
        for (const value of [z, px, py]) value.stop()
        z.jump(next)
        px.jump(nx)
        py.jump(ny)
        return
      }
      animate(z, next, motionTokens.spring.snappy)
      animate(px, nx, motionTokens.spring.snappy)
      animate(py, ny, motionTokens.spring.snappy)
    },
    [fitFor, motionTokens.spring.snappy, panBounds, px, py, z],
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
      zoomTo(z.get() * Math.exp(-event.deltaY * WHEEL_ZOOM), { x: event.clientX, y: event.clientY }, true)
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
    const transition = stateRef.current.reduced ? { duration: 0 } : motionTokens.spring.snappy
    animate(z, next, transition)
    animate(px, clamp(px.get(), ...bounds.x), transition)
    animate(py, clamp(py.get(), ...bounds.y), transition)
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
      const next = raw < 1 ? 1 - rubberBand(1 - raw, 0.3) : raw > MAX_ZOOM ? MAX_ZOOM + rubberBand(raw - MAX_ZOOM, 0.6) : raw
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
      for (const value of [track, dx, dy, px, py, fx, fy, fs, shade, chrome]) value.stop()
      state.kind = z.get() > 1.01 ? "pan" : Math.abs(deltaX) > Math.abs(deltaY) ? "swipe" : "dismiss"
      // No re-anchoring: once the direction is known the photo catches up and then follows the pointer 1:1.
      state.track = track.get()
      state.px = px.get()
      state.py = py.get()
    }
    const { index: at, pitch: step } = stateRef.current
    if (state.kind === "swipe") {
      const rest = -at * step
      let next = state.track + deltaX
      // Past the first or last photo the track stretches like rubber.
      if (next > 0) next = rubberBand(next, EDGE_STRETCH)
      if (next < -(count - 1) * step) next = -(count - 1) * step - rubberBand(-(count - 1) * step - next, EDGE_STRETCH)
      track.set(Number.isFinite(next) ? next : rest)
      return
    }
    if (state.kind === "dismiss") {
      const down = deltaY >= 0 ? deltaY : -rubberBand(-deltaY, 60)
      dy.set(down)
      dx.set(deltaX)
      // Scale (in `shrink`), veil and chrome are straight lines in the distance, the chrome going first.
      const distance = Math.max(0, down)
      shade.set(clamp(1 - distance / DRAG_VEIL, 0, 1))
      chrome.set(clamp(1 - distance / DRAG_CHROME, 0, 1))
      return
    }
    // Pan: free inside the bounds, rubber beyond them.
    const bounds = panBounds(z.get())
    const bend = (value: number, [low, high]: Range) =>
      value > high ? high + rubberBand(value - high, 80) : value < low ? low - rubberBand(low - value, 80) : value
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
    const velocity = pointerVelocity(state.samples, event.timeStamp, { window: 100 })
    const { index: at, pitch: step, reduced: still } = stateRef.current
    const spring = (velocityValue: number) => (still ? { duration: 0 } : { ...motionTokens.spring.smooth, velocity: velocityValue })

    if (state.kind === "pending") {
      if (event.type === "pointercancel") return
      // A tap: double tap zooms on touch (mouse uses dblclick); a mouse click beside the photo closes.
      if (event.pointerType !== "mouse") {
        const previous = lastTap.current
        if (previous && event.timeStamp - previous.t < 320 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 30) {
          lastTap.current = null
          zoomTo(z.get() > 1.01 ? 1 : fillZoom(), { x: event.clientX, y: event.clientY })
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
      const threshold = step * SWIPE_SHARE
      // Far enough, or a flick in the same direction, moves on; a flick back against the drag cancels it.
      const flick = Math.abs(velocity.x) > SWIPE_FLING ? Math.sign(velocity.x) : 0
      const direction =
        flick !== 0 && Math.sign(offset) === flick ? -flick : flick === 0 && Math.abs(offset) > threshold ? -Math.sign(offset) : 0
      const next = clamp(at + direction, 0, count - 1)
      if (next !== at) {
        swipeVelocity.current = still ? 0 : velocity.x
        onIndexChange(next)
      } else animate(track, -at * step, spring(velocity.x))
      return
    }
    if (state.kind === "dismiss") {
      if (dy.get() > DISMISS || (dy.get() > 0 && velocity.y > FLING)) return close(Math.max(0, velocity.y))
      const back = (velocityValue: number) => (still ? { duration: 0 } : { ...dragReturn, velocity: velocityValue })
      animate(dx, 0, back(velocity.x))
      animate(dy, 0, back(velocity.y))
      animate(shade, 1, still ? { duration: 0 } : { duration: 0.15, ease: outCubic })
      animate(chrome, 1, still ? { duration: 0 } : { duration: 0.15, ease: outCubic })
      return
    }
    // A released pan glides on with its momentum and lands inside the bounds.
    const bounds = panBounds(z.get())
    animate(px, clamp(px.get() + (still ? 0 : velocity.x * PROJECT), ...bounds.x), spring(velocity.x))
    animate(py, clamp(py.get() + (still ? 0 : velocity.y * PROJECT), ...bounds.y), spring(velocity.y))
  }

  const onDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const photo = photoRef.current?.getBoundingClientRect()
    if (!photo || event.clientX < photo.left || event.clientX > photo.right || event.clientY < photo.top || event.clientY > photo.bottom) return
    zoomTo(z.get() > 1.01 ? 1 : fillZoom(), { x: event.clientX, y: event.clientY })
  }

  const image = shots[index]
  const near = (at: number) => at === index || (warm && Math.abs(at - index) <= 2)

  return (
    <div className="absolute inset-0">
      <h2 className="sr-only">{image?.name ? `${label}: ${image.name}` : label}</h2>
      <motion.div aria-hidden="true" className="absolute inset-0 bg-background will-change-[opacity]" style={{ opacity: shade }} />
      {/* The stage is laid out in CSS so chrome sizes and breakpoints stay in one place; slides are placed from its box. */}
      <div ref={stageRef} aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-[68px] bottom-[140px] sm:inset-x-[72px] sm:top-[72px] sm:bottom-[148px]" />
      <div
        ref={surfaceRef}
        className={cn("absolute inset-0 touch-none select-none", zoomed && "cursor-grab active:cursor-grabbing [&_*]:cursor-[inherit]")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        {/* With reduced motion there is no flight: the photos fade in and out with the backdrop. */}
        {stage ? (
          <motion.div className="absolute inset-0" style={{ x: track, opacity: reduced ? shade : 1 }}>
            {shots.map((slide, at) => {
              if (!near(at)) return null
              const fit = fitIn(slide, stage)
              if (!fit) return null
              const isCurrent = at === index
              return (
                <Slide
                  key={`${slide.src}-${at}`}
                  image={slide}
                  current={isCurrent}
                  eager={Math.abs(at - index) <= 1}
                  left={fit.x + at * pitch}
                  top={fit.y}
                  width={fit.w}
                  height={fit.h}
                  photoRef={isCurrent ? photoRef : undefined}
                  className={isCurrent ? "cursor-zoom-in" : undefined}
                  transform={isCurrent ? { x, y, scale, radius } : undefined}
                />
              )
            })}
          </motion.div>
        ) : null}
      </div>

      <motion.div className={cn("pointer-events-none absolute inset-0 will-change-[opacity]", closing && "[&_*]:pointer-events-none!")} style={{ opacity: chrome }}>
        <div className="pointer-events-auto absolute inset-x-0 top-0 flex h-14 items-center justify-between gap-3 pr-3 pl-[22px] sm:h-16">
          <p aria-live="polite" aria-atomic="true" className="m-0 min-w-16 text-sm tabular-nums text-text-secondary">
            {index + 1} of {count}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={zoomed ? "Zoom out" : "Zoom in"}
              className={iconButton}
              onClick={() => zoomTo(zoomed ? 1 : fillZoom())}
            >
              {zoomed ? <MagnifyingGlassMinusIcon size={20} aria-hidden="true" /> : <MagnifyingGlassPlusIcon size={20} aria-hidden="true" />}
            </button>
            <button type="button" aria-label="Close viewer" data-zoom-close="" className={iconButton} onClick={() => close()}>
              <XIcon size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Previous photo"
          disabled={index === 0}
          className={cn(navButton, "left-4")}
          onClick={() => go(-1)}
        >
          <CaretLeftIcon size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Next photo"
          disabled={index === count - 1}
          className={cn(navButton, "right-4")}
          onClick={() => go(1)}
        >
          <CaretRightIcon size={18} aria-hidden="true" />
        </button>
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex h-32 flex-col items-center justify-end pb-4 sm:h-[140px]">
          <div className="flex min-h-[62px] max-w-[min(32rem,calc(100%-2rem))] flex-col items-center justify-end pb-2.5 text-center">
            {image?.name ? <p className="m-0 max-w-full truncate text-sm leading-[1.4] font-medium">{image.name}</p> : null}
            {image?.note ? <p className="m-0 max-w-full truncate text-xs leading-[1.4] text-text-secondary">{image.note}</p> : null}
          </div>
          <ThumbStrip shots={shots} index={index} reduced={reduced} onSelect={onIndexChange} />
        </div>
      </motion.div>
    </div>
  )
}

/** The thumbnail strip. Memoized, so measuring the stage or zooming re-renders the viewer without it. */
const ThumbStrip = memo(function ThumbStrip({
  shots,
  index,
  reduced,
  onSelect,
}: {
  shots: ZoomShot[]
  index: number
  reduced: boolean
  onSelect: (index: number) => void
}) {
  const stripRef = useRef<HTMLDivElement>(null)
  const thumbs = useRef<(HTMLButtonElement | null)[]>([])

  // The current thumbnail sits at the center of the strip. The first placement is instant.
  const centered = useRef(false)
  useEffect(() => {
    const strip = stripRef.current
    const thumb = thumbs.current[index]
    if (!strip || !thumb) return
    const left = thumb.offsetLeft + thumb.offsetWidth / 2 - strip.clientWidth / 2
    strip.scrollTo({ left, behavior: reduced || !centered.current ? "auto" : "smooth" })
    centered.current = true
  }, [index, reduced])

  return (
    // Half a strip of padding on each side lets the first and last thumbnails reach the center too.
    <div
      ref={stripRef}
      role="group"
      aria-label="All photos"
      className="flex h-[52px] w-full touch-pan-x items-center gap-1 overflow-x-auto px-[calc(50%-18px)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {shots.map((thumb, at) => (
        <button
          key={`${thumb.src}-${at}`}
          ref={node => {
            thumbs.current[at] = node
          }}
          type="button"
          aria-label={`Show ${nameOf(thumb)}`}
          aria-current={at === index ? "true" : undefined}
          className={cn(
            "relative h-12 w-9 flex-none cursor-pointer overflow-hidden rounded-[8px] bg-surface-muted opacity-50 outline-none [-webkit-tap-highlight-color:transparent]",
            "[transition:width_.24s_var(--ease-standard),opacity_.16s_var(--ease-standard)] pointer-fine:hover:opacity-75 focus-visible:opacity-75 motion-reduce:transition-none",
            "aria-[current='true']:w-[38.4px] aria-[current='true']:opacity-100",
          )}
          onClick={() => onSelect(at)}
        >
          <Image src={thumb.src} alt="" fill sizes="40px" className="object-cover" draggable={false} />
        </button>
      ))}
    </div>
  )
})

/** 40px bare round icons in the top bar. No focus ring: focus fills them like a hover does. */
const iconButton = [
  "pointer-events-auto grid size-10 cursor-pointer place-items-center rounded-pill text-foreground outline-none [-webkit-tap-highlight-color:transparent]",
  "transition-[background-color,transform,opacity] duration-160 ease-standard pointer-fine:hover:bg-surface-muted focus-visible:bg-surface-muted motion-reduce:transition-none",
].join(" ")
/** 44px raised arrows on the stage midline. They vanish at the ends and below 640px, where swiping navigates. */
const navButton = [
  "pointer-events-auto absolute top-1/2 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-pill bg-surface-raised text-foreground shadow-raised outline-none max-sm:hidden [-webkit-tap-highlight-color:transparent]",
  "transition-[background-color,transform,opacity] duration-160 ease-standard focus-visible:bg-surface-muted motion-reduce:transition-none",
  "disabled:pointer-events-none disabled:opacity-0",
].join(" ")

function Slide({
  image,
  current,
  eager,
  left,
  top,
  width,
  height,
  photoRef,
  transform,
  className,
}: {
  image: ZoomShot
  current: boolean
  /** Within one of the current slide: loads now, so a swipe lands on a sharp photo. */
  eager: boolean
  left: number
  top: number
  width: number
  height: number
  photoRef?: { current: HTMLDivElement | null }
  transform?: { x: MotionValue<number>; y: MotionValue<number>; scale: MotionValue<number>; radius: MotionValue<number> }
  className?: string
}) {
  const [loaded, setLoaded] = useState(false)
  // A full-size file that is already complete when the slide mounts skips the fade; the placeholder stays under it until it decodes.
  const [instant, setInstant] = useState(false)
  const fullRef = useCallback((node: HTMLImageElement | null) => {
    if (node && node.complete && node.naturalWidth > 0) setInstant(true)
  }, [])
  return (
    <motion.div
      ref={photoRef}
      aria-hidden={current ? undefined : true}
      inert={!current}
      className={cn("absolute overflow-hidden bg-surface-muted will-change-transform", className)}
      style={{ left, top, width, height, borderRadius: transform?.radius ?? RADIUS, x: transform?.x, y: transform?.y, scale: transform?.scale }}
    >
      {/* One compositing layer for both photos: the wrapper's radius changes every frame of a flight, drag or zoom, and would otherwise re-raster them. */}
      <div className="absolute inset-0 will-change-transform">
        {/* The grid's file is usually cached, so the photo is never blank while the full size loads over it. */}
        <Image src={image.src} alt="" fill sizes={GRID_SIZES} className="object-cover" draggable={false} aria-hidden="true" />
        <Image
          ref={fullRef}
          src={image.src}
          alt={current ? image.alt : ""}
          fill
          sizes="100vw"
          loading={current || eager ? "eager" : "lazy"}
          className={cn(
            "object-cover",
            instant ? "opacity-100" : cn("transition-opacity duration-240 ease-standard motion-reduce:transition-none", loaded ? "opacity-100" : "opacity-0"),
          )}
          draggable={false}
          onLoad={() => setLoaded(true)}
        />
      </div>
    </motion.div>
  )
}

export default ZoomGallery
