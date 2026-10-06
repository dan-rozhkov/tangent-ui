"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react"
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react"
import type { MotionValue, TargetAndTransition, Transition } from "motion/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

export interface CoverFlowItem {
  id: string
  title: string
  subtitle?: string
  meta?: string
  image: string
  /** object-position of the photo inside its frame. */
  imagePosition?: string
  /** Defaults to the title. */
  alt?: string
}

export interface CoverFlowProps<T extends CoverFlowItem = CoverFlowItem> {
  /** Cards in order. Extra fields on your items are passed back to renderCaption. */
  items: T[]
  /** Accessible name of the carousel, such as "Hikes for this fall". */
  label: string
  /** Controlled front card. Pair with onIndexChange. */
  index?: number
  /** Initial front card when uncontrolled. */
  defaultIndex?: number
  /** Called when a different card settles in front, and while a drag passes over one. */
  onIndexChange?: (index: number) => void
  /** Replaces the caption under the rail. It changes with the front card. */
  renderCaption?: (item: T, index: number) => ReactNode
  /** Extra class on the root. */
  className?: string
}

/* ---------- rail geometry, in card widths ---------- */

/** Distance from the front card to its neighbors, then between each further card. */
const NEAR = 0.66
const FAR = 0.25
/** How far each step recedes, how much it shrinks and dims, and how far it turns. */
const RECEDE = 0.3
const SHRINK = 0.07
const DIM = 0.2
const TURN = 46
/** The photo drifts inside its frame by this share of the card width per step. */
const DRIFT = 0.07
/** Cards past this distance are hidden. */
const VISIBLE = 4.5
/** Share of the card height mirrored under it. */
const REFLECTION = 0.34

/* ---------- gesture ---------- */

/** Pointer travel for one card under the finger, in card widths. */
const DRAG_STEP = 0.5
const SLOP = 5
/** A release coasts this many seconds of its velocity before the card is chosen. */
const PROJECTION = 0.28
/** Release speed in px/s that always moves at least one card. */
const FLICK = 380
/** Reduced motion: a drag this long steps one card. */
const REDUCED_STEP = 40
/** Quiet time after the last wheel event before the rail settles. */
const WHEEL_IDLE = 90

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Past the first and last card the rail resists like a rubber band, never more than a third of a card. */
const rubber = (value: number, max: number) =>
  value < 0 ? -(1 - 1 / (-value * 1.6 + 1)) * 0.35 : value > max ? max + (1 - 1 / ((value - max) * 1.6 + 1)) * 0.35 : value

function velocityOf(samples: { t: number; x: number }[], now: number) {
  const recent = samples.filter((sample) => now - sample.t <= 90)
  const first = recent[0]
  const last = recent[recent.length - 1]
  if (!first || !last || first === last || now - last.t > 70) return 0
  return (last.x - first.x) / ((last.t - first.t) / 1000)
}

/** The landing spring follows the release: a hard throw travels farther, so it gets a little longer and a hint of give. */
function landing(distance: number, velocity: number): Transition {
  return {
    type: "spring",
    visualDuration: clamp(0.34 + Math.abs(distance) * 0.07, 0.34, 0.75),
    bounce: Math.abs(velocity) > 6 ? 0.1 : 0,
    velocity,
  }
}

/* ---------- card ---------- */

interface CardProps {
  item: CoverFlowItem
  index: number
  count: number
  front: boolean
  pos: MotionValue<number>
  width: MotionValue<number>
  /** 1 under reduced motion. A motion value, so the first client render matches the server. */
  still: MotionValue<number>
  onSelect: (index: number) => void
}

