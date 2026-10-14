"use client"

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { KeyboardEvent, MouseEvent, PointerEvent } from "react"
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useSpring, useTransform } from "motion/react"
import type { AnimationPlaybackControls, MotionValue, Transition, Variants } from "motion/react"
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon } from "@phosphor-icons/react"

import { addDays, diffDays, startOfDay, useToday } from "@/lib/date"
import { axisVelocity, clamp, resistPast } from "@/lib/gesture"
import { motionTokens as staticTokens } from "@/lib/motion-tokens"
import { useMotionTokens } from "@/lib/motion-tokens-context"
import { useReducedMotion } from "@/lib/reduced-motion"
import { cn } from "@/lib/utils"

export interface DateScrubberProps {
  value?: Date
  defaultValue?: Date
  onValueChange?: (date: Date) => void
  /** The day the "+" rests on. Normalized to local midnight. */
  today?: Date
  /** Default: 120 days before today. */
  min?: Date
  /** Default: 120 days after today. */
  max?: Date
  /** The plus or the dated pill was pressed. */
  onAdd?: (date: Date) => void
  formatLabel?: (date: Date) => string
  /** Accessible name of the ruler. */
  label?: string
  className?: string
}

type Bezier = [number, number, number, number]
const enter = [...staticTokens.ease.enter] as Bezier
const standard = [...staticTokens.ease.standard] as Bezier

/** Pixels between two days. */
const SPACING = 9
const TICK_WIDTH = 2
const TICK_REST = 5
const TICK_MONTH = 9
const TICK_PEAK = 30
/** How many ticks each side of the pointer swell, as a gaussian sigma. */
const SIGMA = 2.4
const RULER_HEIGHT = 48
const ROW_HEIGHT = 40
const PLUS_SIZE = 40
const PLUS_RADIUS = 14
const PILL_RADIUS = ROW_HEIGHT / 2
const PILL_PAD = 32
const CHIP_GAP = 8
const OVERSCROLL = 0.35
const DEFAULT_RANGE = 120

/** Duration springs restated as stiffness and damping, so a retarget mid-flight keeps the velocity it already has. */
const physical = (visualDuration: number, bounce: number): Transition => {
  const root = (2 * Math.PI) / (visualDuration * 1.2)
  return { type: "spring", stiffness: root * root, damping: 2 * (1 - bounce) * root, mass: 1 }
}

/** How many days past the current one the tick window reaches toward a fast move's target. */
const LEAD = 48

const weekdayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short" })
const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })
const fullFormat = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
const defaultLabel = (date: Date) => `${weekdayFormat.format(date)} • ${dayFormat.format(date)}`

/** One day on the ruler: slides with the offset and swells where the pointer is. */
const Tick = memo(function Tick({ day, offset, bump, center, monthStart }: { day: number; offset: MotionValue<number>; bump: MotionValue<number>; center: number; monthStart: boolean }) {
  const base = monthStart ? TICK_MONTH : TICK_REST
  const x = useTransform(offset, o => center + (day - o) * SPACING - TICK_WIDTH / 2)
  const height = useTransform([offset, bump], ([o, b]: number[]) => {
    const z = (center + (day - o) * SPACING - b) / (SPACING * SIGMA)
    return base + (TICK_PEAK - base) * Math.exp(-0.5 * z * z)
  })
  const opacity = useTransform(height, [base, TICK_PEAK], [monthStart ? 0.45 : 0.28, 1])
  return <motion.span aria-hidden="true" className="absolute inset-y-0 left-0 my-auto rounded-full bg-foreground" style={{ x, height, opacity, width: TICK_WIDTH }} />
})

