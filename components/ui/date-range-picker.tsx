"use client"

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import type { KeyboardEvent as ReactKeyboardEvent, CSSProperties, FocusEvent as ReactFocusEvent, ReactNode } from "react"
import { AnimatePresence, animate, motion, useIsPresent, useMotionValue, useTransform } from "motion/react"
import type { Transition, Variants } from "motion/react"
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

/** An inclusive range of whole days. */
export interface DateRange {
  start: Date
  end: Date
}

/** A shortcut in the preset rail. `range` receives the viewer's local today. */
export interface DateRangePreset {
  label: string
  range: (today: Date) => DateRange
}

/**
 * A range picker whose trigger grows into the panel it opens. The panel shows two months beside a preset rail, or one
 * month with a scrolling preset row when space is tight. The range highlight stretches across each week as you hover
 * or move with the keyboard, the ends glide between days, months slide in the direction you travel, and on Apply the
 * formatted label flies back into the trigger as the surface shrinks around it.
 * Use it for reports, filters, and bookings where a start and end date are chosen together.
 */
export interface DateRangePickerProps {
  /** Controlled value. Pass `null` for no selection. */
  value?: DateRange | null
  /** Uncontrolled starting value. */
  defaultValue?: DateRange | null
  /** Called with the applied range. */
  onChange?: (range: DateRange) => void
  /** Accessible name of the trigger and the dialog. Defaults to "Date range". */
  label?: string
  placeholder?: string
  presets?: DateRangePreset[]
  minDate?: Date
  maxDate?: Date
  /** 0 is Sunday, 1 is Monday. Defaults to 0. */
  weekStartsOn?: 0 | 1
  locale?: string
  /** Force one or two months. `auto` picks two when the boundary is wide enough. */
  months?: "auto" | 1 | 2
  /** The element the panel should stay inside. Defaults to the viewport. */
  boundary?: () => HTMLElement | null
  className?: string
}

type Size = { w: number; h: number }
type Bezier = [number, number, number, number]

const DAY = 864e5
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)
const monthEnd = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0)
const addDays = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
const addMonths = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth() + amount, 1)
const shiftMonths = (date: Date, amount: number) =>
  new Date(
    date.getFullYear(),
    date.getMonth() + amount,
    Math.min(date.getDate(), new Date(date.getFullYear(), date.getMonth() + amount + 1, 0).getDate()),
  )
const dayDiff = (a: Date, b: Date) => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY)
const monthDiff = (a: Date, b: Date) => (a.getFullYear() - b.getFullYear()) * 12 + a.getMonth() - b.getMonth()
const sameDay = (a?: Date | null, b?: Date | null) => Boolean(a && b && dayDiff(a, b) === 0)
const keyOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
const fromKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number)
  return new Date(year, month - 1, day)
}
const ordered = (a: Date, b: Date): DateRange => (dayDiff(a, b) <= 0 ? { start: a, end: b } : { start: b, end: a })
const sameRange = (a?: DateRange | null, b?: DateRange | null) =>
  Boolean(a && b && sameDay(a.start, b.start) && sameDay(a.end, b.end))
const clampDate = (date: Date, min?: Date, max?: Date) =>
  min && dayDiff(date, min) < 0 ? startOfDay(min) : max && dayDiff(date, max) > 0 ? startOfDay(max) : date

export const defaultDateRangePresets: DateRangePreset[] = [
  { label: "Today", range: (today) => ({ start: today, end: today }) },
  { label: "Yesterday", range: (today) => ({ start: addDays(today, -1), end: addDays(today, -1) }) },
  { label: "Last 7 days", range: (today) => ({ start: addDays(today, -6), end: today }) },
  { label: "Last 30 days", range: (today) => ({ start: addDays(today, -29), end: today }) },
  { label: "This month", range: (today) => ({ start: monthStart(today), end: today }) },
  { label: "Last month", range: (today) => ({ start: addMonths(today, -1), end: monthEnd(addMonths(today, -1)) }) },
  {
    label: "This quarter",
    range: (today) => ({ start: new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1), end: today }),
  },
  { label: "Year to date", range: (today) => ({ start: new Date(today.getFullYear(), 0, 1), end: today }) },
]

/** Today turns over at local midnight; returning to the tab reads it again. Empty on the server so markup never depends on its clock. */
const subscribeToday = (notify: () => void) => {
  let timer = 0
  const schedule = () => {
    const now = new Date()
    timer = window.setTimeout(
      () => {
        notify()
        schedule()
      },
      addDays(now, 1).getTime() - now.getTime() + 1000,
    )
  }
  const onVisible = () => {
    if (document.visibilityState === "visible") notify()
  }
  schedule()
  document.addEventListener("visibilitychange", onVisible)
  return () => {
    window.clearTimeout(timer)
    document.removeEventListener("visibilitychange", onVisible)
  }
}
const readToday = () => keyOf(new Date())
const serverToday = () => ""
/** The viewer's local date, or undefined during server render and hydration. */
export function useToday() {
  const key = useSyncExternalStore(subscribeToday, readToday, serverToday)
  return useMemo(() => (key ? fromKey(key) : undefined), [key])
}

const noop = () => () => {}
function useReducedFlag() {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )
  return !!useReducedMotion() && hydrated
}