function Card({ item, index, count, front, pos, width, still, onSelect }: CardProps) {
  const distance = useTransform(() => index - pos.get())
  const x = useTransform(() => {
    const d = distance.get()
    const a = Math.abs(d)
    return Math.sign(d) * (a < 1 ? a * NEAR : NEAR + (a - 1) * FAR) * width.get()
  })
  const z = useTransform(() => -Math.min(Math.abs(distance.get()), 3.5) * RECEDE * width.get())
  const scale = useTransform(() => 1 - Math.min(Math.abs(distance.get()), 3.5) * SHRINK)
  // Cards turn their faces toward the front card; the turn is full by one step away.
  const rotateY = useTransform(() => -clamp(distance.get(), -1, 1) * TURN * (1 - still.get()))
  const dim = useTransform(() => Math.min(Math.abs(distance.get()) * DIM, 0.62))
  const zIndex = useTransform(() => Math.round(100 - Math.abs(distance.get()) * 10))
  const visibility = useTransform(() => (Math.abs(distance.get()) > VISIBLE ? "hidden" : "visible"))
  // The photo slides against the direction of travel, so it seems to sit a little behind the glass of the frame.
  const drift = useTransform(() => clamp(distance.get(), -1.6, 1.6) * DRIFT * width.get() * (1 - still.get()))

  const photo = (mirrored: boolean) => (
    <motion.img
      src={item.image}
      alt=""
      draggable={false}
      className={cn("absolute top-0 left-[-12%] h-full w-[124%] max-w-none object-cover", mirrored && "-scale-y-100")}
      style={{ x: drift, objectPosition: item.imagePosition }}
    />
  )

  return (
    <motion.div
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${count}: ${item.title}`}
      aria-hidden={front ? undefined : true}
      className={cn("absolute top-0 left-1/2 ml-[calc(var(--cf-card)/-2)] size-(--cf-card)", !front && "cursor-pointer")}
      style={{ x, z, scale, rotateY, zIndex, visibility, transformStyle: "preserve-3d" }}
      onClick={() => onSelect(index)}
    >
      {/* Contact shadow: a dark, tight ellipse where the card meets the floor, and a softer one around it. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[6%] -bottom-3 h-6 rounded-[50%] bg-[radial-gradient(closest-side,oklch(0%_0_0/.38),transparent)] blur-[6px] dark:bg-[radial-gradient(closest-side,oklch(0%_0_0/.7),transparent)]"
      />
      <div className="relative size-full overflow-hidden rounded-panel bg-surface-muted shadow-[0_22px_40px_-22px_oklch(0%_0_0/.55),0_2px_6px_-2px_oklch(0%_0_0/.18)]">
        {photo(false)}
        {front ? <span className="sr-only">{item.alt ?? item.title}</span> : null}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-panel shadow-[inset_0_0_0_.5px_oklch(100%_0_0/.18)]" />
        <motion.span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: dim }} />
      </div>
      {/* A quiet reflection on the floor: the bottom of the photo, mirrored and faded out. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[calc(100%+3px)] overflow-hidden rounded-t-panel opacity-30 dark:opacity-25"
        style={{
          height: `${REFLECTION * 100}%`,
          maskImage: "linear-gradient(to bottom, oklch(0% 0 0 / .55), transparent 85%)",
          WebkitMaskImage: "linear-gradient(to bottom, oklch(0% 0 0 / .55), transparent 85%)",
        }}
      >
        <div className="absolute inset-x-0 top-0 h-(--cf-card)">{photo(true)}</div>
        <motion.span className="absolute inset-0 bg-black" style={{ opacity: dim }} />
      </div>
    </motion.div>
  )
}

/* ---------- rail ---------- */

/**
 * A depth rail for browsing a short collection of images one at a time. The front card stands forward while the rest
 * recede to either side, and each image drifts inside its frame as the rail moves.
 */
export function CoverFlow<T extends CoverFlowItem>({
  items,
  label,
  index,
  defaultIndex = 0,
  onIndexChange,
  renderCaption,
  className,
}: CoverFlowProps<T>) {
  const reduced = useReducedMotion() ?? false
  const count = items.length
  const last = Math.max(count - 1, 0)

  /* ---------- index ---------- */
  const [inner, setInner] = useState(() => clamp(defaultIndex, 0, last))
  const current = clamp(index ?? inner, 0, last)
  // The caption rises in from the side the rail travelled toward.
  const [shown, setShown] = useState({ index: current, direction: 0 })
  if (shown.index !== current) setShown({ index: current, direction: Math.sign(current - shown.index) })
  const [settled, setSettled] = useState(current)

  const pos = useMotionValue(current)
  const width = useMotionValue(240)
  const fade = useMotionValue(1)
  const still = useMotionValue(0)
  useEffect(() => still.set(reduced ? 1 : 0), [reduced, still])
  const target = useRef(current)
  const running = useRef<ReturnType<typeof animate> | null>(null)
  const latest = useRef({ current, onIndexChange, controlled: index !== undefined })
  useLayoutEffect(() => {
    latest.current = { current, onIndexChange, controlled: index !== undefined }
  })

  const commit = useCallback((next: number) => {
    target.current = next
    if (next === latest.current.current) return
    latest.current.current = next
    if (!latest.current.controlled) setInner(next)
    latest.current.onIndexChange?.(next)
  }, [])

  /** Moves the rail to a card: a spring that carries any release velocity, or a jump with a short fade. */
  const glide = useCallback(
    (next: number, velocity = 0) => {
      running.current?.stop()
      if (reduced) {
        pos.jump(next)
        if (next !== settled) {
          fade.jump(0.55)
          animate(fade, 1, { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] })
        }
      } else {
        running.current = animate(pos, next, landing(next - pos.get(), velocity))
      }
      setSettled(next)
    },
    [fade, pos, reduced, settled],
  )

  const go = useCallback(
    (next: number, velocity = 0) => {
      const clamped = clamp(next, 0, last)
      commit(clamped)
      glide(clamped, velocity)
    },
    [commit, glide, last],
  )

  // A controlled index that changes from outside moves the rail there.
  const interacting = useRef(false)
  useEffect(() => {
    if (interacting.current || target.current === current) return
    target.current = current
    glide(current)
  }, [current, glide])

  /* ---------- measure ---------- */
  const stageRef = useRef<HTMLDivElement>(null)
  const probeRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const probe = probeRef.current
    if (!probe) return
    width.set(probe.offsetWidth)
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => width.set(probe.offsetWidth))
    observer.observe(probe)
    return () => observer.disconnect()
  }, [width])

  /* ---------- keys ---------- */
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return
    let next: number | null = null
    if (event.key === "ArrowLeft") next = target.current - 1
    else if (event.key === "ArrowRight") next = target.current + 1
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = last
    if (next === null) return
    event.preventDefault()
    go(next)
  }

  /* ---------- drag and throw ---------- */
  const drag = useRef<{ id: number; startX: number; startY: number; origin: number; from: number; moved: boolean; samples: { t: number; x: number }[] } | null>(null)
  const justDragged = useRef(false)

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary || count < 2) return
    running.current?.stop()
    drag.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: pos.get(),
      from: target.current,
      moved: false,
      samples: [{ t: event.timeStamp, x: event.clientX }],
    }
  }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    const dx = event.clientX - state.startX
    if (!state.moved) {
      // Vertical swipes belong to the page.
      if (Math.abs(event.clientY - state.startY) > Math.abs(dx) && Math.abs(event.clientY - state.startY) > SLOP) {
        drag.current = null
        if (!reduced) go(Math.round(pos.get()))
        return
      }
      if (Math.abs(dx) < SLOP) return
      state.moved = true
      interacting.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    state.samples.push({ t: event.timeStamp, x: event.clientX })
    if (state.samples.length > 12) state.samples.shift()
    if (reduced) return
    pos.set(rubber(state.origin - dx / (width.get() * DRAG_STEP), last))
    // The front card follows the finger, so listeners hear each card the drag passes over.
    commit(clamp(Math.round(pos.get()), 0, last))
  }
  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    drag.current = null
    interacting.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (!state.moved) {
      if (!reduced && Math.abs(pos.get() - target.current) > 0.001) go(target.current)
      return
    }
    justDragged.current = true
    window.setTimeout(() => {
      justDragged.current = false
    }, 0)
    const dx = event.clientX - state.startX
    if (reduced) {
      if (Math.abs(dx) > REDUCED_STEP) go(state.from - Math.sign(dx))
      return
    }
    const velocity = velocityOf(state.samples, event.timeStamp)
    const unit = -velocity / (width.get() * DRAG_STEP)
    let next = Math.round(pos.get() + unit * PROJECTION)
    // A quick flick always moves at least one card, even when it would round back.
    if (Math.abs(velocity) > FLICK && next === state.from) next = state.from - Math.sign(velocity)
    go(next, unit)
  }

  /* ---------- sideways trackpad scroll ---------- */
  const goRef = useRef(go)
  const commitRef = useRef(commit)
  useLayoutEffect(() => {
    goRef.current = go
    commitRef.current = commit
  })
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    let idle: number | undefined
    let samples: { t: number; x: number }[] = []
    let travelled = 0
    let stepped = false
    let start = 0
    const onWheel = (event: WheelEvent) => {
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.offsetWidth : 1
      const dx = event.deltaX * unit
      const dy = event.deltaY * unit
      // Only sideways scrolls belong to the rail; vertical ones scroll the page.
      if (Math.abs(dx) <= Math.abs(dy) || drag.current) return
      event.preventDefault()
      window.clearTimeout(idle)
      if (!interacting.current) {
        interacting.current = true
        running.current?.stop()
        samples = []
        travelled = 0
        stepped = false
        start = target.current
      }
      travelled += dx
      if (reduced) {
        // One swipe steps one card, however long its momentum runs.
        if (!stepped && Math.abs(travelled) > 24) {
          stepped = true
          interacting.current = false
          goRef.current(start + Math.sign(travelled))
          interacting.current = true
        }
      } else {
        const next = rubber(pos.get() + dx / (width.get() * DRAG_STEP), last)
        pos.set(next)
        samples.push({ t: event.timeStamp, x: next })
        if (samples.length > 12) samples.shift()
        commitRef.current(clamp(Math.round(next), 0, last))
      }
      idle = window.setTimeout(() => {
        interacting.current = false
        if (reduced) return
        // Settle on the card the swipe's momentum reaches.
        const recent = samples.filter((sample) => samples[samples.length - 1].t - sample.t <= 100)
        const first = recent[0]
        const end = recent[recent.length - 1]
        const velocity = first && end && end.t > first.t ? (end.x - first.x) / ((end.t - first.t) / 1000) : 0
        goRef.current(Math.round(pos.get() + velocity * 0.12), velocity)
      }, WHEEL_IDLE)
    }
    stage.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      stage.removeEventListener("wheel", onWheel)
      window.clearTimeout(idle)
    }
  }, [last, pos, reduced, width])

  const select = useCallback(
    (next: number) => {
      if (justDragged.current || next === target.current) return
      go(next)
    },
    [go],
  )

  const item = items[shown.index]
  const announced = items[settled]
  const caption: { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition } = reduced
    ? {
        // Same keys as the full branch, so the first render matches the server whichever branch the client picks.
        initial: { opacity: 0, x: 0, y: 0, filter: "blur(0px)" },
        animate: { opacity: 1, x: 0, y: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.fast } },
        exit: { opacity: 0, transition: { duration: motionTokens.duration.instant } },
      }
    : {
        initial: { opacity: 0, x: shown.direction * 14, y: 6, filter: `blur(${motionTokens.blur.soft}px)` },
        animate: {
          opacity: 1,
          x: 0,
          y: 0,
          filter: "blur(0px)",
          transition: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] },
        },
        exit: {
          opacity: 0,
          x: shown.direction * -10,
          filter: `blur(${motionTokens.blur.subtle}px)`,
          transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.exit] },
        },
      }

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      className={cn("@container relative flex w-full flex-col items-center gap-3 outline-none select-none", "[--cf-card:clamp(168px,38cqw,272px)]", className)}
      onKeyDown={onKeyDown}
    >
      <div
        ref={stageRef}
        className="relative w-full cursor-grab touch-pan-y overflow-hidden [-webkit-tap-highlight-color:transparent] active:cursor-grabbing"
        style={{
          // The reflection fades out well before its end, so the stage only keeps the part that shows.
          height: `calc(var(--cf-card) * ${1 + REFLECTION * 0.6} + 24px)`,
          perspective: "calc(var(--cf-card) * 4.4)",
          // The far cards fade into the sides instead of being cut by the stage edge.
          maskImage: "linear-gradient(to right, transparent, #000 9%, #000 91%, transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, #000 9%, #000 91%, transparent)",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
      >
        <div ref={probeRef} aria-hidden="true" className="invisible absolute size-(--cf-card)" />
        <motion.div className="absolute inset-x-0 top-4 h-(--cf-card)" style={{ opacity: fade, transformStyle: "preserve-3d" }}>
          {items.map((entry, i) => (
            <Card
              key={entry.id}
              item={entry}
              index={i}
              count={count}
              front={i === current}
              pos={pos}
              width={width}
              still={still}
              onSelect={select}
            />
          ))}
        </motion.div>
      </div>

      <div className="relative grid min-h-12 w-full justify-items-center overflow-hidden px-4 text-center">
        <AnimatePresence initial={false} mode="popLayout">
          {item ? (
            <motion.div key={item.id} className="flex max-w-full flex-col items-center [grid-area:1/1]" {...caption}>
              {renderCaption ? (
                renderCaption(item, shown.index)
              ) : (
                <>
                  <span className="max-w-full truncate text-base leading-6 font-medium">{item.title}</span>
                  {item.subtitle || item.meta ? (
                    <span className="max-w-full truncate text-sm leading-5 text-text-secondary">
                      {[item.subtitle, item.meta].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {count > 1 ? (
        <div className="flex items-center">
          {items.map((entry, i) => (
            <button
              key={entry.id}
              type="button"
              tabIndex={-1}
              aria-label={`Show ${entry.title}`}
              aria-current={i === current ? "true" : undefined}
              className="group grid h-6 w-4 cursor-pointer place-items-center border-0 bg-transparent p-0 outline-none"
              onClick={() => go(i)}
            >
              <span
                className={cn(
                  "block h-1 rounded-pill transition-[width,background-color] duration-240 ease-standard motion-reduce:transition-none",
                  i === current ? "w-3 bg-foreground" : "w-1 bg-border-strong group-hover:bg-text-muted",
                )}
              />
            </button>
          ))}
        </div>
      ) : null}

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announced ? `${settled + 1} of ${count}: ${announced.title}` : ""}
      </div>
    </section>
  )
}

export default CoverFlow
