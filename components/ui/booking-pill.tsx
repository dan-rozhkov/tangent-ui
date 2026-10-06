"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react"
import { AnimatePresence, animate, motion, useIsPresent, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react"
import type { Variants } from "motion/react"
import { ArrowLeft, ArrowRight, CalendarDays, Check, Minus, Plus, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { motionTokens as staticTokens } from "@/lib/motion-tokens"
import { useMotionTokens, type MotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"

export interface Booking {
  date: string
  time: string
  partySize: number
}

export type BookingStep = "start" | "party" | "date" | "time" | "review" | "booked"

export interface BookingPillProps {
  /** Venue name printed on the ticket. */
  venue: string
  /** Second ticket line, such as the address. */
  venueDetail?: string
  /** First day on the strip as an ISO date. Pass it from data so server and client agree. */
  startDate: string
  /** Days on the strip. */
  days?: number
  /** Seating times as "HH:MM", in order. */
  times?: string[]
  /** Whether a time is free. Everything is free by default. */
  isAvailable?: (date: string, time: string, partySize: number) => boolean
  /** Preselected when free, otherwise the nearest free time. */
  preferredTime?: string
  minPartySize?: number
  maxPartySize?: number
  defaultPartySize?: number
  /** Resolve to show the booked state, reject to keep the ticket open with an error. */
  onConfirm?: (booking: Booking) => Promise<void> | void
  onStepChange?: (step: BookingStep) => void
  /** Clock used for displayed times. Data always uses "HH:MM". */
  hourCycle?: 12 | 24
  /** Label of the closed pill. */
  label?: string
  className?: string
}

const DEFAULT_TIMES = Array.from({ length: 12 }, (_, i) => {
  const minutes = 17 * 60 + i * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
})
const ORDER: BookingStep[] = ["start", "party", "date", "time", "review", "booked"]
const CELL = 52
/** The selected day's window inside the 60px strip: a 48px rounded square in the centre cell. */
const LENS_CLIP = `inset(6px calc(50% - ${(CELL - 4) / 2}px) round 14px)`
const enter = [...staticTokens.ease.enter] as [number, number, number, number]
const standard = [...staticTokens.ease.standard] as [number, number, number, number]

/* Dates are handled in UTC so the server and the client print the same strip. */
function addDays(iso: string, offset: number) {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}
const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options })
const weekdayShort = fmt({ weekday: "short" })
const monthShort = fmt({ month: "short" })
const dayNumber = fmt({ day: "numeric" })
const spoken = fmt({ weekday: "long", month: "long", day: "numeric" })
const ticketDate = fmt({ weekday: "short", month: "short", day: "numeric" })
const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`)

function formatTime(time: string, cycle: 12 | 24) {
  const [h, m] = time.split(":").map(Number)
  if (cycle === 24) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
}

function RollingNumber({ value, reduced }: { value: number; reduced: boolean }) {
  const motionTokens = useMotionTokens()
  const [state, setState] = useState({ value, direction: 1 })
  if (state.value !== value) setState({ value, direction: value > state.value ? 1 : -1 })
  const digits = String(value).split("")
  const variants: Variants = {
    from: (direction: number) => (reduced ? { opacity: 0 } : { y: direction > 0 ? "100%" : "-100%", opacity: 0 }),
    at: { y: 0, opacity: 1 },
    to: (direction: number) => (reduced ? { opacity: 0 } : { y: direction > 0 ? "-100%" : "100%", opacity: 0 }),
  }
  return (
    <span className="inline-flex tabular-nums">
      {digits.map((digit, index) => (
        <span key={digits.length - index} className="relative inline-grid overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout" custom={state.direction}>
            <motion.span
              key={digit}
              custom={state.direction}
              variants={variants}
              initial="from"
              animate="at"
              exit="to"
              transition={reduced ? { duration: motionTokens.duration.instant } : motionTokens.spring.snappy}
            >
              {digit}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  )
}

const roundButton = cn(
  "grid size-11 flex-none cursor-pointer place-items-center rounded-pill border-0 outline-none [-webkit-tap-highlight-color:transparent] [&_svg]:size-5",
  "transition-[background,color,opacity] duration-160 ease-standard motion-reduce:transition-none",
  "disabled:cursor-not-allowed disabled:opacity-40",
)
/** Back and other secondary round buttons sit on --surface-muted; the step forward is filled with the accent. */
const quiet = cn(roundButton, "bg-surface-muted text-foreground pointer-fine:hover:not-disabled:bg-control-track")
const loud = cn(roundButton, "bg-accent text-accent-foreground pointer-fine:hover:not-disabled:opacity-90")
/** The counter's own steppers are a size smaller and sit flush in their group. */
const stepper = cn(roundButton, "size-9 bg-transparent text-foreground pointer-fine:hover:not-disabled:bg-surface-muted")
const wideButton = cn(
  "flex h-11 cursor-pointer items-center justify-center rounded-pill border-0 px-4 text-sm font-medium whitespace-nowrap outline-none [-webkit-tap-highlight-color:transparent]",
  "transition-[background,color,opacity] duration-160 ease-standard motion-reduce:transition-none",
  "disabled:cursor-not-allowed disabled:opacity-40",
)

/** Faces slide a beat after the shape starts to change, in the direction of travel. */
const buildFaceVariants = (motionTokens: MotionTokens): { faceVariants: Variants; fadeVariants: Variants } => ({
  faceVariants: {
    enter: (direction: number) => ({ opacity: 0, x: direction * 28, filter: `blur(${motionTokens.blur.soft}px)` }),
    center: {
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: { ...motionTokens.spring.smooth, delay: 0.07, opacity: { duration: motionTokens.duration.standard, ease: enter, delay: 0.07 } },
    },
    exit: (direction: number) => ({
      opacity: 0,
      x: direction * -20,
      filter: `blur(${motionTokens.blur.subtle}px)`,
      transition: { duration: motionTokens.duration.fast, ease: standard },
    }),
  },
  fadeVariants: {
    enter: { opacity: 0 },
    center: { opacity: 1, transition: { duration: motionTokens.duration.fast } },
    exit: { opacity: 0, transition: { duration: motionTokens.duration.instant } },
  },
})

/**
 * A face is laid out at its natural size, centered on the pill's bottom edge, and reports that size for the shape spring.
 * Until the shell has a measured size the face sits in flow, so the shell (and the server render) takes the face's size.
 */
function Face({
  cap,
  inFlow,
  reduced,
  direction,
  focusOnMount,
  onSize,
  children,
}: {
  cap: number | null
  inFlow: boolean
  focusOnMount: boolean
  reduced: boolean
  direction: number
  onSize: (size: { width: number; height: number }) => void
  children: ReactNode
}) {
  const present = useIsPresent()
  const motionTokens = useMotionTokens()
  const { faceVariants, fadeVariants } = useMemo(() => buildFaceVariants(motionTokens), [motionTokens])
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node || !present) return
    const measure = () => onSize({ width: node.offsetWidth, height: node.offsetHeight })
    // Measured before paint as well, so the shell never shows a frame without its size.
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    // Focus follows the step into the new face, but never on first load.
    if (focusOnMount) node.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true })
    return () => observer.disconnect()
  }, [focusOnMount, onSize, present])
  return (
    <motion.div
      ref={ref}
      custom={direction}
      variants={reduced ? fadeVariants : faceVariants}
      initial="enter"
      animate="center"
      exit="exit"
      aria-hidden={present ? undefined : true}
      inert={!present}
      className={cn("w-max", inFlow ? "relative" : "absolute bottom-0 left-1/2 -translate-x-1/2")}
      style={cap ? { width: `min(calc(100cqw - 24px), ${cap}px)` } : { maxWidth: "calc(100cqw - 24px)" }}
    >
      {children}
    </motion.div>
  )
}

/* ---------- date strip ---------- */

function DateStrip({
  dates,
  index,
  onIndexChange,
  onCommit,
  reduced,
}: {
  dates: string[]
  index: number
  onIndexChange: (index: number) => void
  onCommit: () => void
  reduced: boolean
}) {
  const motionTokens = useMotionTokens()
  const viewport = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const x = useMotionValue(0)
  const drag = useRef<{ id: number; start: number; origin: number; moved: boolean; samples: { x: number; t: number }[] } | null>(null)
  const xFor = useCallback((i: number) => width / 2 - (i * CELL + CELL / 2), [width])
  const last = dates.length - 1

  useLayoutEffect(() => {
    const node = viewport.current
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // The strip rests on the chosen day; keyboard and taps glide there, a resize jumps.
  const placedWidth = useRef(0)
  const gliding = useRef(false)
  useEffect(() => {
    if (!width || drag.current) return
    if (gliding.current) {
      // A released flick already glides to this day with its own velocity.
      gliding.current = false
      return
    }
    if (placedWidth.current !== width || reduced) {
      placedWidth.current = width
      x.jump(xFor(index))
      return
    }
    const controls = animate(x, xFor(index), motionTokens.spring.snappy)
    return () => controls.stop()
  }, [index, motionTokens.spring.snappy, reduced, width, x, xFor])

  // While dragging, the day under the window becomes the value, so the spoken value follows the finger.
  useMotionValueEvent(x, "change", (latest) => {
    if (!drag.current?.moved || !width) return
    const nearest = Math.min(last, Math.max(0, Math.round((width / 2 - latest - CELL / 2) / CELL)))
    if (nearest !== index) onIndexChange(nearest)
  })

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    x.stop()
    drag.current = { id: event.pointerId, start: event.clientX, origin: x.get(), moved: false, samples: [{ x: event.clientX, t: event.timeStamp }] }
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    const dx = event.clientX - state.start
    if (!state.moved) {
      if (Math.abs(dx) < 4) return
      state.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    state.samples.push({ x: event.clientX, t: event.timeStamp })
    if (state.samples.length > 6) state.samples.shift()
    // 1:1 inside the strip, rubber-banding past either end.
    const min = xFor(last)
    const max = xFor(0)
    let next = state.origin + dx
    if (next > max) next = max + (next - max) * 0.3
    if (next < min) next = min - (min - next) * 0.3
    x.jump(next)
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    drag.current = null
    if (!state.moved) {
      // The press stopped any glide; a press that never became a drag (a tap, or a touch the page took for a scroll) lets
      // the strip finish on its day. A tap on another day moves on from here.
      if (x.get() !== xFor(index)) {
        if (reduced) x.jump(xFor(index))
        else animate(x, xFor(index), motionTokens.spring.snappy)
      }
      return
    }
    const first = state.samples[0]
    const end = state.samples[state.samples.length - 1]
    const velocity = (end.x - first.x) / (Math.max(1, end.t - first.t) / 1000)
    // A flick glides on: project where the momentum would carry the strip and land on that day.
    const projected = x.get() + (reduced ? 0 : velocity * 0.22)
    const target = Math.min(last, Math.max(0, Math.round((width / 2 - projected - CELL / 2) / CELL)))
    gliding.current = target !== index
    onIndexChange(target)
    if (reduced) x.jump(xFor(target))
    else animate(x, xFor(target), { ...motionTokens.spring.smooth, velocity })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowUp: index + 1,
      ArrowLeft: index - 1,
      ArrowDown: index - 1,
      PageDown: index + 7,
      PageUp: index - 7,
      Home: 0,
      End: last,
    }
    if (event.key === "Enter") {
      event.preventDefault()
      onCommit()
      return
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    onIndexChange(Math.min(last, Math.max(0, moves[event.key])))
  }

  const renderTrack = (lens: boolean) => (
    <motion.div className="absolute inset-y-0 left-0 flex" style={{ x }} aria-hidden="true">
      {dates.map((date, i) => {
        const day = asDate(date)
        return (
          <span
            key={date}
            className={cn(
              "grid h-full flex-none place-content-center justify-items-center gap-1 text-center",
              lens ? "text-accent-foreground" : "text-text-secondary",
            )}
            style={{ width: CELL }}
            onClick={
              lens
                ? undefined
                : () => {
                    if (!drag.current) onIndexChange(i)
                  }
            }
          >
            <span className="text-[11px] leading-none">{i === 0 || day.getUTCDate() === 1 ? monthShort.format(day) : weekdayShort.format(day)}</span>
            <span className="text-base leading-none font-medium tabular-nums">{dayNumber.format(day)}</span>
          </span>
        )
      })}
    </motion.div>
  )

  return (
    <div
      ref={viewport}
      role="slider"
      tabIndex={0}
      data-autofocus
      aria-label="Date"
      aria-valuemin={0}
      aria-valuemax={last}
      aria-valuenow={index}
      aria-valuetext={spoken.format(asDate(dates[index]))}
      className="relative h-[60px] cursor-grab overflow-hidden rounded-[20px] bg-surface-muted outline-none select-none [touch-action:pan-y] active:cursor-grabbing"
      style={{
        WebkitMaskImage: "linear-gradient(to right, transparent, #000 18%, #000 82%, transparent)",
        maskImage: "linear-gradient(to right, transparent, #000 18%, #000 82%, transparent)",
      }}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {renderTrack(false)}
      {/* The lens: an accent layer over the whole strip with an inverted copy of the days, clipped to the centre cell, so a
          day changes colour exactly as it passes under it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-accent"
        style={{ clipPath: LENS_CLIP, WebkitClipPath: LENS_CLIP }}
      >
        {renderTrack(true)}
      </div>
    </div>
  )
}

/* ---------- time grid ---------- */

function TimeGrid({
  times,
  free,
  value,
  onChange,
  hourCycle,
}: {
  times: string[]
  free: (time: string) => boolean
  value: string | null
  onChange: (time: string) => void
  hourCycle: 12 | 24
}) {
  const nodes = useRef(new Map<string, HTMLButtonElement>())
  const freeIndexes = times.map((time, i) => (free(time) ? i : -1)).filter((i) => i >= 0)
  const stop = value && free(value) ? value : (times[freeIndexes[0]] ?? null)

  const select = (index: number) => {
    const time = times[index]
    if (!time) return
    onChange(time)
    nodes.current.get(time)?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const seek = (from: number, step: number) => {
      for (let i = from + step; i >= 0 && i < times.length; i += step) if (free(times[i])) return i
      return -1
    }
    let next = -1
    if (event.key === "ArrowRight") next = seek(index, 1)
    else if (event.key === "ArrowLeft") next = seek(index, -1)
    else if (event.key === "ArrowDown") next = seek(index, 4)
    else if (event.key === "ArrowUp") next = seek(index, -4)
    else if (event.key === "Home") next = freeIndexes[0] ?? -1
    else if (event.key === "End") next = freeIndexes[freeIndexes.length - 1] ?? -1
    else return
    event.preventDefault()
    if (next >= 0) select(next)
  }

  return (
    <div role="radiogroup" aria-label="Time" className="grid grid-cols-4 gap-1.5">
      {times.map((time, index) => {
        const available = free(time)
        const checked = time === value
        return (
          <button
            key={time}
            ref={(node) => {
              if (node) nodes.current.set(time, node)
              else nodes.current.delete(time)
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={!available || undefined}
            tabIndex={time === stop ? 0 : -1}
            data-autofocus={time === stop ? "" : undefined}
            className={cn(
              "h-10 cursor-pointer rounded-[14px] border-0 bg-transparent text-sm font-medium tabular-nums whitespace-nowrap outline-none [-webkit-tap-highlight-color:transparent]",
              "transition-[background,color,box-shadow] duration-160 ease-standard motion-reduce:transition-none",
              checked
                ? "bg-accent text-accent-foreground"
                : available
                  ? "text-foreground shadow-[inset_0_0_0_1px_var(--border)] pointer-fine:hover:bg-surface-muted"
                  : "cursor-not-allowed text-text-muted shadow-[inset_0_0_0_1px_var(--border-subtle)]",
            )}
            onClick={() => available && onChange(time)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {formatTime(time, hourCycle)}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- pill ---------- */

const STEP_NAMES: Record<BookingStep, string> = {
  start: "",
  party: "Party size",
  date: "Choose a date",
  time: "Choose a time",
  review: "Review your booking",
  booked: "Table booked",
}
/** Fixed step widths (measured); party and booked size to their content (300 and ~244). */
const CAPS: Record<BookingStep, number | null> = { start: null, party: null, date: 420, time: 360, review: 340, booked: null }
/** The shape keeps one radius: a full pill at 52-60px tall, a rounded card when taller. */
const RADIUS = 30
/** Growing: morph timing with a little less bounce (~0.3% overshoot measured). Folding: critically damped, ~420ms. */
const buildShape = (motionTokens: MotionTokens) => ({
  grow: { ...motionTokens.spring.morph, bounce: 0.12 },
  fold: { ...motionTokens.spring.smooth, visualDuration: 0.3 },
})

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * One floating pill that reshapes itself through a booking flow. The surface springs to each step's measured size while the
 * faces inside slide in the direction of travel. Escape goes back one step.
 */
export function BookingPill({
  venue,
  venueDetail,
  startDate,
  days = 21,
  times = DEFAULT_TIMES,
  isAvailable,
  preferredTime = "19:30",
  minPartySize = 1,
  maxPartySize = 12,
  defaultPartySize = 2,
  onConfirm,
  onStepChange,
  hourCycle = 12,
  label = "Book a table",
  className,
}: BookingPillProps) {
  const reduced = useReducedMotion() ?? false
  const motionTokens = useMotionTokens()
  const { grow, fold } = useMemo(() => buildShape(motionTokens), [motionTokens])
  const [step, setStep] = useState<BookingStep>("start")
  const [moved, setMoved] = useState(false)
  const [direction, setDirection] = useState(1)
  const [party, setParty] = useState(() => Math.min(maxPartySize, Math.max(minPartySize, defaultPartySize)))
  const [dateIndex, setDateIndex] = useState(0)
  const [time, setTime] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /* The shell's size lives only in these motion values. They start at auto, so the first render (server included) sizes the
     shell from the in-flow face; the first measurement pins them, and later ones spring. */
  const width = useMotionValue<number | "auto">("auto")
  const height = useMotionValue<number | "auto">("auto")
  const size = useRef<{ width: number; height: number } | null>(null)
  const [measured, setMeasured] = useState(false)

  const dates = useMemo(() => Array.from({ length: Math.max(1, days) }, (_, i) => addDays(startDate, i)), [days, startDate])
  const date = dates[Math.min(dateIndex, dates.length - 1)]
  const free = useCallback((t: string) => (isAvailable ? isAvailable(date, t, party) : true), [date, isAvailable, party])

  const go = (next: BookingStep) => {
    setDirection(ORDER.indexOf(next) >= ORDER.indexOf(step) ? 1 : -1)
    setStep(next)
    setMoved(true)
    setError(null)
    onStepChange?.(next)
    if (next === "time") {
      // Keep a still-free choice; otherwise the preferred time, or the free time nearest to it.
      if (time && free(time)) return
      const preferred = Math.max(0, times.indexOf(preferredTime))
      const nearest = times
        .map((t, i) => ({ t, d: Math.abs(i - preferred) + (i < preferred ? 0.5 : 0) }))
        .filter(({ t }) => free(t))
        .sort((a, b) => a.d - b.d)[0]
      setTime(nearest?.t ?? null)
    }
  }

  const back = () => {
    const previous: Partial<Record<BookingStep, BookingStep>> = { party: "start", date: "party", time: "date", review: "time", booked: "start" }
    const target = previous[step]
    if (target && !submitting) go(target)
  }

  const confirm = async () => {
    if (!time || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await (onConfirm ? onConfirm({ date, time, partySize: party }) : wait(900))
      setSubmitting(false)
      go("booked")
    } catch {
      setSubmitting(false)
      setError("That table could not be booked. Try again or pick another time.")
    }
  }

  const onSize = useCallback(
    (next: { width: number; height: number }) => {
      // A hidden (display: none) parent measures 0x0; wait for a real size so the shell never locks to nothing.
      if (next.width <= 0 || next.height <= 0) return
      const current = size.current
      if (current && current.width === next.width && current.height === next.height) return
      size.current = next
      if (!current || reduced) {
        width.jump(next.width)
        height.jump(next.height)
        setMeasured(true)
        return
      }
      // Growing shapes use morph, folding ones the calmer smooth spring.
      const transition = next.width * next.height >= current.width * current.height ? grow : fold
      animate(width, next.width, transition)
      animate(height, next.height, transition)
    },
    [fold, grow, height, reduced, width],
  )

  const shortDate = ticketDate.format(asDate(date))
  const timeLabel = time ? formatTime(time, hourCycle) : null
  const when = `${shortDate}${timeLabel ? ` at ${timeLabel}` : ""}`
  const guests = `${party} ${party === 1 ? "guest" : "guests"}`
  const freeCount = times.filter(free).length
  const announcement =
    step === "booked" ? `Table for ${party} booked, ${when}` : step === "start" ? "" : STEP_NAMES[step]

  let face: ReactNode
  if (step === "start") {
    face = (
      <button
        type="button"
        data-autofocus
        className="flex h-[52px] cursor-pointer items-center gap-2 rounded-pill border-0 bg-transparent px-5 text-base font-medium whitespace-nowrap text-foreground outline-none [-webkit-tap-highlight-color:transparent]"
        onClick={() => go("party")}
      >
        <CalendarDays className="size-5" aria-hidden="true" />
        {label}
      </button>
    )
  } else if (step === "party") {
    face = (
      <div className="flex items-center gap-1.5 p-2">
        <button type="button" className={quiet} aria-label="Back" onClick={back}>
          <ArrowLeft />
        </button>
        <div role="group" aria-label="Party size" className="flex h-9 w-[184px] items-center gap-0.5 px-0.5">
          <button
            type="button"
            className={stepper}
            aria-label="Fewer guests"
            disabled={party <= minPartySize}
            onClick={() => setParty((n) => Math.max(minPartySize, n - 1))}
          >
            <Minus />
          </button>
          <output aria-live="polite" className="flex min-w-0 flex-1 justify-center gap-1 text-base whitespace-nowrap text-foreground">
            <RollingNumber value={party} reduced={reduced} />
            <span>{party === 1 ? "guest" : "guests"}</span>
          </output>
          <button
            type="button"
            className={stepper}
            aria-label="More guests"
            data-autofocus
            disabled={party >= maxPartySize}
            onClick={() => setParty((n) => Math.min(maxPartySize, n + 1))}
          >
            <Plus />
          </button>
        </div>
        <button type="button" className={loud} aria-label="Next, choose a date" onClick={() => go("date")}>
          <ArrowRight />
        </button>
      </div>
    )
  } else if (step === "date") {
    face = (
      <div className="grid gap-1 p-2">
        <div className="flex items-center gap-2">
          <button type="button" className={quiet} aria-label="Back to party size" onClick={back}>
            <ArrowLeft />
          </button>
          {/* The long date gives way to the short one when the title runs out of room. */}
          <div className="@container grid min-w-0 flex-1 text-center text-base font-medium whitespace-nowrap text-foreground">
            <span className="col-start-1 row-start-1 transition-opacity duration-160 ease-standard @max-[220px]:opacity-0 motion-reduce:transition-none">
              {spoken.format(asDate(date))}
            </span>
            <span
              aria-hidden="true"
              className="col-start-1 row-start-1 opacity-0 transition-opacity duration-160 ease-standard @max-[220px]:opacity-100 motion-reduce:transition-none"
            >
              {shortDate}
            </span>
          </div>
          <button type="button" className={loud} aria-label="Next, choose a time" onClick={() => go("time")}>
            <ArrowRight />
          </button>
        </div>
        <DateStrip dates={dates} index={dateIndex} onIndexChange={setDateIndex} onCommit={() => go("time")} reduced={reduced} />
      </div>
    )
  } else if (step === "time") {
    face = (
      <div className="grid gap-3 px-2.5 pt-2 pb-2.5">
        <div className="flex items-center gap-2">
          <button type="button" className={quiet} aria-label="Back to dates" onClick={back}>
            <ArrowLeft />
          </button>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-base font-medium text-foreground">{shortDate}</p>
            <p className="truncate text-sm text-text-secondary">
              {guests} · {freeCount} free
            </p>
          </div>
        </div>
        {freeCount ? (
          <TimeGrid times={times} free={free} value={time} onChange={setTime} hourCycle={hourCycle} />
        ) : (
          <p className="px-2 text-center text-sm text-text-secondary">No free tables this day. Go back and try another date.</p>
        )}
        <button
          type="button"
          className={cn(wideButton, "bg-accent text-accent-foreground pointer-fine:hover:not-disabled:opacity-90")}
          disabled={!time || !free(time)}
          onClick={() => go("review")}
        >
          Review booking
        </button>
      </div>
    )
  } else if (step === "review") {
    face = (
      <div className="grid">
        <div className="grid gap-4 px-[22px] pt-5 pb-[18px]">
          <div>
            <p className="text-[22px] leading-tight font-medium text-foreground">{venue}</p>
            {venueDetail ? <p className="text-sm text-text-secondary">{venueDetail}</p> : null}
          </div>
          <dl className="grid grid-cols-3 gap-3">
            <div>
              <dt className="text-xs text-text-muted">Date</dt>
              <dd className="text-base font-medium text-foreground">{shortDate}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Time</dt>
              <dd className="text-base font-medium text-foreground tabular-nums">{timeLabel ?? "None"}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Guests</dt>
              <dd className="text-base font-medium text-foreground tabular-nums">{party}</dd>
            </div>
          </dl>
        </div>
        {error ? (
          <p role="alert" className="px-[22px] pb-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex items-center gap-2 px-2 pb-2">
          <button
            type="button"
            className={cn(wideButton, "bg-surface-muted text-foreground pointer-fine:hover:not-disabled:bg-control-track")}
            onClick={back}
            disabled={submitting}
          >
            Change time
          </button>
          <Button
            className="h-11 flex-1 rounded-pill border-accent bg-accent text-accent-foreground"
            data-autofocus
            loading={submitting}
            onClick={confirm}
          >
            Confirm booking
          </Button>
        </div>
      </div>
    )
  } else {
    face = (
      <div className="flex h-14 items-center gap-3 pr-2.5 pl-3">
        <span className="grid size-8 flex-none place-items-center rounded-pill bg-success text-background [&_svg]:size-[18px]">
          <Check aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 leading-tight whitespace-nowrap">
          <p className="truncate text-sm font-medium text-foreground">Table for {party} booked</p>
          <p className="truncate text-xs text-text-secondary">{when}</p>
        </div>
        <button
          type="button"
          className={cn(stepper, "bg-surface-muted pointer-fine:hover:not-disabled:bg-control-track")}
          aria-label="Book another table"
          data-autofocus
          onClick={() => go("start")}
        >
          <RotateCcw />
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn("@container flex w-full justify-center", className)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && step !== "start") {
          event.preventDefault()
          back()
        }
      }}
    >
      {/* One shape with a constant 30px radius; the outer shadow rides along on the same box. */}
      <motion.div
        role="group"
        aria-label={label}
        className={cn(
          "relative overflow-hidden",
          "bg-[color-mix(in_oklab,var(--surface-raised)_80%,transparent)] backdrop-blur-[24px]",
          "shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--border-strong)_42%,transparent),var(--shadow-floating)]",
          "[@media(prefers-reduced-transparency:reduce)]:bg-surface-raised [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
        )}
        style={{ borderRadius: RADIUS, width, height }}
      >
        <AnimatePresence initial={false} custom={direction}>
          <Face key={step} cap={CAPS[step]} inFlow={!measured} reduced={reduced} direction={direction} focusOnMount={moved} onSize={onSize}>
            {face}
          </Face>
        </AnimatePresence>
      </motion.div>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}

export default BookingPill