export function DateScrubber({ value, defaultValue, onValueChange, today: todayProp, min, max, onAdd, formatLabel = defaultLabel, label = "Date", className }: DateScrubberProps) {
  const reduced = useReducedMotion()
  const motionTokens = useMotionTokens()
  const { blur } = motionTokens
  const { GROW, FOLD } = useMemo(
    () => ({
      GROW: physical(motionTokens.spring.morph.visualDuration ?? 0.42, motionTokens.spring.morph.bounce ?? 0.16),
      FOLD: physical(motionTokens.spring.smooth.visualDuration ?? 0.4, motionTokens.spring.smooth.bounce ?? 0),
    }),
    [motionTokens],
  )

  // Without a `today` prop the day comes from the client clock; the server (and the hydration pass) see null, so a static build never bakes in its build date.
  const clientToday = useToday()
  const todayTime = todayProp ? startOfDay(todayProp).getTime() : (clientToday?.getTime() ?? null)
  const ready = todayTime !== null
  const today = useMemo(() => new Date(todayTime ?? 0), [todayTime])
  const minIndex = min ? Math.min(0, diffDays(startOfDay(min), today)) : -DEFAULT_RANGE
  const maxIndex = max ? Math.max(0, diffDays(startOfDay(max), today)) : DEFAULT_RANGE
  const dateAt = useCallback((index: number) => addDays(today, index), [today])
  const indexOf = useCallback((time: number) => clamp(diffDays(new Date(time), today), minIndex, maxIndex), [maxIndex, minIndex, today])

  /* The selection is a day (local midnight), not an offset from today, so a new `today` never shifts it. null means today. */
  const [selectedTime, setSelectedTime] = useState<number | null>(() => {
    const seed = value ?? defaultValue
    return seed ? startOfDay(seed).getTime() : null
  })
  const selectedRef = useRef(selectedTime)
  const index = ready && selectedTime !== null ? indexOf(selectedTime) : 0
  const [direction, setDirection] = useState(1)
  const indexRef = useRef(index)
  /** Where a keyboard or chip move is headed, so repeated presses stack instead of waiting for the spring. */
  const targetRef = useRef<number | null>(null)
  const controls = useRef<AnimationPlaybackControls | null>(null)
  /** The day index last reported through onValueChange (or adopted from the parent), so a repeated target is not reported twice. */
  const reported = useRef(index)
  /** A programmatic move is in flight: the target was reported when it started, so days passed on the way stay silent. */
  const programmatic = useRef(false)
  /** Something other than a drag is moving the ruler (inertia, a key, the chip, a reconcile). Incoming `value` waits until it lands. */
  const animating = useRef(false)
  /** Where the current move is headed, so the tick window can reach ahead of a fast spring. */
  const [leadTo, setLeadTo] = useState<number | null>(null)
  const settleRef = useRef<() => void>(() => {})

  /* The ruler: offset is the (fractional) day under the marker; bump is the x the ticks swell around. */
  const offset = useMotionValue(index)
  const [width, setWidth] = useState(0)
  const center = width / 2
  const bump = useSpring(0, motionTokens.spring.gentle)
  const rulerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const node = rulerRef.current
    if (!node) return
    const report = () => setWidth(node.offsetWidth)
    report()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(report)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const dragging = useRef(false)
  useLayoutEffect(() => {
    if (!dragging.current) bump.jump(center)
  }, [bump, center])

  // The ruler is measured from today, so when today (or the range) moves, re-seat it on the selected day.
  useLayoutEffect(() => {
    if (!ready) return
    const at = selectedRef.current === null ? 0 : indexOf(selectedRef.current)
    controls.current?.stop()
    targetRef.current = null
    animating.current = false
    programmatic.current = false
    indexRef.current = at
    reported.current = at
    offset.jump(at)
  }, [indexOf, offset, ready])

  useMotionValueEvent(offset, "change", latest => {
    if (!ready) return
    const next = clamp(Math.round(latest), minIndex, maxIndex)
    if (next === indexRef.current) return
    setDirection(next > indexRef.current ? 1 : -1)
    indexRef.current = next
    const date = dateAt(next)
    selectedRef.current = date.getTime()
    setSelectedTime(date.getTime())
    // A drag or fling reports every day it crosses; a programmatic move already reported its target.
    if (programmatic.current) return
    reported.current = next
    onValueChange?.(date)
  })

  /* A programmatic move (keys, the chip, reconciling with `value`): report the target once up front, then animate silently. */
  const goTo = useCallback(
    (to: number, report = true) => {
      const target = clamp(to, minIndex, maxIndex)
      targetRef.current = target
      controls.current?.stop()
      if (report && target !== reported.current) onValueChange?.(dateAt(target))
      reported.current = target
      programmatic.current = true
      animating.current = true
      if (reduced) {
        offset.jump(target)
        settleRef.current()
        return
      }
      setLeadTo(target)
      controls.current = animate(offset, target, { ...FOLD, onComplete: () => settleRef.current() })
    },
    [FOLD, dateAt, maxIndex, minIndex, offset, onValueChange, reduced],
  )

  const drag = useRef<{ pointerId: number; node: HTMLDivElement; x: number; offset: number; left: number; samples: { t: number; o: number }[] } | null>(null)

  /* While the user interacts the component is the source of truth and incoming `value` changes wait. When motion settles, or `value`
     changes while idle, a controlled value that differs from the landed day wins: the ruler glides there without reporting, so a
     parent that rejects a change pulls the ruler back. */
  const valueIdx = ready && value ? indexOf(startOfDay(value).getTime()) : null
  const valueIdxRef = useRef(valueIdx)
  const settle = () => {
    animating.current = false
    programmatic.current = false
    targetRef.current = null
    setLeadTo(null)
    if (drag.current) return
    const wanted = valueIdxRef.current
    if (wanted !== null && wanted !== indexRef.current) goTo(wanted, false)
  }
  useLayoutEffect(() => {
    valueIdxRef.current = valueIdx
    settleRef.current = settle
  })
  useEffect(() => {
    if (valueIdx === null || drag.current || animating.current || valueIdx === indexRef.current) return
    goTo(valueIdx, false)
  }, [goTo, valueIdx])

  // A value (or a range that shrank) outside [min, max] is shown clamped; tell the parent once so its state matches what is shown.
  const rawTime = value ? startOfDay(value).getTime() : null
  const clampNotified = useRef<string | null>(null)
  useEffect(() => {
    if (!ready) return
    const source = rawTime ?? selectedRef.current
    if (source === null) return
    const raw = diffDays(new Date(source), today)
    const clamped = clamp(raw, minIndex, maxIndex)
    if (raw === clamped) {
      clampNotified.current = null
      return
    }
    const key = `${source}|${clamped}`
    if (clampNotified.current === key) return
    clampNotified.current = key
    const date = dateAt(clamped)
    selectedRef.current = date.getTime()
    setSelectedTime(date.getTime())
    reported.current = clamped
    onValueChange?.(date)
  }, [dateAt, maxIndex, minIndex, onValueChange, rawTime, ready, today])

  /* Dragging: the ruler follows the finger one-to-one, then flicks with inertia and snaps to a whole day. */
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!ready || drag.current) return
    if (event.button !== 0 && event.pointerType === "mouse") return
    const node = event.currentTarget
    node.setPointerCapture(event.pointerId)
    controls.current?.stop()
    targetRef.current = null
    animating.current = false
    programmatic.current = false
    setLeadTo(null)
    dragging.current = true
    const left = node.getBoundingClientRect().left
    drag.current = { pointerId: event.pointerId, node, x: event.clientX, offset: offset.get(), left, samples: [{ t: event.timeStamp, o: offset.get() }] }
    if (!reduced) bump.set(event.clientX - left)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.pointerId !== event.pointerId) return
    const raw = state.offset - (event.clientX - state.x) / SPACING
    // Past either end the ruler gives, but only a fraction of the way.
    const edge = clamp(raw, minIndex, maxIndex)
    const next = edge + resistPast(raw - edge, 0, OVERSCROLL)
    offset.set(next)
    state.samples.push({ t: event.timeStamp, o: next })
    while (state.samples.length > 2 && event.timeStamp - state.samples[0].t > 100) state.samples.shift()
    if (!reduced) bump.set(event.clientX - state.left)
  }
  const release = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.pointerId !== event.pointerId) return
    drag.current = null
    dragging.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    bump.set(center)
    // A pause before letting go reads as 0, so only a throw that is still moving at release flings.
    const velocity = clamp(axisVelocity(state.samples, event.timeStamp, sample => sample.o), -60, 60)
    const snap = (target: number) => clamp(Math.round(target), minIndex, maxIndex)
    if (reduced) {
      offset.jump(snap(offset.get()))
      settle()
      return
    }
    animating.current = true
    const onComplete = () => settleRef.current()
    if (Math.abs(velocity) < 0.5) {
      controls.current = animate(offset, snap(offset.get()), { ...FOLD, onComplete })
      return
    }
    controls.current = animate(offset, offset.get(), {
      onComplete,
      type: "inertia",
      velocity,
      power: 0.9,
      timeConstant: 240,
      min: minIndex,
      max: maxIndex,
      bounceStiffness: 420,
      bounceDamping: 40,
      modifyTarget: target => {
        const landed = snap(target)
        setLeadTo(landed)
        return landed
      },
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!ready || event.ctrlKey || event.metaKey || event.altKey) return
    const base = targetRef.current ?? indexRef.current
    let next: number
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = base + 1
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = base - 1
    else if (event.key === "PageUp") next = base + 7
    else if (event.key === "PageDown") next = base - 7
    else if (event.key === "Home") next = minIndex
    else if (event.key === "End") next = maxIndex
    // Not part of the ARIA slider pattern: "t" jumps back to today, like the Today chip.
    else if (event.key === "t" || event.key === "T") next = 0
    else return
    event.preventDefault()
    goTo(next)
  }

  /* The action surface: one button whose width and radius follow the plus or the dated pill. */
  const isToday = !ready || index === 0
  const selected = dateAt(index)
  const text = isToday ? "" : formatLabel(selected)
  const surfaceWidth = useMotionValue<number>(PLUS_SIZE)
  const radius = useMotionValue(PLUS_RADIUS)
  const contentRef = useRef<HTMLSpanElement>(null)
  const shaped = useRef(false)
  const goal = useRef({ width: PLUS_SIZE, radius: PLUS_RADIUS })
  const shape = () => {
    const node = contentRef.current
    if (!node) return
    const w = isToday ? PLUS_SIZE : Math.ceil(node.offsetWidth) + PILL_PAD
    const r = isToday ? PLUS_RADIUS : PILL_RADIUS
    if (!shaped.current || reduced) {
      shaped.current = true
      goal.current = { width: w, radius: r }
      surfaceWidth.jump(w)
      radius.jump(r)
      return
    }
    // Growing into the pill carries the morph bounce, folding back to the plus never overshoots. A spring starts only for a target that actually changed.
    const spring = isToday ? FOLD : GROW
    if (w !== goal.current.width) {
      goal.current.width = w
      animate(surfaceWidth, w, spring)
    }
    if (r !== goal.current.radius) {
      goal.current.radius = r
      animate(radius, r, spring)
    }
  }
  const shapeRef = useRef(shape)
  useLayoutEffect(() => {
    shapeRef.current = shape
  })
  // The content changed: reshape now. The long-lived observer below catches size changes that come from elsewhere (fonts, container).
  useLayoutEffect(() => {
    shapeRef.current()
  }, [isToday, text])
  useLayoutEffect(() => {
    const node = contentRef.current
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => shapeRef.current())
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const contentVariants: Variants = useMemo(
    () => ({
      hidden: (dir: number) => (reduced ? { opacity: 0 } : { opacity: 0, y: dir * 8, scale: 0.9, filter: `blur(${blur.subtle}px)` }),
      shown: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: reduced ? { duration: motionTokens.duration.fast } : { y: motionTokens.spring.snappy, scale: motionTokens.spring.snappy, opacity: { duration: 0.18, ease: enter }, filter: { duration: 0.2, ease: enter } } },
      gone: (dir: number) => (reduced ? { opacity: 0, transition: { duration: motionTokens.duration.instant } } : { opacity: 0, y: dir * -8, scale: 0.9, filter: `blur(${blur.subtle}px)`, transition: { duration: 0.14, ease: standard } }),
    }),
    [blur.subtle, motionTokens, reduced],
  )

  // Chips sit either side of the surface, so they follow its animated width.
  const leftShift = useTransform(surfaceWidth, w => -(w / 2 + CHIP_GAP))
  const rightShift = useTransform(surfaceWidth, w => w / 2 + CHIP_GAP)
  const chipVariants = (side: -1 | 1): Variants => ({
    hidden: reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85, x: side * -10, filter: `blur(${blur.soft}px)` },
    shown: { opacity: 1, scale: 1, x: 0, filter: "blur(0px)", transition: reduced ? { duration: motionTokens.duration.fast } : { x: motionTokens.spring.snappy, scale: motionTokens.spring.snappy, opacity: { duration: 0.2, ease: enter }, filter: { duration: 0.2, ease: enter } } },
    gone: reduced ? { opacity: 0, transition: { duration: motionTokens.duration.instant } } : { opacity: 0, scale: 0.85, x: side * -6, filter: `blur(${blur.soft}px)`, transition: { duration: 0.14, ease: standard } },
  })
  // The chip unmounts once today is reached, which would drop focus to the body; keep it on the ruler instead.
  const returnToToday = (event: MouseEvent<HTMLButtonElement>) => {
    if (document.activeElement === event.currentTarget) rulerRef.current?.focus()
    goTo(0)
  }
  const chipClass = "flex h-8 cursor-pointer items-center gap-1 rounded-pill border border-border bg-surface-muted px-3 text-sm font-medium whitespace-nowrap text-foreground outline-none [-webkit-tap-highlight-color:transparent]"

  // Render only the ticks that can be on screen.
  const reach = Math.ceil(center / SPACING) + 3
  // The window leans toward where a fast move is headed (bounded by LEAD), so the leading edge is already drawn when the spring gets there.
  const ahead = leadTo === null ? 0 : clamp(leadTo - index, -LEAD, LEAD)
  const ticks: number[] = []
  if (ready && width > 0) for (let day = Math.max(minIndex, index - reach + Math.min(0, ahead)); day <= Math.min(maxIndex, index + reach + Math.max(0, ahead)); day++) ticks.push(day)
  const monthStarts = useMemo(() => {
    const starts = new Set<number>()
    if (!ready) return starts
    const first = dateAt(minIndex)
    let month = new Date(first.getFullYear(), first.getMonth() + (first.getDate() === 1 ? 0 : 1), 1)
    for (let at = diffDays(month, today); at <= maxIndex; month = new Date(month.getFullYear(), month.getMonth() + 1, 1), at = diffDays(month, today)) starts.add(at)
    return starts
  }, [dateAt, maxIndex, minIndex, ready, today])

  return (
    <div className={cn("flex w-full touch-manipulation flex-col items-center gap-2 select-none", className)}>
      <div className="relative w-full" style={{ height: ROW_HEIGHT }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.button
            type="button"
            aria-label={isToday ? "Add entry" : `Add entry for ${fullFormat.format(selected)}`}
            className={cn(
              "flex shrink-0 cursor-pointer items-center justify-center overflow-hidden border outline-none [-webkit-tap-highlight-color:transparent]",
              "transition-[background-color,border-color,color] duration-300 ease-standard motion-reduce:transition-none",
              isToday ? "border-border bg-surface-muted text-foreground" : "border-transparent bg-accent text-accent-foreground",
            )}
            style={{ width: surfaceWidth, height: ROW_HEIGHT, borderRadius: radius }}
            whileTap={reduced ? undefined : { scale: 0.95 }}
            transition={motionTokens.spring.snappy}
            onClick={() => ready && onAdd?.(selected)}
          >
            <span ref={contentRef} className="relative grid place-items-center text-sm font-medium whitespace-nowrap tabular-nums">
              <AnimatePresence initial={false} mode="popLayout" custom={direction}>
                {isToday ? (
                  <motion.span key="plus" custom={direction} variants={contentVariants} initial="hidden" animate="shown" exit="gone" className="grid size-6 place-items-center">
                    <PlusIcon size={20} />
                  </motion.span>
                ) : (
                  <motion.span key={text} custom={direction} variants={contentVariants} initial="hidden" animate="shown" exit="gone">
                    {text}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </motion.button>
        </div>
        <motion.div className="absolute top-0 left-1/2 flex items-center" style={{ height: ROW_HEIGHT, x: leftShift }}>
          <div className="-translate-x-full">
            <AnimatePresence initial={false}>
              {index > 0 && (
                <motion.button key="back" type="button" className={chipClass} variants={chipVariants(-1)} initial="hidden" animate="shown" exit="gone" onClick={returnToToday}>
                  <ArrowLeftIcon size={14} />
                  Today
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
        <motion.div className="absolute top-0 left-1/2 flex items-center" style={{ height: ROW_HEIGHT, x: rightShift }}>
          <AnimatePresence initial={false}>
            {index < 0 && (
              <motion.button key="forward" type="button" className={chipClass} variants={chipVariants(1)} initial="hidden" animate="shown" exit="gone" onClick={returnToToday}>
                Today
                <ArrowRightIcon size={14} />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      <div
        ref={rulerRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="horizontal"
        aria-valuemin={minIndex}
        aria-valuemax={maxIndex}
        aria-valuenow={index}
        aria-valuetext={ready ? fullFormat.format(selected) : undefined}
        className="relative w-full cursor-grab touch-pan-y overflow-hidden outline-none active:cursor-grabbing [mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)]"
        style={{ height: RULER_HEIGHT }}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
      >
        {ticks.map(day => (
          <Tick key={day} day={day} offset={offset} bump={bump} center={center} monthStart={monthStarts.has(day)} />
        ))}
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 my-auto h-9 w-[3px] -translate-x-1/2 rounded-full bg-accent" />
      </div>
    </div>
  )
}
