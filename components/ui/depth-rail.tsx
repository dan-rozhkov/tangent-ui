"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react"
import { animate, motion, useMotionTemplate, useMotionValue, useTransform } from "motion/react"
import type { MotionValue, Transition } from "motion/react"

import { useMotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"
import { axisVelocity, clamp, rubberBand } from "@/lib/gesture"

export interface DepthRailItem {
  id: string
  name: string
  byline?: string
  stat?: string
  image: string
  /** object-position of the photo inside its frame. */
  imagePosition?: string
  /** Defaults to the name. */
  alt?: string
}

export interface DepthRailProps<T extends DepthRailItem = DepthRailItem> {
  /** Cards in order. Extra fields on your entries are passed back to renderInfo. */
  slides: T[]
  /** Accessible name of the carousel, such as "Albums on repeat". */
  label: string
  /** Controlled front card. Pair with onActiveChange. */
  active?: number
  /** Initial front card when uncontrolled. */
  defaultActive?: number
  /** Called when a different card settles in front, and while a drag passes over one. */
  onActiveChange?: (index: number) => void
  /** Replaces the caption under the rail. It changes with the front card. */
  renderInfo?: (item: T, index: number) => ReactNode
  /** Extra class on the root. */
  className?: string
}

/* ---------- rail geometry, in card widths ---------- */

/** Sideways spacing: to the first neighbor, then to the second, then between every further card. */
const STEP_NEAR = 0.8015
const STEP_MID = 0.3687
const STEP_FAR = 0.129
/** On a narrow stage the first neighbor never sits farther than this share of the stage width. */
const STEP_STAGE = 0.28
/** Depth: to the first neighbor, then per card until it stops receding at the third. */
const DEPTH_NEAR = 0.3807
const DEPTH_FAR = 0.1403
const DEPTH_STOP = 3
/** Side cards face the front card at this angle, fully turned one card away. */
const TURN = 45
/** The veil darkens a card with distance, the edge shades its far side. */
const VEIL_NEAR = 0.42
const VEIL_FAR = 0.16
const VEIL_MAX = 0.74
const EDGE = 0.45
/** Cards fade out between these distances and are hidden past the second. */
const FADE_FROM = 2
const FADE_TO = 2.7
/** Share of the card height mirrored under it. */
const REFLECTION = 0.15
/** Room under the card for its reflection and shadows, and the gap above it (`--dr-top`), in px. */
const STAGE_EXTRA = 50
const CARD_TOP = 12

/* ---------- gesture ---------- */

/** Pointer travel before the rail starts to follow, in px. Past it the rail moves 1:1 with the pointer. */
const SLOP = 6.7
/** Rubber band past the ends: iOS resistance constant, and the limit as a share of the card width. */
const RUBBER = 0.55
const RUBBER_LIMIT = 0.5
/** A release coasts this many seconds of its velocity before the card is chosen. */
const PROJECTION = 0.32
/** Release speed in px/s that always moves at least one card. */
const FLICK = 200
/** Reduced motion: a drag this long steps one card. */
const REDUCED_STEP = 40
/** Quiet time after the last wheel event before the rail settles. */
const WHEEL_IDLE = 90
/** Keys, clicks and ticks: critically damped, about 17 rad/s. */
const STEP_SPRING = { type: "spring", stiffness: 289, damping: 34, restDelta: 0.0005 } as const
/** Releases settle softer than a step and keep the throw's velocity, about 9 rad/s, critically damped. */
const RELEASE_STIFFNESS = 81
/** Caption items slide this far, in px, from the side the rail travels toward. */
const CAPTION_SHIFT = 18
/** Tick pitch and thumb width, in px. */
const TICK = 16
const THUMB = 12

/** iOS reciprocal resistance: the first pixels follow almost 1:1, and the band tends to `limit` however far you pull. */
const band = (overshoot: number, limit: number) => rubberBand(overshoot, limit, RUBBER)

/** Sideways spacings in px for a card width and stage width. Narrow stages squeeze every step by the same share. */
function steps(w: number, stage: number) {
  const near = Math.min(STEP_NEAR * w, STEP_STAGE * stage || STEP_NEAR * w)
  const squeeze = near / (STEP_NEAR * w || 1)
  return { near, mid: STEP_MID * w * squeeze, far: STEP_FAR * w * squeeze }
}

/* ---------- card ---------- */

interface CardProps {
  item: DepthRailItem
  index: number
  count: number
  front: boolean
  pos: MotionValue<number>
  width: MotionValue<number>
  stage: MotionValue<number>
  /** 1 under reduced motion. A motion value, so the first client render matches the server. */
  still: MotionValue<number>
  onSelect: (index: number) => void
}

function Card({ item, index, count, front, pos, width, stage, still, onSelect }: CardProps) {
  const offset = useTransform(() => index - pos.get())
  const x = useTransform(() => {
    const o = offset.get()
    const a = Math.abs(o)
    const s = steps(width.get(), stage.get())
    const along = a <= 1 ? a * s.near : a <= 2 ? s.near + (a - 1) * s.mid : s.near + s.mid + (a - 2) * s.far
    return Math.sign(o) * along
  })
  const z = useTransform(() => {
    const a = Math.abs(offset.get())
    const w = width.get()
    return a <= 1 ? -a * DEPTH_NEAR * w : -(DEPTH_NEAR + (Math.min(a, DEPTH_STOP) - 1) * DEPTH_FAR) * w
  })
  // Left cards turn right and right cards turn left, so every face looks at the front card. Full by one card away.
  const rotateY = useTransform(() => -clamp(offset.get(), -1, 1) * TURN * (1 - still.get()))
  const veil = useTransform(() => {
    const a = Math.abs(offset.get())
    return a <= 1 ? a * VEIL_NEAR : Math.min(VEIL_NEAR + (a - 1) * VEIL_FAR, VEIL_MAX)
  })
  const edge = useTransform(() => EDGE * Math.min(1, Math.abs(offset.get())))
  const reflection = useTransform(() => 1 - edge.get())
  const zIndex = useTransform(() => Math.round(100 - Math.abs(offset.get()) * 10))
  const opacity = useTransform(() => clamp(1 - (Math.abs(offset.get()) - FADE_FROM) / (FADE_TO - FADE_FROM), 0, 1))
  const visibility = useTransform(() => (Math.abs(offset.get()) >= FADE_TO ? "hidden" : "visible"))
  // The edge shade sits on the side turned away from the viewer.
  const edgeAngle = useTransform(() => (offset.get() > 0 ? 270 : 90))
  const edgeImage = useMotionTemplate`linear-gradient(${edgeAngle}deg, transparent 40%, oklch(0% 0 0 / .5))`

  return (
    <motion.div
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${count}: ${item.name}`}
      aria-hidden={front ? undefined : true}
      className={cn("absolute top-(--dr-top) left-1/2 ml-[calc(var(--dr-w)/-2)] h-(--dr-h) w-(--dr-w)", !front && "cursor-pointer")}
      style={{ x, z, rotateY, zIndex, opacity, visibility }}
      onClick={() => onSelect(index)}
    >
      {/* A soft ground shade around the card, then a tight contact shadow where it meets the floor. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[4%] left-[-3%] h-[98%] w-[106%] bg-[radial-gradient(closest-side,oklch(0%_0_0/.14),oklch(0%_0_0/.056)_55%,transparent)] dark:bg-[radial-gradient(closest-side,oklch(0%_0_0/.34),oklch(0%_0_0/.136)_55%,transparent)]"
      />
      {/* A quiet reflection on the floor: the bottom of the photo, mirrored and faded out. */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-full overflow-hidden rounded-t-(--dr-r) [mask-image:linear-gradient(oklch(0%_0_0/.28),transparent_88%)]"
        style={{ height: `${REFLECTION * 100}%`, opacity: reflection }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image}
          alt=""
          draggable={false}
          className="absolute inset-x-0 top-0 h-(--dr-h) w-full max-w-none -scale-y-100 object-cover"
          style={{ objectPosition: item.imagePosition }}
        />
      </motion.span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[calc(100%-8px)] left-[5%] h-4 w-[90%] bg-[radial-gradient(closest-side,oklch(0%_0_0/.2232),oklch(0%_0_0/.0781)_60%,transparent)] dark:bg-[radial-gradient(closest-side,oklch(0%_0_0/.4092),oklch(0%_0_0/.1432)_60%,transparent)]"
      />
      <span className="absolute inset-0 block overflow-hidden rounded-(--dr-r) bg-surface-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image}
          alt=""
          draggable={false}
          className="size-full object-cover"
          style={{ objectPosition: item.imagePosition }}
        />
        <motion.span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[oklch(0%_0_0/.62)] dark:bg-[oklch(0%_0_0/.9)]" style={{ opacity: veil }} />
        <motion.span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ opacity: edge, backgroundImage: edgeImage }} />
      </span>
    </motion.div>
  )
}

/* ---------- caption ---------- */

interface CaptionProps {
  index: number
  current: number
  still: boolean
  children: ReactNode
}

/** Every caption stays mounted in one cell; the current one is shown and the rest wait on the side they would come from. */
function Caption({ index, current, still, children }: CaptionProps) {
  const motionTokens = useMotionTokens()
  const shown = index === current
  const side = Math.sign(index - current)
  return (
    <motion.div
      aria-hidden={shown ? undefined : true}
      className="flex max-w-full min-w-0 flex-col items-center [grid-area:1/1]"
      initial={false}
      animate={{ opacity: shown ? 1 : 0, x: still ? 0 : side * CAPTION_SHIFT }}
      transition={still ? { duration: motionTokens.duration.fast } : STEP_SPRING}
    >
      {children}
    </motion.div>
  )
}

/* ---------- rail ---------- */

/**
 * A depth rail for browsing a short collection of images one at a time. The front card stands forward while the rest
 * recede to either side, turned toward it.
 */
export function DepthRail<T extends DepthRailItem>({
  slides,
  label,
  active,
  defaultActive = 0,
  onActiveChange,
  renderInfo,
  className,
}: DepthRailProps<T>) {
  const reduced = useReducedMotion() ?? false
  const count = slides.length
  const last = Math.max(count - 1, 0)

  /* ---------- active card ---------- */
  const [inner, setInner] = useState(() => clamp(defaultActive, 0, last))
  const current = clamp(active ?? inner, 0, last)

  const pos = useMotionValue(current)
  const width = useMotionValue(168)
  const stage = useMotionValue(0)
  const still = useMotionValue(0)
  useEffect(() => still.set(reduced ? 1 : 0), [reduced, still])
  const target = useRef(current)
  const running = useRef<ReturnType<typeof animate> | null>(null)
  const latest = useRef({ current, onActiveChange, controlled: active !== undefined })
  useLayoutEffect(() => {
    latest.current = { current, onActiveChange, controlled: active !== undefined }
  })

  const commit = useCallback((next: number) => {
    target.current = next
    if (next === latest.current.current) return
    latest.current.current = next
    if (!latest.current.controlled) setInner(next)
    latest.current.onActiveChange?.(next)
  }, [])

  /** Moves the rail to a card: a step spring, or a softer one that carries a release's velocity, or a jump. */
  const glide = useCallback(
    (next: number, velocity?: number) => {
      running.current?.stop()
      if (reduced) {
        pos.jump(next)
        return
      }
      const transition: Transition =
        velocity === undefined
          ? STEP_SPRING
          : { type: "spring", stiffness: RELEASE_STIFFNESS, damping: 2 * Math.sqrt(RELEASE_STIFFNESS), velocity, restDelta: 0.0005 }
      running.current = animate(pos, next, transition)
    },
    [pos, reduced],
  )

  const go = useCallback(
    (next: number, velocity?: number) => {
      const clamped = clamp(next, 0, last)
      commit(clamped)
      glide(clamped, velocity)
    },
    [commit, glide, last],
  )

  // A controlled active card that changes from outside moves the rail there.
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
    const node = stageRef.current
    if (!probe || !node) return
    const measure = () => {
      width.set(probe.offsetWidth)
      stage.set(node.offsetWidth)
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(probe)
    observer.observe(node)
    return () => observer.disconnect()
  }, [stage, width])

  /** px of travel per card: the spacing to the first neighbor, so a drag keeps the card under the pointer. */
  const pitch = () => steps(width.get(), stage.get()).near || 1
  /** Maps an unbounded rail position to the shown one, with the rubber band past either end. */
  const resist = (raw: number) => {
    const unit = pitch()
    const limit = width.get() * RUBBER_LIMIT
    if (raw < 0) return -band(-raw * unit, limit) / unit
    if (raw > last) return last + band((raw - last) * unit, limit) / unit
    return raw
  }

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
    // Pick the rail up where it is; a release that never passed the slop puts it back on its card.
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
        if (!reduced) go(target.current)
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
    const travel = dx - Math.sign(dx) * SLOP
    pos.set(resist(state.origin - travel / pitch()))
    // The front card follows the pointer, so listeners hear each card the drag passes over.
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
    const velocity = axisVelocity(state.samples, event.timeStamp, (sample) => sample.x, { window: 90, stale: 70 })
    const unit = -velocity / pitch()
    let next = Math.round(pos.get() + unit * PROJECTION)
    // A quick flick always moves at least one card, even when it would round back.
    if (Math.abs(velocity) > FLICK && next === state.from) next = state.from - Math.sign(velocity)
    go(next, unit)
  }

  /* ---------- sideways trackpad scroll ---------- */
  const goRef = useRef(go)
  const commitRef = useRef(commit)
  const resistRef = useRef(resist)
  const pitchRef = useRef(pitch)
  useLayoutEffect(() => {
    goRef.current = go
    commitRef.current = commit
    resistRef.current = resist
    pitchRef.current = pitch
  })
  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    let idle: number | undefined
    let samples: { t: number; x: number }[] = []
    let travelled = 0
    let stepped = false
    let start = 0
    let raw = 0
    const onWheel = (event: WheelEvent) => {
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.offsetWidth : 1
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
        raw = pos.get()
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
        raw += dx / pitchRef.current()
        const next = resistRef.current(raw)
        pos.set(next)
        samples.push({ t: event.timeStamp, x: next })
        if (samples.length > 12) samples.shift()
        commitRef.current(clamp(Math.round(next), 0, last))
      }
      idle = window.setTimeout(() => {
        interacting.current = false
        if (reduced) return
        // Settle on the card the swipe's momentum reaches.
        const newest = samples[samples.length - 1]
        const velocity = newest ? axisVelocity(samples, newest.t, (sample) => sample.x, { window: 100, stale: Infinity }) : 0
        goRef.current(Math.round(pos.get() + velocity * PROJECTION), velocity)
      }, WHEEL_IDLE)
    }
    node.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      node.removeEventListener("wheel", onWheel)
      window.clearTimeout(idle)
    }
  }, [last, pos, reduced])

  const select = useCallback(
    (next: number) => {
      if (justDragged.current || next === target.current) return
      go(next)
    },
    [go],
  )

  // The tick thumb rides the rail itself, so it slides on the same spring as the cards.
  const thumbX = useTransform(() => clamp(pos.get(), 0, last) * TICK + (TICK - THUMB) / 2)
  const announced = slides[current]

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className={cn(
        "@container grid w-full gap-4 select-none",
        // Card width from the container, a 4 by 5 height, and a radius that scales with the card.
        "[--dr-top:12px] [--dr-w:clamp(160px,31cqw,272px)] [--dr-h:calc(var(--dr-w)*1.25)] [--dr-r:calc(var(--dr-w)*0.085)]",
        className,
      )}
    >
      <div
        ref={stageRef}
        tabIndex={0}
        className="relative w-full cursor-grab touch-pan-y outline-none [-webkit-tap-highlight-color:transparent] [overflow:clip_visible]"
        style={{
          height: `calc(var(--dr-h) + ${STAGE_EXTRA}px)`,
          perspective: "calc(var(--dr-w) * 3.4)",
          // The eye sits level with the floor line, so the reflections read as lying on it.
          perspectiveOrigin: `50% calc(var(--dr-h) + ${CARD_TOP - 4}px)`,
        }}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
      >
        <div ref={probeRef} aria-hidden="true" className="pointer-events-none invisible absolute h-0 w-(--dr-w)" />
        {slides.map((entry, i) => (
          <Card
            key={entry.id}
            item={entry}
            index={i}
            count={count}
            front={i === current}
            pos={pos}
            width={width}
            stage={stage}
            still={still}
            onSelect={select}
          />
        ))}
      </div>

      <div className="grid justify-items-center gap-3">
        <div className="grid min-h-12 w-full justify-items-center overflow-hidden px-4 text-center">
          {slides.map((entry, i) => (
            <Caption key={entry.id} index={i} current={current} still={reduced}>
              {renderInfo ? (
                renderInfo(entry, i)
              ) : (
                <>
                  <p className="m-0 max-w-full truncate text-lg leading-[1.3] font-medium">{entry.name}</p>
                  {entry.byline || entry.stat ? (
                    <p className="m-0 max-w-full truncate text-sm leading-[1.4] text-text-secondary">
                      {[entry.byline, entry.stat].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </>
              )}
            </Caption>
          ))}
        </div>

        {count > 1 ? (
          <div aria-label={`${label} position`} className="relative flex items-center">
            {slides.map((entry, i) => (
              <button
                key={entry.id}
                type="button"
                tabIndex={-1}
                aria-label={`Show ${entry.name}`}
                aria-current={i === current ? "true" : undefined}
                className="group grid h-6 w-4 cursor-pointer place-items-center border-0 bg-transparent p-0 outline-none"
                onClick={() => go(i)}
              >
                <span className="block size-1 rounded-pill bg-border-strong transition-colors duration-240 ease-standard group-hover:bg-text-muted motion-reduce:transition-none" />
              </button>
            ))}
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute top-[9.5px] left-0 h-[5px] w-3 rounded-pill bg-foreground"
              style={{ x: thumbX }}
            />
          </div>
        ) : null}
      </div>

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announced ? `${announced.name}, ${current + 1} of ${count}` : ""}
      </p>
    </section>
  )
}

export default DepthRail
