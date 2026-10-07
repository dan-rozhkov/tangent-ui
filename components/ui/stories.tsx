"use client"

import { memo, useCallback, useMemo, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react"
import Image from "next/image"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { animate, motion, useMotionValue, useTransform } from "motion/react"
import type { AnimationPlaybackControls, MotionValue } from "motion/react"
import { CaretLeftIcon, CaretRightIcon, HeartIcon, PauseIcon, PlayIcon, XIcon } from "@phosphor-icons/react"

import { motionTokens as presets } from "@/lib/motion-tokens"
import { useMotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface StoryFrame {
  src: string
  /** Intrinsic size of the file. Optional: the frame always fills the card and is cropped to it, so nothing reads these. */
  width?: number
  height?: number
  alt: string
  /** Drawn over the lower part of the frame. */
  caption?: string
  /** Label next to the author's name, like "2h". */
  time?: string
}

export interface StoryAuthor {
  id: string
  name: string
  avatar: string
  frames: StoryFrame[]
}

export interface StoriesProps {
  /** Authors in tray order. Keep the array and its items stable between renders. */
  authors: StoryAuthor[]
  /** Seconds each frame stays up. */
  duration?: number
  /** Accessible name of the tray and viewer. */
  label?: string
  /** Class on the root region. */
  className?: string
}

/** Corner radius of the card in px, from 640px up. Below that the card is full-bleed. */
const RADIUS = 16
const WIDE = 640
/** A press held longer than this many ms pauses the story and hides the chrome instead of tapping. */
const HOLD = 200
/** A drag down past this many px, or a downward fling faster than FLING px/s, dismisses. */
const DISMISS = 110
const FLING = 600
/** While dragging down, scale, veil and chrome each fall linearly with the distance: per px, and the px at which they reach 0. */
const DRAG_SHRINK = 0.00074
const DRAG_VEIL = 636
const DRAG_CHROME = 254
/** A sideways release moves on past this share of the card, or on a flick faster than SWIPE_FLING px/s. */
const SWIPE_SHARE = 0.3
const SWIPE_FLING = 500
/** Darkest a face gets while it turns away, as an opacity of black. */
const TURN_SHADE = 0.55

/* Flights are critically damped: out of the tray a little quicker than `smooth`, home again on `smooth`'s stiffer cousin. */
const openFlight = { type: "spring", stiffness: 289, damping: 37 } as const
const closeFlight = { type: "spring", stiffness: 196, damping: 28 } as const
/** A cancelled dismiss drag springs home a touch underdamped, so it lands with a little weight. */
const dragReturn = { type: "spring", stiffness: 272, damping: 26 } as const
const outCubic = [0.33, 1, 0.68, 1] as [number, number, number, number]
const fade = { duration: 0.1, ease: [...presets.ease.standard] as [number, number, number, number] }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
/** Past an edge, travel approaches `limit` px instead of following the pointer. */
const rubber = (distance: number, limit = 120) => (1 - 1 / ((distance * 0.55) / limit + 1)) * limit

const keyOf = (author: StoryAuthor, frame: number) => `${author.id}:${frame}`
const unseenIn = (author: StoryAuthor, seen: ReadonlySet<string>) => author.frames.filter((_, at) => !seen.has(keyOf(author, at))).length
/** Where an author's story picks up: the first frame not seen yet, or the first frame once everything has been. */
function startOf(author: StoryAuthor, seen: ReadonlySet<string>) {
  const at = author.frames.findIndex((_, frame) => !seen.has(keyOf(author, frame)))
  return at < 0 ? 0 : at
}

/** A tray of story avatars that open into a full-screen viewer, one author per face of a cube. */
export function Stories({ authors: all, duration = 5, label = "Stories", className }: StoriesProps) {
  // An author with no frames has nothing to show, so it never reaches the tray or the viewer.
  const authors = useMemo(() => all.filter(author => author.frames.length > 0), [all])
  const trayRef = useRef<HTMLDivElement>(null)
  const slots = useRef<(HTMLButtonElement | null)[]>([])
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set())
  /** Liked frames, kept here so a like survives closing and reopening the viewer. */
  const [liked, setLiked] = useState<ReadonlySet<string>>(() => new Set())
  /** The open viewer. It stays set while the card flies home, so the avatar stays hidden until the card lands. */
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(0)
  const closeRef = useRef<(velocity?: number) => void>(() => {})
  /** Keys are read on the popup, so they work wherever focus sits inside the viewer, or on the popup itself. */
  const keyRef = useRef<(event: ReactKeyboardEvent<HTMLDivElement>) => void>(() => {})

  const show = useCallback((index: number) => {
    setCurrent(index)
    setOpen(true)
  }, [])
  const register = useCallback((index: number, node: HTMLButtonElement | null) => {
    slots.current[index] = node
  }, [])
  const toggleLiked = useCallback(
    (key: string) =>
      setLiked(previous => {
        const next = new Set(previous)
        if (!next.delete(key)) next.add(key)
        return next
      }),
    [],
  )
  const slotFor = useCallback((index: number) => slots.current[index]?.querySelector<HTMLElement>("[data-avatar]") ?? null, [])
  const onClosed = useCallback(() => setOpen(false), [])
  const markSeen = useCallback((key: string) => setSeen(previous => (previous.has(key) ? previous : new Set(previous).add(key))), [])

  // The viewer can end on another author than it opened on: that avatar scrolls into view, instantly, so the card has somewhere to land.
  const placed = useRef(-1)
  useLayoutEffect(() => {
    if (!open) {
      placed.current = -1
      return
    }
    // The first author belongs to the avatar that was tapped, wherever it sits.
    if (placed.current < 0 || placed.current === current) {
      placed.current = current
      return
    }
    placed.current = current
    const tray = trayRef.current
    const node = slots.current[current]
    if (!tray || !node) return
    const margin = 8
    if (node.offsetLeft - margin < tray.scrollLeft) tray.scrollLeft = node.offsetLeft - margin
    else if (node.offsetLeft + node.offsetWidth + margin > tray.scrollLeft + tray.clientWidth) {
      tray.scrollLeft = node.offsetLeft + node.offsetWidth + margin - tray.clientWidth
    }
  }, [current, open])

  return (
    <section aria-label={label} className={cn("w-full", className)}>
      <div ref={trayRef} className="relative flex touch-pan-x gap-4 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {authors.map((author, index) => (
          <Avatar
            key={author.id}
            author={author}
            index={index}
            unseen={unseenIn(author, seen)}
            hidden={open && index === current}
            onOpen={show}
            register={register}
          />
        ))}
      </div>
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next, details) => {
          // The viewer stays open while the card flies back; it closes itself when the card lands.
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
            initialFocus={() => document.querySelector<HTMLElement>("[data-stories-close]")}
            finalFocus={() => slots.current[current] ?? true}
          >
            <Viewer
              authors={authors}
              label={label}
              duration={duration}
              index={current}
              onIndexChange={setCurrent}
              seen={seen}
              onSeen={markSeen}
              liked={liked}
              onToggleLike={toggleLiked}
              slotFor={slotFor}
              onClosed={onClosed}
              closeRef={closeRef}
              keyRef={keyRef}
            />
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </section>
  )
}