const { blur } = motionTokens
const enterEase = [...motionTokens.ease.enter] as Bezier
const standardEase = [...motionTokens.ease.standard] as Bezier
/** Duration springs restated as stiffness and damping, so every retarget keeps the velocity already in flight. */
const physical = (visualDuration: number, bounce: number): Transition => {
  const root = (2 * Math.PI) / (visualDuration * 1.2)
  return { type: "spring", stiffness: root * root, damping: 2 * (1 - bounce) * root, mass: 1 }
}
const GROW = physical(0.48, 0.12),
  SHRINK = physical(0.38, 0),
  STRETCH = physical(0.3, 0.04),
  GLIDE = physical(0.3, 0.1),
  SLIDE = physical(0.4, 0.06)
const TRIGGER_RADIUS = 18,
  PANEL_RADIUS = 26,
  WIDE_CELL = 36,
  WIDE_MIN = 712,
  EDGE = 8

const roll: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${direction * 0.45}em`, filter: `blur(${blur.subtle}px)` }),
  center: { opacity: 1, y: "0em", filter: "blur(0px)", transition: { duration: 0.26, ease: enterEase } },
  exit: (direction: number) => ({
    opacity: 0,
    y: `${direction * -0.45}em`,
    filter: `blur(${blur.subtle}px)`,
    transition: { duration: 0.14, ease: standardEase },
  }),
}
const fade: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, y: "0em", filter: "blur(0px)", transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.08 } },
}
/** Panel content arrives just behind the growing surface and leaves ahead of it. */
const faceIn: Variants = {
  hidden: { opacity: 0, y: -4, filter: `blur(${blur.soft}px)` },
  shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.26, ease: enterEase, delay: 0.07 } },
  gone: { opacity: 0, y: -2, filter: `blur(${blur.soft}px)`, transition: { duration: 0.12, ease: standardEase } },
}
const faceFade: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.12 } },
  gone: { opacity: 0, transition: { duration: 0.08 } },
}
const slide: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 48, filter: `blur(${blur.soft}px)` }),
  center: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { x: SLIDE, opacity: { duration: 0.22, ease: enterEase }, filter: { duration: 0.24, ease: enterEase } },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -36,
    filter: `blur(${blur.soft}px)`,
    transition: { x: SLIDE, opacity: { duration: 0.14, ease: standardEase }, filter: { duration: 0.14, ease: standardEase } },
  }),
}

const navButtonClass = [
  "absolute top-0 z-2 grid size-8 cursor-pointer place-items-center rounded-pill border-0 bg-transparent p-0 text-text-secondary [-webkit-tap-highlight-color:transparent]",
  "[transition:background-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard),transform_var(--duration-instant)_var(--ease-standard)]",
  "active:not-disabled:[transform:scale(.92)] disabled:cursor-default disabled:opacity-35",
  "focus-visible:bg-foreground/5 focus-visible:text-foreground pointer-fine:hover:not-disabled:bg-foreground/[6.5%] pointer-fine:hover:not-disabled:text-foreground",
  "motion-reduce:duration-0",
].join(" ")

const actionClass = [
  "inline-flex h-control-sm cursor-pointer items-center justify-center rounded-control border-0 px-3.5 font-medium whitespace-nowrap [-webkit-tap-highlight-color:transparent]",
  "[transition:background-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard),transform_var(--duration-instant)_var(--ease-standard),opacity_var(--duration-fast)_var(--ease-standard)]",
  "motion-reduce:duration-0",
].join(" ")

/** Words roll one by one: a later date rises from below, an earlier one drops from above; words that stay the same hold still. */
function Rolling({ text, direction, reduced }: { text: string; direction: number; reduced: boolean }) {
  const words = text.split(/\s+/).filter(Boolean)
  return (
    // Words roll in their own slots; a leaving word pops out of flow so the next one never waits for space.
    <span className="inline-flex gap-[.28em] whitespace-nowrap" aria-hidden="true">
      {words.map((word, index) => (
        <span key={index} className="relative inline-block">
          <AnimatePresence initial={false} mode="popLayout" custom={direction}>
            <motion.span
              key={word}
              className="inline-block"
              custom={direction}
              variants={reduced ? fade : roll}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {word}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  )
}

/** Remembers which way a range moved, so labels roll in time's direction. */
function useDirection(range: DateRange | null) {
  const time = range ? range.start.getTime() * 2 + range.end.getTime() : null
  const [previous, setPrevious] = useState(time)
  const [direction, setDirection] = useState(1)
  if (time !== previous) {
    setPrevious(time)
    setDirection(time === null || previous === null || time >= previous ? 1 : -1)
  }
  return direction
}

type Segment = { left: number; width: number } | null
const cellIn = (date: Date, first: Date) => {
  const index = dayDiff(date, first)
  return { row: Math.floor(index / 7), col: index % 7 }
}

/** One week's slice of the highlight. It grows out of the edge the range arrives from, so hovering reads as stretching. */
function Bar({ row, segment, reduced }: { row: number; segment: Segment; reduced: boolean }) {
  const left = useMotionValue(segment?.left ?? 0),
    width = useMotionValue(segment?.width ?? 0),
    opacity = useMotionValue(segment ? 1 : 0)
  const leftPct = useTransform(left, (value) => `${value}%`),
    widthPct = useTransform(width, (value) => `${value}%`)
  const wasEmpty = useRef(!segment)
  useLayoutEffect(() => {
    if (!segment) {
      wasEmpty.current = true
      animate(opacity, 0, { duration: reduced ? 0 : 0.14 })
      return
    }
    if (wasEmpty.current || reduced) {
      left.jump(segment.left)
      width.jump(segment.width)
    } else {
      animate(left, segment.left, STRETCH)
      animate(width, segment.width, STRETCH)
    }
    wasEmpty.current = false
    animate(opacity, 1, { duration: reduced ? 0 : 0.16 })
  }, [left, opacity, reduced, segment, width])
  return (
    <motion.span
      className="absolute h-[calc(var(--cell)-6px)] rounded-pill bg-accent-subtle"
      style={{ left: leftPct, width: widthPct, opacity, top: `calc(${row} * var(--cell) + 3px)` }}
    />
  )
}

/** A solid end of the range. It glides from day to day and only fades when the end leaves this month. */
function Thumb({ cell, reduced }: { cell: { row: number; col: number } | null; reduced: boolean }) {
  const x = useMotionValue(cell?.col ?? 0),
    y = useMotionValue(cell?.row ?? 0),
    opacity = useMotionValue(cell ? 1 : 0),
    scale = useMotionValue(cell ? 1 : 0.8)
  const transform = useTransform(() => `translate(${x.get() * 100}%, ${y.get() * 100}%) scale(${scale.get()})`)
  const hidden = useRef(!cell)
  useLayoutEffect(() => {
    if (!cell) {
      hidden.current = true
      animate(opacity, 0, { duration: reduced ? 0 : 0.12 })
      animate(scale, 0.8, { duration: reduced ? 0 : 0.12 })
      return
    }
    if (hidden.current || reduced) {
      x.jump(cell.col)
      y.jump(cell.row)
    } else {
      animate(x, cell.col, GLIDE)
      animate(y, cell.row, GLIDE)
    }
    hidden.current = false
    animate(opacity, 1, { duration: reduced ? 0 : 0.16 })
    animate(scale, 1, reduced ? { duration: 0 } : GLIDE)
  }, [cell, opacity, reduced, scale, x, y])
  return (
    <motion.span
      className="absolute top-0 left-0 size-(--cell) before:absolute before:inset-[3px] before:rounded-full before:bg-accent before:content-['']"
      style={{ transform, opacity }}
    />
  )
}

interface MonthProps {
  month: Date
  range: DateRange | null
  tabbable: string
  today?: Date
  minDate?: Date
  maxDate?: Date
  weekStartsOn: 0 | 1
  reduced: boolean
  formatters: { title: Intl.DateTimeFormat; day: Intl.DateTimeFormat; weekday: Intl.DateTimeFormat; weekdayLong: Intl.DateTimeFormat }
  onPick: (date: Date) => void
  onHover: (date: Date) => void
  onKey: (event: ReactKeyboardEvent<HTMLButtonElement>, date: Date) => void
  onFocusDay: (date: Date) => void
  idBase: string
}

function Month({
  month,
  range,
  tabbable,
  today,
  minDate,
  maxDate,
  weekStartsOn,
  reduced,
  formatters,
  onPick,
  onHover,
  onKey,
  onFocusDay,
  idBase,
}: MonthProps) {
  const first = useMemo(() => addDays(month, -((month.getDay() - weekStartsOn + 7) % 7)), [month, weekStartsOn])
  const rows = useMemo(
    () => Array.from({ length: 6 }, (_, row) => Array.from({ length: 7 }, (_, col) => addDays(first, row * 7 + col))),
    [first],
  )
  const titleId = `${idBase}-${keyOf(month)}`
  const inMonth = (date: Date) => monthDiff(date, month) === 0

  const lo = range?.start,
    hi = range?.end
  const loKey = lo ? keyOf(lo) : "",
    hiKey = hi ? keyOf(hi) : ""
  /** Each week's slice of the range, in percent of the row. Keyed by the range's days so bars only move when it does. */
  const segments = useMemo<Segment[]>(() => {
    if (!loKey || !hiKey) return rows.map(() => null)
    const start = fromKey(loKey),
      end = fromKey(hiKey)
    const unit = 100 / 7
    const colOf = (date: Date) => dayDiff(date, first) % 7
    return rows.map((row) => {
      const days = row.filter((date) => monthDiff(date, month) === 0)
      if (!days.length) return null
      const rowFirst = days[0],
        rowLast = days[days.length - 1]
      const from = dayDiff(start, rowFirst) > 0 ? start : rowFirst,
        to = dayDiff(end, rowLast) < 0 ? end : rowLast
      if (dayDiff(from, to) <= 0) {
        const a = colOf(from),
          b = colOf(to)
        return { left: a * unit, width: (b - a + 1) * unit }
      }
      // The week sits wholly before or after the range: collapse at the edge the range would grow in from.
      if (dayDiff(rowLast, start) < 0) return { left: (colOf(rowLast) + 1) * unit, width: 0 }
      return { left: colOf(rowFirst) * unit, width: 0 }
    })
  }, [first, hiKey, loKey, month, rows])
  const startCell = useMemo(
    () => (loKey && monthDiff(fromKey(loKey), month) === 0 ? cellIn(fromKey(loKey), first) : null),
    [loKey, month, first],
  )
  const endCell = useMemo(
    () => (hiKey && hiKey !== loKey && monthDiff(fromKey(hiKey), month) === 0 ? cellIn(fromKey(hiKey), first) : null),
    [hiKey, loKey, month, first],
  )

  return (
    <div className="w-[calc(var(--cell)*7)]">
      <p id={titleId} className="m-0 h-8 text-center leading-8 font-medium whitespace-nowrap text-foreground">
        {formatters.title.format(month)}
      </p>
      <div role="grid" aria-labelledby={titleId} className="grid">
        <div role="row" className="grid h-7 grid-cols-[repeat(7,var(--cell))] items-center text-center text-xs text-text-muted">
          {rows[0].map((date) => (
            <span key={date.getDay()} role="columnheader" aria-label={formatters.weekdayLong.format(date)}>
              {formatters.weekday.format(date).slice(0, 2)}
            </span>
          ))}
        </div>
        <div className="relative">
          {/* The highlight lives under the days: one bar per week plus a solid end at each side of the range. */}
          <span className="pointer-events-none absolute inset-0" aria-hidden="true">
            {segments.map((segment, row) => (
              <Bar key={row} row={row} segment={segment} reduced={reduced} />
            ))}
            <Thumb cell={startCell} reduced={reduced} />
            <Thumb cell={endCell} reduced={reduced} />
          </span>
          {rows.map((row, index) => (
            <div key={index} role="row" className="grid h-(--cell) grid-cols-[repeat(7,var(--cell))]">
              {row.map((date) => {
                if (!inMonth(date)) return <span key={keyOf(date)} role="gridcell" className="relative block" />
                const key = keyOf(date)
                const disabled = Boolean((minDate && dayDiff(date, minDate) < 0) || (maxDate && dayDiff(date, maxDate) > 0))
                const inRange = Boolean(lo && hi && dayDiff(date, lo) >= 0 && dayDiff(date, hi) <= 0)
                const edge = sameDay(date, lo) || sameDay(date, hi)
                const isToday = sameDay(date, today)
                return (
                  <span key={key} role="gridcell" aria-selected={inRange} className="relative block">
                    <button
                      type="button"
                      className={cn(
                        "group/day relative z-1 grid size-full cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-foreground tabular-nums [-webkit-tap-highlight-color:transparent]",
                        "[transition:color_var(--duration-fast)_var(--ease-standard)] motion-reduce:duration-0",
                        "disabled:cursor-default disabled:text-text-muted disabled:opacity-50",
                        edge && "font-medium text-accent-foreground delay-40",
                        isToday &&
                          "after:absolute after:bottom-[5px] after:left-1/2 after:-ml-0.5 after:size-1 after:rounded-full after:content-['']",
                        isToday && (edge ? "after:bg-accent-foreground" : "after:bg-accent"),
                      )}
                      data-date={key}
                      data-edge={edge || undefined}
                      data-range={inRange || undefined}
                      data-today={isToday || undefined}
                      tabIndex={key === tabbable ? 0 : -1}
                      disabled={disabled}
                      aria-current={isToday ? "date" : undefined}
                      aria-label={formatters.day.format(date)}
                      onClick={() => onPick(date)}
                      onPointerEnter={() => {
                        if (!disabled) onHover(date)
                      }}
                      onFocus={() => onFocusDay(date)}
                      onKeyDown={(event) => onKey(event, date)}
                    >
                      <span
                        className={cn(
                          "relative grid size-[calc(100%-6px)] place-items-center rounded-full",
                          "[transition:background-color_var(--duration-fast)_var(--ease-standard),transform_var(--duration-instant)_var(--ease-standard)] motion-reduce:duration-0",
                          !disabled && "group-active/day:[transform:scale(.9)]",
                          !edge && "group-focus-visible/day:bg-foreground/7",
                          !edge && !disabled && "pointer-fine:group-hover/day:bg-foreground/7",
                        )}
                      >
                        {date.getDate()}
                      </span>
                    </button>
                  </span>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** The visible months travel together; a leaving set turns inert so focus and queries only find the current one. */
function Months({ children, direction, reduced }: { children: ReactNode; direction: number; reduced: boolean }) {
  const present = useIsPresent()
  return (
    <motion.div
      className="flex gap-6"
      data-current={present || undefined}
      inert={!present || undefined}
      custom={direction}
      variants={reduced ? fade : slide}
      initial="enter"
      animate="center"
      exit="exit"
    >
      {children}
    </motion.div>
  )
}

export function DateRangePicker({
  value,
  defaultValue = null,
  onChange,
  label = "Date range",
  placeholder = "Select dates",
  presets = defaultDateRangePresets,
  minDate,
  maxDate,
  weekStartsOn = 0,
  locale = "en-US",
  months = "auto",
  boundary,
  className,
}: DateRangePickerProps) {
  const reduced = useReducedFlag()
  const today = useToday()
  const uid = useId()
  const [inner, setInner] = useState<DateRange | null>(defaultValue)
  const committed = value !== undefined ? value : inner

  const [open, setOpen] = useState(false)
  const [compact, setCompact] = useState(false)
  const [panelWidth, setPanelWidth] = useState(0)
  const [view, setView] = useState<Date>(() => monthStart(committed?.end ?? new Date(2000, 0, 1)))
  const [direction, setDirection] = useState(1)
  const [draft, setDraft] = useState<DateRange | null>(committed)
  const [anchor, setAnchor] = useState<Date | null>(null)
  const [hover, setHover] = useState<Date | null>(null)
  const [focusKey, setFocusKey] = useState("")

  const formatters = useMemo(
    () => ({
      label: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }),
      title: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
      day: new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
      weekday: new Intl.DateTimeFormat(locale, { weekday: "short" }),
      weekdayLong: new Intl.DateTimeFormat(locale, { weekday: "long" }),
    }),
    [locale],
  )
  const format = useCallback(
    (range: DateRange | null) =>
      !range
        ? placeholder
        : sameDay(range.start, range.end)
          ? formatters.label.format(range.start)
          : // Node and browsers ship different ICU versions: one pads the range dash with thin spaces, the other with plain ones. Normalizing keeps server and client markup identical.
            formatters.label.formatRange(range.start, range.end).replace(/[\u2009\u202f]/g, " "),
    [formatters, placeholder],
  )

  const count = compact ? 1 : 2
  const visible = useMemo(() => Array.from({ length: count }, (_, index) => addMonths(view, index)), [count, view])
  const shown = anchor ? ordered(anchor, hover ?? anchor) : draft
  const activePreset = today && !anchor ? presets.findIndex((preset) => sameRange(preset.range(today), draft)) : -1
  const days = shown ? dayDiff(shown.end, shown.start) + 1 : 0
  const committedDirection = useDirection(committed)
  const shownDirection = useDirection(shown)

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<"trigger" | "day" | null>(null)

  /* ---------- One surface: the trigger's box springs to the panel's box and back ---------- */
  // Before the first measurement the surface simply fills the root and the root wraps the trigger, so server markup already looks right.
  const width = useMotionValue<number | string>("100%"),
    height = useMotionValue<number | string>("100%"),
    radius = useMotionValue(TRIGGER_RADIUS),
    x = useMotionValue(0),
    rootWidth = useMotionValue<number | string>("auto")
  const sizes = useRef<{ trigger: Size; panel: Size | null }>({ trigger: { w: 0, h: 0 }, panel: null })
  const live = useRef({ open: false, reduced: false, ready: false })
  const queued = useRef(false)
  const boundaryRef = useRef(boundary)
  useLayoutEffect(() => {
    boundaryRef.current = boundary
  }, [boundary])

  const bounds = useCallback(() => {
    const element = boundaryRef.current?.()
    const viewport = { left: 0, right: document.documentElement.clientWidth }
    if (!element) return viewport
    const rect = element.getBoundingClientRect()
    return { left: Math.max(viewport.left, rect.left), right: Math.min(viewport.right, rect.right) }
  }, [])

  const update = useCallback(() => {
    queued.current = false
    const { trigger, panel } = sizes.current,
      state = live.current
    if (!trigger.w) return
    const openPanel = state.open && panel ? panel : null
    const target = openPanel ?? trigger
    let offset = 0
    if (openPanel && rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect(),
        box = bounds()
      offset = Math.min(0, box.right - EDGE - (rect.left + openPanel.w))
      offset = Math.max(offset, box.left + EDGE - rect.left)
    }
    const r = openPanel ? PANEL_RADIUS : TRIGGER_RADIUS
    if (!state.ready || state.reduced) {
      width.jump(target.w)
      height.jump(target.h)
      radius.jump(r)
      x.jump(offset)
      rootWidth.jump(trigger.w)
      state.ready = true
      return
    }
    const spring = openPanel ? GROW : state.open ? GROW : SHRINK
    animate(width, target.w, spring)
    animate(height, target.h, spring)
    animate(radius, r, spring)
    animate(x, offset, spring)
    animate(rootWidth, trigger.w, motionTokens.spring.morph)
  }, [bounds, height, radius, rootWidth, width, x])

  const schedule = useCallback(() => {
    if (queued.current) return
    queued.current = true
    queueMicrotask(update)
  }, [update])

  useLayoutEffect(() => {
    live.current.open = open
    live.current.reduced = reduced
    if (!open) sizes.current.panel = null
    schedule()
  }, [open, reduced, schedule])

  useLayoutEffect(() => {
    const node = triggerRef.current
    if (!node) return
    const read = () => {
      sizes.current.trigger = { w: node.offsetWidth, h: node.offsetHeight }
      schedule()
    }
    read()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(read)
    observer.observe(node)
    return () => observer.disconnect()
  }, [schedule])

  useLayoutEffect(() => {
    const node = panelRef.current
    if (!open || !node) return
    const read = () => {
      sizes.current.panel = { w: node.offsetWidth, h: node.offsetHeight }
      schedule()
    }
    read()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(read)
    observer.observe(node)
    return () => observer.disconnect()
  }, [open, schedule])

  /* ---------- Layout: two months when there is room, one compact month otherwise ---------- */
  const measureLayout = useCallback(() => {
    const box = bounds()
    const available = Math.max(0, box.right - box.left - EDGE * 2)
    const single = months === 1 || (months === "auto" && available < WIDE_MIN)
    return { single, width: Math.min(352, available) }
  }, [bounds, months])

  useEffect(() => {
    if (!open) return
    const onResize = () => {
      const next = measureLayout()
      setCompact(next.single)
      setPanelWidth(next.width)
      schedule()
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [measureLayout, open, schedule])

  const viewFor = (range: DateRange | null, single: boolean, fallback: Date) => {
    const end = monthStart(range?.end ?? fallback)
    return single ? end : addMonths(end, -1)
  }

  const openPanel = () => {
    if (!today) return
    const layout = measureLayout()
    setCompact(layout.single)
    setPanelWidth(layout.width)
    setDraft(committed)
    setAnchor(null)
    setHover(null)
    setView(viewFor(committed, layout.single, today))
    setDirection(0)
    setFocusKey(keyOf(committed?.start ?? today))
    pendingFocus.current = "day"
    setOpen(true)
  }

  const close = useCallback((focus: boolean) => {
    if (focus) pendingFocus.current = "trigger"
    setDirection(0)
    setOpen(false)
    setAnchor(null)
    setHover(null)
  }, [])

  const apply = () => {
    const next = anchor ? { start: anchor, end: anchor } : draft
    if (!next) return
    if (value === undefined) setInner(next)
    onChange?.(next)
    close(true)
  }

  /* ---------- Focus management ---------- */
  useLayoutEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    if (target === "trigger" && !open) {
      pendingFocus.current = null
      triggerRef.current?.focus({ preventScroll: true })
      return
    }
    if (target === "day" && open) {
      const node = panelRef.current?.querySelector<HTMLButtonElement>(`[data-current] [data-date="${focusKey}"]`)
      if (node) {
        pendingFocus.current = null
        node.focus({ preventScroll: true })
      }
    }
  }, [focusKey, open, view, compact])

  useEffect(() => {
    if (!open) return
    const down = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false)
    }
    document.addEventListener("pointerdown", down)
    return () => document.removeEventListener("pointerdown", down)
  }, [close, open])

  const onRootKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && open) {
      event.preventDefault()
      event.stopPropagation()
      close(true)
    }
  }
  const onRootBlur = (event: ReactFocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null
    if (open && next && !event.currentTarget.contains(next)) close(false)
  }

  /* ---------- Month navigation and picking ---------- */
  const goTo = (next: Date) => {
    const delta = monthDiff(next, view)
    if (!delta) return
    setDirection(Math.sign(delta))
    setView(next)
  }

  /** Keeps a range on screen: nothing moves when it already fits, otherwise its last month lands on the right. */
  const reveal = (range: DateRange) => {
    const first = view,
      last = addMonths(view, count - 1)
    if (monthDiff(range.start, first) >= 0 && monthDiff(range.end, last) <= 0) return
    goTo(viewFor(range, compact, range.end))
  }

  const pick = (date: Date) => {
    setFocusKey(keyOf(date))
    if (!anchor) {
      setAnchor(date)
      setHover(date)
      return
    }
    setDraft(ordered(anchor, date))
    setAnchor(null)
    setHover(null)
  }

  const choosePreset = (preset: DateRangePreset) => {
    if (!today) return
    const range = preset.range(today)
    setDraft(range)
    setAnchor(null)
    setHover(null)
    setFocusKey(keyOf(range.start))
    reveal(range)
  }

  const onDayKey = (event: ReactKeyboardEvent<HTMLButtonElement>, date: Date) => {
    const weekday = (date.getDay() - weekStartsOn + 7) % 7
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(date, -1),
      ArrowRight: () => addDays(date, 1),
      ArrowUp: () => addDays(date, -7),
      ArrowDown: () => addDays(date, 7),
      Home: () => addDays(date, -weekday),
      End: () => addDays(date, 6 - weekday),
      PageUp: () => shiftMonths(date, event.shiftKey ? -12 : -1),
      PageDown: () => shiftMonths(date, event.shiftKey ? 12 : 1),
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    const next = clampDate(move(), minDate, maxDate)
    setFocusKey(keyOf(next))
    if (anchor) setHover(next)
    pendingFocus.current = "day"
    const first = view,
      last = addMonths(view, count - 1)
    if (monthDiff(next, first) < 0) goTo(monthStart(next))
    else if (monthDiff(next, last) > 0) goTo(addMonths(monthStart(next), -(count - 1)))
  }

  const onRailKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys = compact ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"]
    if (!keys.includes(event.key)) return
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-preset]"))
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (at < 0) return
    event.preventDefault()
    buttons[(at + (event.key === keys[1] ? 1 : -1) + buttons.length) % buttons.length]?.focus()
  }

  /** The day that owns the tab stop: the focused day when it is on screen, else the first visible day of the range, else the 1st. */
  const tabbable = useMemo(() => {
    const onScreen = (date: Date) => visible.some((month) => monthDiff(date, month) === 0)
    if (focusKey && onScreen(fromKey(focusKey))) return focusKey
    if (shown && onScreen(shown.start)) return keyOf(shown.start)
    return keyOf(visible[0])
  }, [focusKey, shown, visible])

  /* ---------- Preset highlight glides between presets ---------- */
  const gx = useMotionValue(0),
    gy = useMotionValue(0),
    gw = useMotionValue(0),
    gh = useMotionValue(0),
    go = useMotionValue(0)
  useLayoutEffect(() => {
    const rail = railRef.current
    const node = activePreset < 0 ? null : rail?.querySelector<HTMLElement>(`[data-preset="${activePreset}"]`)
    if (!rail || !node) {
      animate(go, 0, { duration: reduced ? 0 : 0.14 })
      return
    }
    const place = [node.offsetLeft, node.offsetTop, node.offsetWidth, node.offsetHeight]
    if (go.get() < 0.05 || reduced) {
      gx.jump(place[0])
      gy.jump(place[1])
      gw.jump(place[2])
      gh.jump(place[3])
    } else {
      animate(gx, place[0], GLIDE)
      animate(gy, place[1], GLIDE)
      animate(gw, place[2], GLIDE)
      animate(gh, place[3], GLIDE)
    }
    animate(go, 1, { duration: reduced ? 0 : 0.16 })
    if (compact && (node.offsetLeft < rail.scrollLeft || node.offsetLeft + node.offsetWidth > rail.scrollLeft + rail.clientWidth)) {
      rail.scrollTo({ left: node.offsetLeft - 12, behavior: reduced ? "auto" : "smooth" })
    }
  }, [activePreset, compact, go, gh, gw, gx, gy, open, reduced])

  /* ---------- Copy ---------- */
  const committedText = format(committed)
  const shownText = shown ? format(shown) : "No dates"
  const countText = shown ? `${days} ${days === 1 ? "day" : "days"}` : ""
  const status = !open
    ? ""
    : anchor
      ? `Start ${formatters.label.format(anchor)}. Choose an end date.`
      : shown
        ? `${shownText}, ${countText}`
        : ""
  const layoutId = reduced ? undefined : `${uid}-value`

  const cellSize = compact && panelWidth ? Math.max(32, Math.min(42, Math.floor((panelWidth - 24) / 7))) : WIDE_CELL

  const quiet = open ? (reduced ? { opacity: 0 } : { opacity: 0, filter: `blur(${blur.subtle}px)` }) : { opacity: 1, filter: "blur(0px)" }
  const quietTransition = open
    ? { duration: 0.12, ease: standardEase }
    : { duration: 0.22, ease: enterEase, delay: reduced ? 0 : 0.1 }
  const valueClass = "inline-flex tabular-nums data-empty:font-normal data-empty:text-text-secondary"

  return (
    /* The root holds the trigger's place in the page. The surface floats above it and grows into the panel, so opening never pushes content. */
    <motion.div
      ref={rootRef}
      className={cn(
        "group/root relative inline-block h-control-md align-top font-body text-sm leading-body tracking-body text-foreground",
        "z-0 [transition:z-index_0s_linear_.5s] data-open:z-30 data-open:delay-0",
        className,
      )}
      style={{ width: rootWidth }}
      data-open={open || undefined}
      onKeyDown={onRootKey}
      onBlur={onRootBlur}
    >
      {/* The trigger stays in place under the panel. Its icons fade, while the value itself flies to the panel footer and back. */}
      <button
        ref={triggerRef}
        type="button"
        className="relative z-1 inline-flex h-control-md w-max cursor-pointer items-center gap-2.5 border-0 bg-transparent pr-3 pl-3.5 font-medium whitespace-nowrap text-foreground [-webkit-tap-highlight-color:transparent] disabled:cursor-default inert:pointer-events-none"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${uid}-panel` : undefined}
        aria-label={`${label}: ${committedText}`}
        disabled={!today}
        inert={open || undefined}
        onClick={openPanel}
      >
        <motion.span className="grid flex-none place-items-center text-text-secondary" initial={false} animate={quiet} transition={quietTransition}>
          <CalendarDays size={16} strokeWidth={1.75} aria-hidden="true" />
        </motion.span>
        {open || !layoutId ? (
          <motion.span
            key="resting"
            className={valueClass}
            data-empty={!committed || undefined}
            initial={false}
            animate={open ? { opacity: 0 } : { opacity: 1 }}
            transition={quietTransition}
          >
            <Rolling text={committedText} direction={committedDirection} reduced={reduced} />
          </motion.span>
        ) : (
          <motion.span
            key="shared"
            layoutId={layoutId}
            layout="position"
            className={valueClass}
            data-empty={!committed || undefined}
            transition={SHRINK}
          >
            <Rolling text={committedText} direction={committedDirection} reduced={reduced} />
          </motion.span>
        )}
        <motion.span className="grid flex-none place-items-center text-text-muted" initial={false} animate={quiet} transition={quietTransition}>
          <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
        </motion.span>
      </button>

      {/* One material from trigger to panel. Size, corners, and offset come from springs; the border is an overlay so it never changes a measurement. */}
      <motion.div
        className={cn(
          "absolute top-0 left-0 z-2 overflow-clip bg-surface-raised shadow-resting group-[:not([data-open])]/root:z-0 group-data-open/root:shadow-floating",
          "[transition:box-shadow_var(--duration-considered)_var(--ease-standard),background-color_var(--duration-fast)_var(--ease-standard)] motion-reduce:duration-0",
          "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-border after:content-[''] after:[transition:border-color_var(--duration-fast)_var(--ease-standard)]",
          "pointer-fine:group-[:not([data-open]):has(>button:hover:not(:disabled))]/root:bg-[color-mix(in_oklab,var(--foreground)_3%,var(--surface-raised))]",
          "pointer-fine:group-[:not([data-open]):has(>button:hover:not(:disabled))]/root:after:border-border-strong",
          "contrast-more:after:border-border-strong",
        )}
        style={{ width, height, borderRadius: radius, x }}
      >
        <AnimatePresence>
          {open && today && (
            <motion.div
              key="panel"
              ref={panelRef}
              id={`${uid}-panel`}
              className={cn("absolute top-0 left-0 w-max", compact ? "p-2" : "p-2.5")}
              role="dialog"
              aria-label={label}
              data-compact={compact || undefined}
              style={{ "--cell": `${cellSize}px`, width: compact && panelWidth ? panelWidth : undefined } as CSSProperties}
              exit={{ opacity: 1, transition: { duration: 0.14 } }}
            >
              <motion.div
                className={cn("flex", compact ? "flex-col gap-2" : "gap-2.5")}
                variants={reduced ? faceFade : faceIn}
                initial="hidden"
                animate="shown"
                exit="gone"
              >
                {/* Compact: one month under a scrolling row of presets. */}
                <div
                  ref={railRef}
                  className={cn(
                    "relative flex flex-none gap-0.5",
                    compact
                      ? "-mx-2 w-auto flex-row overflow-x-auto overscroll-x-contain border-b border-border-subtle px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      : "w-37 flex-col border-r border-border-subtle pr-2.5",
                  )}
                  role="group"
                  aria-label="Presets"
                  onKeyDown={onRailKey}
                >
                  <motion.span
                    className="pointer-events-none absolute top-0 left-0 rounded-xl bg-foreground/[6.5%]"
                    style={{ x: gx, y: gy, width: gw, height: gh, opacity: go }}
                    aria-hidden="true"
                  />
                  {presets.map((preset, index) => (
                    <button
                      key={preset.label}
                      type="button"
                      className={cn(
                        "relative flex h-8 flex-none cursor-pointer items-center rounded-xl border-0 bg-transparent text-left whitespace-nowrap text-text-secondary [-webkit-tap-highlight-color:transparent]",
                        "[transition:color_var(--duration-fast)_var(--ease-standard),background-color_var(--duration-fast)_var(--ease-standard)] motion-reduce:duration-0",
                        "aria-pressed:font-medium aria-pressed:text-foreground pointer-fine:hover:text-foreground pointer-fine:hover:not-aria-pressed:bg-foreground/4",
                        "focus-visible:bg-foreground/5 focus-visible:text-foreground",
                        compact ? "px-[11px]" : "px-3",
                      )}
                      data-preset={index}
                      aria-pressed={index === activePreset}
                      onClick={() => choosePreset(preset)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div
                  className={cn("relative px-0.5", compact && "self-center")}
                  onPointerLeave={() => {
                    if (anchor) setHover(null)
                  }}
                >
                  <button
                    type="button"
                    className={cn(navButtonClass, "left-0.5")}
                    data-side="prev"
                    aria-label="Previous month"
                    onClick={() => goTo(addMonths(view, -1))}
                    disabled={Boolean(minDate && monthDiff(view, minDate) <= 0)}
                  >
                    <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={cn(navButtonClass, "right-0.5")}
                    data-side="next"
                    aria-label="Next month"
                    onClick={() => goTo(addMonths(view, 1))}
                    disabled={Boolean(maxDate && monthDiff(addMonths(view, count - 1), maxDate) >= 0)}
                  >
                    <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                  {/* Months slide horizontally inside a clipped window that keeps a little room for the blur. */}
                  <div className="relative overflow-clip [overflow-clip-margin:2px]">
                    <AnimatePresence initial={false} mode="popLayout" custom={direction}>
                      <Months key={`${keyOf(view)}-${count}`} direction={direction} reduced={reduced}>
                        {visible.map((month) => (
                          <Month
                            key={keyOf(month)}
                            month={month}
                            range={shown}
                            tabbable={tabbable}
                            today={today}
                            minDate={minDate}
                            maxDate={maxDate}
                            weekStartsOn={weekStartsOn}
                            reduced={reduced}
                            formatters={formatters}
                            idBase={uid}
                            onPick={pick}
                            onHover={(date) => {
                              if (anchor) setHover(date)
                            }}
                            onKey={onDayKey}
                            onFocusDay={(date) => setFocusKey(keyOf(date))}
                          />
                        ))}
                      </Months>
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>

              {/* Footer: the formatted range and the two decisions. */}
              <div
                className={cn(
                  "flex items-center justify-between gap-3 border-t border-border-subtle pt-2.5 pr-0.5",
                  compact ? "mt-1.5 flex-wrap pl-[11px]" : "mt-2.5 pl-3",
                )}
              >
                <div className={cn("grid min-w-0 gap-px", compact && "flex-[1_1_8rem]")}>
                  <motion.span
                    layoutId={layoutId}
                    layout={layoutId ? "position" : undefined}
                    className="inline-flex w-max font-medium tabular-nums"
                    transition={GROW}
                    variants={layoutId ? undefined : faceFade}
                    initial={layoutId ? undefined : "hidden"}
                    animate={layoutId ? undefined : "shown"}
                    exit={layoutId ? undefined : "gone"}
                  >
                    <Rolling text={shownText} direction={shownDirection} reduced={reduced} />
                  </motion.span>
                  <motion.span
                    className="inline-flex min-h-[1.4em] text-xs text-text-muted tabular-nums"
                    variants={reduced ? faceFade : faceIn}
                    initial="hidden"
                    animate="shown"
                    exit="gone"
                  >
                    {countText && (
                      <Rolling
                        text={anchor && sameDay(anchor, hover) ? "Pick an end date" : countText}
                        direction={shownDirection}
                        reduced={reduced}
                      />
                    )}
                  </motion.span>
                </div>
                <motion.div
                  className={cn("flex flex-none items-center gap-1.5", compact && "ml-auto")}
                  variants={reduced ? faceFade : faceIn}
                  initial="hidden"
                  animate="shown"
                  exit="gone"
                >
                  <button
                    type="button"
                    className={cn(
                      actionClass,
                      "bg-transparent text-text-secondary active:[transform:scale(.97)] focus-visible:bg-surface-muted focus-visible:text-foreground pointer-fine:hover:bg-surface-muted pointer-fine:hover:text-foreground",
                    )}
                    onClick={() => close(true)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={cn(
                      actionClass,
                      "min-w-19 bg-accent text-accent-foreground active:not-disabled:[transform:scale(.97)] disabled:cursor-default disabled:opacity-45 pointer-fine:hover:not-disabled:bg-accent-strong",
                    )}
                    onClick={apply}
                    disabled={!shown}
                  >
                    Apply
                  </button>
                </motion.div>
              </div>
              <p className="sr-only" aria-live="polite">
                {status}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

export default DateRangePicker