/** One tray avatar. Memoized so marking frames seen in the viewer re-renders only the avatars whose ring changes. */
const Avatar = memo(function Avatar({
  author,
  index,
  unseen,
  hidden,
  onOpen,
  register,
}: {
  author: StoryAuthor
  index: number
  unseen: number
  hidden: boolean
  onOpen: (index: number) => void
  register: (index: number, node: HTMLButtonElement | null) => void
}) {
  const fresh = unseen > 0
  return (
    <button
      ref={node => register(index, node)}
      type="button"
      aria-label={`Open stories by ${author.name}, ${fresh ? `${unseen} new` : "all seen"}`}
      aria-haspopup="dialog"
      className="group flex w-[72px] shrink-0 cursor-pointer flex-col items-center gap-1.5 outline-none transition-transform duration-160 ease-standard [-webkit-tap-highlight-color:transparent] active:scale-95 motion-reduce:transition-none"
      onClick={() => onOpen(index)}
    >
      {/* Ring 2px, gap 2px, photo 64px. A seen ring is a 1px hairline on the gap's edge, so the swap is a soft cross-fade. */}
      <span className="relative block size-[72px] rounded-full" style={{ opacity: hidden ? 0 : 1 }}>
        <span
          aria-hidden="true"
          className={cn("absolute inset-0 rounded-full transition-opacity duration-240 ease-standard motion-reduce:transition-none", fresh ? "opacity-100" : "opacity-0")}
          style={{
            backgroundImage:
              "conic-gradient(from 200deg, var(--color-series-3), var(--color-series-2), var(--color-series-1), var(--color-series-3))",
          }}
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-[2px] rounded-full border bg-background transition-colors duration-240 ease-standard motion-reduce:transition-none",
            fresh ? "border-transparent" : "border-border-strong",
          )}
        />
        <span data-avatar="" className="absolute inset-1 overflow-hidden rounded-full bg-surface-muted">
          <Image
            src={author.avatar}
            alt=""
            fill
            sizes="64px"
            className="object-cover transition-[filter] duration-160 ease-standard pointer-fine:group-hover:brightness-[.94] group-focus-visible:brightness-[.85] motion-reduce:transition-none"
            draggable={false}
          />
        </span>
      </span>
      <span
        className={cn(
          "max-w-[72px] truncate text-xs leading-tight transition-colors duration-240 ease-standard motion-reduce:transition-none",
          fresh ? "text-foreground" : "text-text-secondary",
          "group-focus-visible:text-foreground",
        )}
      >
        {author.name}
      </span>
    </button>
  )
})

type Samples = { x: number; y: number; t: number }[]

interface Gesture {
  kind: "pending" | "swipe" | "dismiss"
  id: number
  x: number
  y: number
  /** Cube position when the swipe locked. */
  pos: number
  held: boolean
  timer: number
  samples: Samples
}

function velocityOf(samples: Samples, now: number) {
  const recent = samples.filter(sample => now - sample.t <= 100)
  const first = recent[0]
  const last = recent[recent.length - 1]
  if (!first || !last || first === last || now - last.t > 60) return { x: 0, y: 0 }
  const seconds = Math.max(0.008, (last.t - first.t) / 1000)
  return { x: (last.x - first.x) / seconds, y: (last.y - first.y) / seconds }
}

function Viewer({
  authors,
  label,
  duration,
  index,
  onIndexChange,
  seen,
  onSeen,
  liked,
  onToggleLike,
  slotFor,
  onClosed,
  closeRef,
  keyRef,
}: {
  authors: StoryAuthor[]
  label: string
  duration: number
  index: number
  onIndexChange: (index: number) => void
  seen: ReadonlySet<string>
  onSeen: (key: string) => void
  liked: ReadonlySet<string>
  onToggleLike: (key: string) => void
  slotFor: (index: number) => HTMLElement | null
  onClosed: () => void
  closeRef: { current: (velocity?: number) => void }
  keyRef: { current: (event: ReactKeyboardEvent<HTMLDivElement>) => void }
}) {
  const motionTokens = useMotionTokens()
  const reduced = useReducedMotion() ?? false
  const frameRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0, wide: false })
  const [frame, setFrame] = useState(() => startOf(authors[index], seen))
  /** Frames the neighbouring faces show while a programmatic change turns toward them. */
  const [targets, setTargets] = useState<Record<number, number>>({})
  const [paused, setPaused] = useState(false)
  const [closing, setClosing] = useState(false)
  const last = authors.length - 1
  const author = authors[index]

  /* The flight (fx, fy, fs), the dismiss drag (dx, dy) and the cube (pos, in authors) are separate values composed into
     one transform, so a drag can pick up a flight mid-air and a close can start from wherever the card is. */
  const fx = useMotionValue(0)
  const fy = useMotionValue(0)
  const fs = useMotionValue(1)
  const dx = useMotionValue(0)
  const dy = useMotionValue(0)
  const pos = useMotionValue(index)
  const shade = useMotionValue(0)
  const chrome = useMotionValue(0)
  /** 0 while the chrome is hidden by a held press. */
  const hold = useMotionValue(1)
  const progress = useMotionValue(0)
  /** 1 while the card is clipped to the avatar's circle, 0 once it has landed and the cube may draw outside the card. */
  const flying = useMotionValue(0)
  /** The flight scale at which the card sits exactly on the avatar. 1 when there is no flight. */
  const start = useMotionValue(1)
  const pop = useMotionValue(1)

  const sizeRef = useRef(size)
  const shrink = useTransform(() => Math.max(0.4, 1 - Math.max(0, dy.get()) * DRAG_SHRINK))
  const x = useTransform(() => fx.get() + dx.get())
  const y = useTransform(() => fy.get() + dy.get())
  const scale = useTransform(() => fs.get() * shrink.get())
  const radius = useTransform(() => (sizeRef.current.wide ? RADIUS : 0) / Math.max(0.05, scale.get()))
  /** How far open the card is: 0 on the avatar, 1 at its resting rect. The clip, the corners and the avatar veil all follow it. */
  const open = useTransform(() => {
    const from = start.get()
    return from >= 1 ? 1 : clamp((fs.get() - from) / (1 - from), 0, 1)
  })
  // A square crop with fully round corners at the start, opening to the whole card with its own radius.
  const clipPath = useTransform(() => {
    if (!flying.get()) return "none"
    const { w, h, wide } = sizeRef.current
    const t = open.get()
    const side = Math.min(w, h)
    const inX = ((w - side) / 2) * (1 - t)
    const inY = ((h - side) / 2) * (1 - t)
    const end = (wide ? RADIUS : 0) / Math.max(0.05, scale.get())
    return `inset(${inY}px ${inX}px ${inY}px ${inX}px round ${(side / 2) * (1 - t) + end * t}px)`
  })
  const veil = useTransform(() => clamp(1 - open.get() * 3.5, 0, 1))
  const ui = useTransform(() => chrome.get() * hold.get())
  // The buttons stay put while the cube turns, so they fade out of the way instead of turning with it.
  const buttons = useTransform(() => ui.get() * (1 - clamp(Math.abs(pos.get() - Math.round(pos.get())) * 3, 0, 1)))
  const cube = useTransform(pos, value => -value * 90)

  const likedRef = useRef(liked)
  const stateRef = useRef({ index, frame, size, reduced, duration, authors, seen })
  useLayoutEffect(() => {
    stateRef.current = { index, frame, size, reduced, duration, authors, seen }
    sizeRef.current = size
    likedRef.current = liked
  })
  /** Everything that can hold the timer, read by `sync`. Not state: none of it needs a render. */
  const flags = useRef({ closing: false, settling: false, moving: false, drag: false, hold: false, hidden: false, paused: false, ready: false })
  // `ready` is also "the opening flight has landed".
  const run = useRef<AnimationPlaybackControls | null>(null)
  const stepRef = useRef<(step: 1 | -1) => void>(() => {})

  useLayoutEffect(() => {
    const node = frameRef.current
    if (!node) return
    const measure = () => {
      const wide = window.innerWidth >= WIDE
      setSize(previous => (previous.w === node.offsetWidth && previous.h === node.offsetHeight && previous.wide === wide ? previous : { w: node.offsetWidth, h: node.offsetHeight, wide }))
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  /** Runs the fill while nothing holds it, and stops it the moment something does. Resumes from where the fill is. */
  const sync = useCallback(() => {
    const f = flags.current
    const go = f.ready && !f.closing && !f.paused && !f.hold && !f.hidden && !f.drag && !f.moving
    if (!go) {
      run.current?.stop()
      run.current = null
      return
    }
    if (run.current) return
    run.current = animate(progress, 1, {
      duration: Math.max(0, (1 - progress.get()) * stateRef.current.duration),
      ease: "linear",
      onComplete: () => {
        run.current = null
        stepRef.current(1)
      },
    })
  }, [progress])

  // Each new frame starts its fill from 0 and is marked seen.
  useLayoutEffect(() => {
    run.current?.stop()
    run.current = null
    progress.jump(0)
    sync()
  }, [index, frame, progress, sync])
  useEffect(() => {
    onSeen(keyOf(stateRef.current.authors[index], frame))
  }, [frame, index, onSeen])
  useEffect(() => {
    const change = () => {
      flags.current.hidden = document.hidden
      sync()
    }
    change()
    document.addEventListener("visibilitychange", change)
    return () => {
      document.removeEventListener("visibilitychange", change)
      run.current?.stop()
    }
  }, [sync])

  /* Opening: the card is laid out at its final rect and starts exactly over the tapped avatar, cropped to its circle,
     then springs out. This runs on mount, before the first paint, so the first painted frame is already on the avatar. */
  const opened = useRef(false)
  useLayoutEffect(() => {
    const node = frameRef.current
    if (!node || opened.current) return
    opened.current = true
    const box = node.getBoundingClientRect()
    const slot = slotFor(index)?.getBoundingClientRect()
    const ready = () => {
      flags.current.ready = true
      sync()
    }
    if (reduced || !slot || !box.width || !slot.width) {
      animate(shade, 1, fade)
      animate(chrome, 1, fade)
      ready()
      return
    }
    // One uniform scale and translate on one spring, so the card never stretches on the way out.
    // The circle that the clip leaves is min(w, h) wide, so that is the side that must match the avatar.
    const from = slot.width / Math.min(box.width, box.height)
    start.jump(from)
    flying.jump(1)
    fs.jump(from)
    fx.jump(slot.left + slot.width / 2 - (box.left + box.width / 2))
    fy.jump(slot.top + slot.height / 2 - (box.top + box.height / 2))
    animate(fs, 1, {
      ...openFlight,
      onComplete: () => {
        flying.jump(0)
        start.jump(1)
        ready()
      },
    })
    animate(fx, 0, openFlight)
    animate(fy, 0, openFlight)
    // The backdrop is nearly opaque before the card is halfway out; the chrome follows a beat later.
    animate(shade, 1, { duration: 0.24, ease: [...presets.ease.enter] })
    animate(chrome, 1, { duration: 0.19, ease: outCubic, delay: 0.1 })
  }, [chrome, flying, fs, fx, fy, index, reduced, shade, slotFor, start, sync])

  const close = useCallback(
    (velocity = 0) => {
      const f = flags.current
      if (f.closing) return
      f.closing = true
      setClosing(true)
      sync()
      const finish = () => onClosed()
      animate(chrome, 0, { duration: 0.05, ease: "linear" })
      if (stateRef.current.reduced) {
        animate(shade, 0, { ...fade, onComplete: finish })
        return
      }
      const at = stateRef.current.index
      const box = frameRef.current?.getBoundingClientRect()
      const now = cardRef.current?.getBoundingClientRect()
      const slot = slotFor(at)?.getBoundingClientRect()
      const visible = slot && slot.width > 0 && slot.bottom > 0 && slot.top < window.innerHeight && slot.right > 0 && slot.left < window.innerWidth
      // A cube in mid-turn goes home as the face it is closest to.
      pos.stop()
      pos.jump(at)
      if (box && now && box.width) {
        // Fold the drag into the flight values so the card leaves from exactly where it is.
        for (const value of [dx, dy]) value.stop()
        fs.jump(now.width / box.width)
        fx.jump(now.left + now.width / 2 - (box.left + box.width / 2))
        fy.jump(now.top + now.height / 2 - (box.top + box.height / 2))
        dx.jump(0)
        dy.jump(0)
      }
      if (!box || !slot || !visible) {
        animate(shade, 0, { ...fade, onComplete: finish })
        animate(fs, fs.get() * 0.9, fade)
        return
      }
      const target = slot.width / Math.min(box.width, box.height)
      start.jump(target)
      flying.jump(1)
      animate(fx, slot.left + slot.width / 2 - (box.left + box.width / 2), closeFlight)
      animate(fy, slot.top + slot.height / 2 - (box.top + box.height / 2), { ...closeFlight, velocity })
      animate(fs, target, { ...closeFlight, onComplete: finish })
      animate(shade, 0, { duration: 0.26, ease: outCubic })
    },
    [chrome, dx, dy, flying, fs, fx, fy, onClosed, pos, shade, slotFor, start, sync],
  )
  useLayoutEffect(() => {
    closeRef.current = close
  }, [close, closeRef])

  /** Turns the cube to another author on `smooth` (or fades, with reduced motion), then makes that author current. */
  const goAuthor = useCallback(
    (to: number, at?: number, velocity = 0) => {
      const f = flags.current
      if (f.closing || f.settling || f.drag || to < 0 || to > last) return
      const frameAt = at ?? startOf(stateRef.current.authors[to], stateRef.current.seen)
      f.settling = true
      f.moving = true
      sync()
      setTargets({ [to]: frameAt })
      const land = () => {
        f.settling = false
        f.moving = false
        setTargets({})
        setFrame(frameAt)
        onIndexChange(to)
      }
      if (stateRef.current.reduced) animate(pos, to, { duration: 0.16, ease: "linear", onComplete: land })
      else animate(pos, to, { ...motionTokens.spring.smooth, velocity, onComplete: land })
    },
    [last, motionTokens.spring.smooth, onIndexChange, pos, sync],
  )

  /** One frame forward or back, crossing authors at the ends. Past the very last frame the viewer closes. */
  const step = useCallback(
    (direction: 1 | -1) => {
      const f = flags.current
      if (f.closing || f.settling || f.drag) return
      const { index: at, frame: current, authors: list } = stateRef.current
      if (direction > 0) {
        if (current < list[at].frames.length - 1) return setFrame(current + 1)
        if (at < last) return goAuthor(at + 1)
        return close()
      }
      if (current > 0) return setFrame(current - 1)
      if (at > 0) return goAuthor(at - 1, list[at - 1].frames.length - 1)
      // Nothing before the first frame: it starts over.
      run.current?.stop()
      run.current = null
      progress.jump(0)
      sync()
    },
    [close, goAuthor, last, progress, sync],
  )
  useLayoutEffect(() => {
    stepRef.current = step
  }, [step])

  const togglePause = useCallback(() => {
    const next = !flags.current.paused
    flags.current.paused = next
    setPaused(next)
    sync()
  }, [sync])

  const toggleLike = useCallback(() => {
    const { authors: list, index: at, frame: current } = stateRef.current
    const key = keyOf(list[at], current)
    const on = !likedRef.current.has(key)
    onToggleLike(key)
    if (on) {
      pop.jump(0.6)
      animate(pop, 1, motionTokens.spring.snappy)
    }
  }, [motionTokens.spring.snappy, onToggleLike, pop])

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.altKey || event.metaKey || event.ctrlKey) return
      if (event.key === "ArrowLeft") step(-1)
      else if (event.key === "ArrowRight") step(1)
      // On a button Space presses that button instead.
      else if (event.key === " " && !(event.target as Element).closest("button")) togglePause()
      else return
      event.preventDefault()
    },
    [step, togglePause],
  )
  useLayoutEffect(() => {
    keyRef.current = onKeyDown
  }, [keyRef, onKeyDown])

  const gesture = useRef<Gesture | null>(null)

  const releaseHold = () => {
    if (!flags.current.hold) return
    flags.current.hold = false
    animate(hold, 1, { duration: 0.16, ease: outCubic })
    sync()
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const f = flags.current
    if (f.closing || f.settling || gesture.current || (event.pointerType === "mouse" && event.button !== 0)) return
    // The buttons are not part of the story's tap and drag surface.
    if ((event.target as Element).closest("button")) return
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* The pointer is already gone. */
    }
    const state: Gesture = {
      kind: "pending",
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      pos: pos.get(),
      held: false,
      timer: 0,
      samples: [{ x: event.clientX, y: event.clientY, t: event.timeStamp }],
    }
    state.timer = window.setTimeout(() => {
      if (gesture.current !== state || state.kind !== "pending") return
      state.held = true
      f.hold = true
      animate(hold, 0, { duration: 0.16, ease: outCubic })
      sync()
    }, HOLD)
    gesture.current = state
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = gesture.current
    if (!state || event.pointerId !== state.id) return
    if (flags.current.closing) {
      // The card is on its way home: the gesture is over.
      window.clearTimeout(state.timer)
      gesture.current = null
      return
    }
    const deltaX = event.clientX - state.x
    const deltaY = event.clientY - state.y
    state.samples.push({ x: event.clientX, y: event.clientY, t: event.timeStamp })
    if (state.samples.length > 12) state.samples.shift()
    if (state.kind === "pending") {
      if (Math.hypot(deltaX, deltaY) < 6) return
      window.clearTimeout(state.timer)
      releaseHold()
      // A drag that starts during the opening flight rides on it: the flight keeps running and lands underneath.
      for (const value of [pos, dx, dy]) value.stop()
      if (flags.current.ready) for (const value of [fx, fy, fs, shade, chrome]) value.stop()
      state.kind = Math.abs(deltaX) > Math.abs(deltaY) ? "swipe" : "dismiss"
      state.pos = pos.get()
      flags.current.drag = true
      flags.current.moving = state.kind === "swipe"
      sync()
    }
    if (state.kind === "swipe") {
      const width = Math.max(1, stateRef.current.size.w)
      // The cube follows the finger 1:1; past the first or last author it stretches like rubber.
      // Only the neighbours are mounted, so the cube stops there like it does at the ends.
      const low = Math.max(0, stateRef.current.index - 1)
      const high = Math.min(last, stateRef.current.index + 1)
      let next = state.pos - deltaX / width
      if (next < low) next = low - rubber((low - next) * width) / width
      if (next > high) next = high + rubber((next - high) * width) / width
      pos.set(Number.isFinite(next) ? next : state.pos)
      return
    }
    const down = deltaY >= 0 ? deltaY : -rubber(-deltaY, 60)
    dy.set(down)
    dx.set(deltaX)
    // Scale (in `shrink`), veil and chrome are straight lines in the distance, the chrome going first.
    const distance = Math.max(0, down)
    if (!flags.current.ready) return
    shade.set(clamp(1 - distance / DRAG_VEIL, 0, 1))
    chrome.set(clamp(1 - distance / DRAG_CHROME, 0, 1))
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = gesture.current
    if (!state || event.pointerId !== state.id) return
    gesture.current = null
    window.clearTimeout(state.timer)
    const f = flags.current
    if (f.closing) return
    const velocity = velocityOf(state.samples, event.timeStamp)
    const still = stateRef.current.reduced

    if (state.kind === "pending") {
      // A hold ends without a tap; so does a cancelled press.
      if (state.held) return releaseHold()
      if (event.type === "pointercancel") return
      const box = frameRef.current?.getBoundingClientRect()
      if (!box) return
      const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom
      // Beside the card a mouse click closes; a touch there does nothing.
      if (!inside) return event.pointerType === "mouse" ? close() : undefined
      step(event.clientX < box.left + box.width / 3 ? -1 : 1)
      return
    }
    f.drag = false
    if (state.kind === "swipe") {
      const at = stateRef.current.index
      const width = Math.max(1, stateRef.current.size.w)
      const offset = (at - pos.get()) * width
      const threshold = width * SWIPE_SHARE
      // Far enough, or a flick in the same direction, moves on; a flick back against the drag cancels it.
      const flick = Math.abs(velocity.x) > SWIPE_FLING ? Math.sign(velocity.x) : 0
      const direction = flick !== 0 && Math.sign(offset) === flick ? -flick : flick === 0 && Math.abs(offset) > threshold ? -Math.sign(offset) : 0
      const next = clamp(at + direction, 0, last)
      if (next !== at) {
        f.moving = false
        goAuthor(next, undefined, still ? 0 : -velocity.x / width)
        return
      }
      f.settling = true
      const settle = () => {
        f.settling = false
        f.moving = false
        sync()
      }
      if (still) {
        pos.jump(at)
        settle()
      } else animate(pos, at, { ...motionTokens.spring.smooth, velocity: -velocity.x / width, onComplete: settle })
      return
    }
    if (dy.get() > DISMISS || (dy.get() > 0 && velocity.y > FLING)) return close(Math.max(0, velocity.y))
    const back = (value: number) => (still ? { duration: 0 } : { ...dragReturn, velocity: value })
    animate(dx, 0, back(velocity.x))
    animate(dy, 0, back(velocity.y))
    animate(shade, 1, still ? { duration: 0 } : { duration: 0.15, ease: outCubic })
    animate(chrome, 1, still ? { duration: 0 } : { duration: 0.15, ease: outCubic })
    sync()
  }

  const faceFrame = (at: number) => (at === index ? frame : (targets[at] ?? startOf(authors[at], seen)))
  const total = author.frames.length
  const likedNow = liked.has(keyOf(author, frame))
  const half = size.w / 2

  return (
    <div
      className={cn("absolute inset-0 touch-none select-none", closing && "pointer-events-none")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <h2 className="sr-only">{label}</h2>
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {`${author.name}, story ${frame + 1} of ${total}`}
      </p>
      <motion.div aria-hidden="true" className="absolute inset-0 bg-background will-change-[opacity]" style={{ opacity: shade }} />
      <div className="absolute inset-0 flex items-center justify-center">
        {/* The frame is laid out in CSS so the card's size and breakpoint stay in one place; the card is placed over it. */}
        <div ref={frameRef} className="relative shrink-0 max-sm:size-full sm:aspect-[9/16] sm:h-[min(calc(100dvh-48px),860px)]">
          <motion.div
            ref={cardRef}
            className="absolute inset-0 [--top:12px] max-sm:[--top:max(12px,env(safe-area-inset-top))] [--bottom:12px] max-sm:[--bottom:max(12px,env(safe-area-inset-bottom))] will-change-transform"
            style={{ x, y, scale, clipPath, opacity: reduced ? shade : 1 }}
          >
            {size.w ? (
              <div className="absolute inset-0" style={{ perspective: size.w * 4 }}>
                <motion.div className="absolute inset-0 [transform-style:preserve-3d]" style={reduced ? undefined : { rotateY: cube, z: -half }}>
                  {authors.map((item, at) => {
                    if (Math.abs(at - index) > 1) return null
                    const active = at === index
                    return (
                      <div
                        key={item.id}
                        className="absolute inset-0 [backface-visibility:hidden]"
                        style={reduced ? undefined : { transform: `rotateY(${at * 90}deg) translateZ(${half}px)` }}
                      >
                        <Face
                          author={item}
                          at={at}
                          frame={faceFrame(at)}
                          active={active}
                          pos={pos}
                          progress={progress}
                          ui={ui}
                          radius={radius}
                          veil={reduced ? undefined : veil}
                          reduced={reduced}
                        />
                      </div>
                    )
                  })}
                </motion.div>
              </div>
            ) : null}
            <motion.div className="pointer-events-none absolute inset-0 will-change-[opacity]" style={{ opacity: buttons }}>
              <div className="absolute top-[calc(var(--top)+10px)] right-2 flex items-center">
                <button type="button" aria-label={paused ? "Play" : "Pause"} className={iconButton} onClick={togglePause}>
                  {paused ? <PlayIcon size={20} aria-hidden="true" className={iconShadow} /> : <PauseIcon size={20} aria-hidden="true" className={iconShadow} />}
                </button>
                <button type="button" aria-label="Close stories" data-stories-close="" className={iconButton} onClick={() => close()}>
                  <XIcon size={20} aria-hidden="true" className={iconShadow} />
                </button>
              </div>
              <div className="absolute right-2 bottom-(--bottom) flex items-center">
                <button
                  type="button"
                  aria-label={likedNow ? "Unlike" : "Like"}
                  aria-pressed={likedNow}
                  className={cn(iconButton, likedNow && "text-danger")}
                  onClick={toggleLike}
                >
                  <motion.span className="grid place-items-center" style={{ scale: pop }}>
                    <HeartIcon size={24} weight={likedNow ? "fill" : "regular"} aria-hidden="true" className={iconShadow} />
                  </motion.span>
                </button>
              </div>
            </motion.div>
          </motion.div>
          <motion.div className="pointer-events-none absolute inset-0 will-change-[opacity]" style={{ opacity: ui }}>
            <button
              type="button"
              aria-label="Previous author"
              disabled={index === 0}
              className={cn(navButton, "right-[calc(100%+16px)]")}
              onClick={() => goAuthor(index - 1, authors[index - 1]?.frames.length - 1)}
            >
              <CaretLeftIcon size={18} aria-hidden="true" />
            </button>
            <button type="button" aria-label="Next author" disabled={index === last} className={cn(navButton, "left-[calc(100%+16px)]")} onClick={() => goAuthor(index + 1)}>
              <CaretRightIcon size={18} aria-hidden="true" />
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

/** One face of the cube: a frame, the progress bars and the author's header over it. Only the current face is interactive. */
function Face({
  author,
  at,
  frame,
  active,
  pos,
  progress,
  ui,
  radius,
  veil,
  reduced,
}: {
  author: StoryAuthor
  at: number
  frame: number
  active: boolean
  pos: MotionValue<number>
  progress: MotionValue<number>
  ui: MotionValue<number>
  radius: MotionValue<number>
  /** The avatar laid over the first frames of the flight, fading out as the card opens. */
  veil?: MotionValue<number>
  reduced: boolean
}) {
  const turn = useTransform(pos, value => clamp(Math.abs(at - value), 0, 1) * TURN_SHADE)
  const cross = useTransform(pos, value => (reduced ? clamp(1 - Math.abs(at - value), 0, 1) : 1))
  const shown = author.frames[frame]
  return (
    <motion.div
      aria-hidden={active ? undefined : true}
      inert={!active}
      className="absolute inset-0 overflow-hidden bg-surface-muted text-white"
      style={{ borderRadius: radius, opacity: cross }}
    >
      {/* One compositing layer for the photos: the face's radius changes every frame of a flight or a drag, and would otherwise re-raster them. */}
      <div className="absolute inset-0 will-change-transform">
        {/* The next frame loads hidden, so advancing swaps to a photo that is already there. */}
        {[frame, frame + 1].map(at => {
          const item = author.frames[at]
          if (!item || (at !== frame && !active)) return null
          return (
            <Image
              key={at}
              src={item.src}
              alt={active && at === frame ? item.alt : ""}
              aria-hidden={at === frame ? undefined : true}
              fill
              sizes="(min-width: 640px) 484px, 100vw"
              loading="eager"
              className={cn("object-cover", at !== frame && "opacity-0")}
              draggable={false}
            />
          )
        })}
        {active && veil ? (
          <motion.div aria-hidden="true" className="absolute inset-0 will-change-[opacity]" style={{ opacity: veil }}>
            <Image src={author.avatar} alt="" fill sizes="128px" className="object-cover" draggable={false} />
          </motion.div>
        ) : null}
      </div>
      <motion.div className="pointer-events-none absolute inset-0 will-change-[opacity]" style={{ opacity: ui }}>
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[oklch(0_0_0/0.5)] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[oklch(0_0_0/0.5)] to-transparent" />
        <div className="absolute inset-x-3 top-(--top) flex gap-1">
          {author.frames.map((_, bar) => (
            <div key={bar} className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-[oklch(1_0_0/0.35)]">
              <motion.div
                className="absolute inset-0 origin-left rounded-full bg-white will-change-transform"
                style={{ scaleX: bar < frame ? 1 : bar === frame && active ? progress : 0 }}
              />
            </div>
          ))}
        </div>
        <div className="absolute inset-x-3 top-[calc(var(--top)+10px)] flex h-10 items-center gap-2.5 pr-[88px]">
          <span className="relative block size-8 shrink-0 overflow-hidden rounded-full ring-1 ring-[oklch(1_0_0/0.85)]">
            <Image src={author.avatar} alt="" fill sizes="32px" className="object-cover" draggable={false} />
          </span>
          <span className="min-w-0 truncate text-sm leading-tight font-medium [text-shadow:0_1px_8px_oklch(0_0_0/0.35)]">{author.name}</span>
          {shown.time ? <span className="shrink-0 text-sm leading-tight text-[oklch(1_0_0/0.7)] [text-shadow:0_1px_8px_oklch(0_0_0/0.35)]">{shown.time}</span> : null}
        </div>
        {shown.caption ? (
          <p className="absolute inset-x-4 bottom-[calc(var(--bottom)+52px)] m-0 text-base leading-snug [text-shadow:0_1px_12px_oklch(0_0_0/0.4)] [text-wrap:pretty]">{shown.caption}</p>
        ) : null}
      </motion.div>
      {/* The face turning away darkens, so the edge between two faces reads as a corner. */}
      <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[oklch(0_0_0)] will-change-[opacity]" style={{ opacity: turn }} />
    </motion.div>
  )
}

/** 40px bare round icons over the photo. No focus ring: focus fills them like a hover does. */
const iconButton = [
  "pointer-events-auto grid size-10 cursor-pointer place-items-center rounded-pill text-white outline-none [-webkit-tap-highlight-color:transparent]",
  "transition-[background-color,color,transform,opacity] duration-160 ease-standard pointer-fine:hover:bg-[oklch(1_0_0/0.18)] focus-visible:bg-[oklch(1_0_0/0.18)] motion-reduce:transition-none",
].join(" ")
const iconShadow = "drop-shadow-[0_1px_4px_oklch(0_0_0/0.4)]"
/** 44px raised arrows beside the card. They vanish at the ends and below 640px, where swiping navigates. */
const navButton = [
  "pointer-events-auto absolute top-1/2 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-pill bg-surface-raised text-foreground shadow-raised outline-none max-sm:hidden [-webkit-tap-highlight-color:transparent]",
  "transition-[background-color,transform,opacity] duration-160 ease-standard focus-visible:bg-surface-muted motion-reduce:transition-none",
  "disabled:pointer-events-none disabled:opacity-0",
].join(" ")

export default Stories
