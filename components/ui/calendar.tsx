"use client"

import { useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import type { CSSProperties, KeyboardEvent, ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { animate, AnimatePresence, motion, useMotionValue, useMotionValueEvent, useTransform } from "motion/react"
import type { AnimationPlaybackControls, MotionValue, Variants } from "motion/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export type CalendarDateMatcher = (date: Date) => boolean

export interface CalendarProps {
  value?: Date
  onChange?: (date: Date) => void
  month?: Date
  onMonthChange?: (month: Date) => void
  minDate?: Date
  maxDate?: Date
  disabledDates?: CalendarDateMatcher
  locale?: string
  className?: string
  /** Adds a Today button that slides back to the current month and selects today when it is available. */
  showToday?: boolean
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)
const sameDay = (a?: Date, b?: Date) =>
  Boolean(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate())
const sameMonth = (a?: Date, b?: Date) => Boolean(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth())
const addDays = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
const addMonths = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth() + amount, 1)
/** Moves by whole months and keeps the day, clamped to the shorter month: January 31 plus one month is February 28. */
const shiftMonths = (date: Date, amount: number) =>
  new Date(
    date.getFullYear(),
    date.getMonth() + amount,
    Math.min(date.getDate(), new Date(date.getFullYear(), date.getMonth() + amount + 1, 0).getDate()),
  )
const isBefore = (a: Date, b?: Date) => Boolean(b && startOfDay(a).getTime() < startOfDay(b).getTime())
const isAfter = (a: Date, b?: Date) => Boolean(b && startOfDay(a).getTime() > startOfDay(b).getTime())
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
const fromKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number)
  return new Date(year, month - 1, day)
}
/** Every month shows six weeks, so the grid keeps one height and never jumps while months change. */
const makeWeeks = (month: Date) => {
  const start = addDays(month, -month.getDay())
  return Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day)))
}

/** Today turns over at local midnight; returning to the tab or waking the device reads it again. */
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
  window.addEventListener("focus", notify)
  return () => {
    window.clearTimeout(timer)
    document.removeEventListener("visibilitychange", onVisible)
    window.removeEventListener("focus", notify)
  }
}
const readToday = () => dateKey(new Date())
const serverToday = () => ""
const subscribeNothing = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false
/** The viewer's local date. Undefined on the server and during hydration, so markup never depends on the server clock or time zone; afterwards it follows the real date across midnight. */
export function useToday() {
  const key = useSyncExternalStore(subscribeToday, readToday, serverToday)
  return useMemo(() => (key ? fromKey(key) : undefined), [key])
}

const { spring, duration } = motionTokens
const enterEase = [...motionTokens.ease.enter] as [number, number, number, number]
const standardEase = [...motionTokens.ease.standard] as [number, number, number, number]
/** Months sit side by side on one strip. Rapid clicks retarget the same spring, so the strip never queues or stacks panes. */
const stripSpring = { type: "spring", visualDuration: 0.36, bounce: 0, restDelta: 0.002 } as const
const monthIndex = (date: Date) => date.getFullYear() * 12 + date.getMonth()
const fromIndex = (index: number) => new Date(Math.floor(index / 12), ((index % 12) + 12) % 12, 1)

/** The title crossfades in place: the old month leaves toward the side the strip travels to while the new one arrives from the other. */
const titleSlide: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 12 }),
  center: { opacity: 1, x: 0, transition: { duration: duration.standard, ease: enterEase } },
  exit: (direction: number) => ({ opacity: 0, x: direction * -12, transition: { duration: 0.14, ease: standardEase } }),
}
/** Reduced motion swaps the title in place, with no travel and no blank frame. */
const titleFade: Variants = {
  enter: { opacity: 1, x: 0 },
  center: { opacity: 1, x: 0, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
}

/* Quiet header controls: a fill on hover, a short press, and a spring release. */
const headerButtonClass = [
  "grid h-8 cursor-pointer place-items-center rounded-pill border-0 bg-transparent text-text-secondary",
  "[transition:background-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard),opacity_var(--duration-fast)_var(--ease-standard),scale_var(--duration-spring)_var(--ease-spring)]",
  "pointer-fine:hover:not-aria-disabled:bg-surface-muted pointer-fine:hover:not-aria-disabled:text-foreground",
  "active:not-aria-disabled:scale-96 active:not-aria-disabled:[transition-duration:var(--duration-fast),var(--duration-fast),var(--duration-fast),100ms] active:not-aria-disabled:[transition-timing-function:var(--ease-standard)]",
  "aria-disabled:cursor-default aria-disabled:opacity-36",
  "motion-reduce:transition-none motion-reduce:active:scale-none!",
].join(" ")

/* The inner circle carries hover and press; the grid cell itself never moves, so the hit area stays put. */
const dayClass = [
  "group/day relative grid aspect-square w-full min-w-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-foreground",
  "text-sm leading-none font-normal tabular-nums [-webkit-tap-highlight-color:transparent]",
  "[transition:color_var(--duration-fast)_var(--ease-standard)_var(--number-delay,0ms)]",
  "before:absolute before:inset-0 before:rounded-[inherit] before:bg-transparent before:content-['']",
  "before:[transition:background-color_var(--duration-fast)_var(--ease-standard),scale_var(--duration-spring)_var(--ease-spring)]",
  "pointer-fine:hover:not-disabled:not-aria-selected:before:bg-surface-muted",
  "active:not-disabled:before:scale-94 active:not-disabled:before:[transition-duration:var(--duration-fast),100ms] active:not-disabled:before:[transition-timing-function:var(--ease-standard)]",
  "disabled:cursor-default disabled:text-text-muted",
  "motion-reduce:transition-none motion-reduce:before:transition-none motion-reduce:active:before:scale-none!",
].join(" ")

const dayNumberClass = [
  "relative [transition:opacity_var(--duration-fast)_var(--ease-standard)_var(--number-delay,0ms),scale_var(--duration-spring)_var(--ease-spring)]",
  "group-[:active:not(:disabled)]/day:scale-94 group-[:active:not(:disabled)]/day:[transition-duration:var(--duration-fast),100ms] group-[:active:not(:disabled)]/day:[transition-timing-function:var(--ease-standard)]",
  "motion-reduce:transition-none motion-reduce:group-active/day:scale-none!",
].join(" ")

/* Today is a small dot under the number. It takes the number's color, so it flips with it when the disc arrives. */
const todayDotClass =
  "after:absolute after:top-[calc(100%+4px)] after:left-1/2 after:-ml-0.5 after:size-1 after:rounded-full after:bg-current after:content-['']"

/* The selected disc's fill: press scales it so it never fights the glide, and hover on the selected day deepens it. */
const highlightFillClass = [
  "absolute inset-0 rounded-full bg-accent",
  "[transition:background-color_var(--duration-fast)_var(--ease-standard),scale_var(--duration-spring)_var(--ease-spring)]",
  "pointer-fine:group-has-[[aria-selected=true]:hover]/month:bg-accent-strong",
  "group-has-[[aria-selected=true]:active:not(:disabled)]/month:scale-94 group-has-[[aria-selected=true]:active:not(:disabled)]/month:[transition-duration:var(--duration-fast),100ms] group-has-[[aria-selected=true]:active:not(:disabled)]/month:[transition-timing-function:var(--ease-standard)]",
  "motion-reduce:transition-none motion-reduce:group-has-[[aria-selected=true]:active]/month:scale-none!",
].join(" ")

/**
 * The selected disc of one month. It is positioned by week and weekday rather than measured, so it glides on a straight
 * line between any two days, keeps gliding while the strip slides, and retargets mid-flight on a new pick.
 * It only grows in or fades out when the selection enters or leaves this month.
 */
function SelectionDisc({ cell, reduced }: { cell: number; reduced: boolean }) {
  const visible = cell >= 0
  const col = useMotionValue(visible ? cell % 7 : 0)
  const row = useMotionValue(visible ? Math.floor(cell / 7) : 0)
  const opacity = useMotionValue(visible ? 1 : 0)
  const scale = useMotionValue(visible ? 1 : 0.6)
  // Each step is one cell plus the 4px gap; percentages resolve against the disc's own size, which matches a cell.
  const transform = useTransform(
    () => `translate(calc(${col.get()} * (100% + 4px)), calc(${row.get()} * (100% + 4px))) scale(${scale.get()})`,
  )
  const hidden = useRef(!visible)
  useLayoutEffect(() => {
    if (!visible) {
      hidden.current = true
      const fade = reduced ? { duration: 0 } : { duration: 0.14, ease: standardEase }
      const controls = [animate(opacity, 0, fade), animate(scale, 0.6, fade)]
      return () => controls.forEach((control) => control.stop())
    }
    const nextCol = cell % 7,
      nextRow = Math.floor(cell / 7)
    const controls: AnimationPlaybackControls[] = []
    if (hidden.current || reduced) {
      col.jump(nextCol)
      row.jump(nextRow)
    } else controls.push(animate(col, nextCol, spring.morph), animate(row, nextRow, spring.morph))
    hidden.current = false
    controls.push(
      animate(opacity, 1, reduced ? { duration: 0 } : { duration: duration.fast, ease: enterEase }),
      animate(scale, 1, reduced ? { duration: 0 } : spring.snappy),
    )
    return () => controls.forEach((control) => control.stop())
  }, [cell, visible, reduced, col, row, opacity, scale])
  return (
    <motion.span
      className="pointer-events-none absolute top-0 left-0 aspect-square w-[calc((100%-24px)/7)] will-change-transform"
      style={{ transform, opacity }}
      aria-hidden="true"
    >
      <span className={highlightFillClass} />
    </motion.span>
  )
}

/** One month on the strip. Only the month being navigated to is focusable and exposed; the one sliding past is inert. */
function MonthPane({ index, position, present, children }: { index: number; position: MotionValue<number>; present: boolean; children: ReactNode }) {
  const x = useTransform(position, (value) => `calc(${(index - value) * 100}% + ${(index - value) * 16}px)`)
  const opacity = useTransform(position, (value) => 1 - Math.min(1, Math.abs(index - value)) * 0.6)
  return (
    <motion.div
      className="group/month relative col-start-1 row-start-1 min-w-0 will-change-transform inert:pointer-events-none"
      style={{ x, opacity }}
      data-present={present || undefined}
      aria-hidden={present ? undefined : true}
      inert={!present}
    >
      {children}
    </motion.div>
  )
}

export function Calendar({
  value,
  onChange,
  month: controlledMonth,
  onMonthChange,
  minDate,
  maxDate,
  disabledDates,
  locale = "en-US",
  className,
  showToday = false,
}: CalendarProps) {
  const titleId = useId()
  const today = useToday()
  // Motion preference only counts after hydration, so server and client markup agree.
  const hydrated = useSyncExternalStore(subscribeNothing, clientSnapshot, serverSnapshot)
  const reducedMotion = (useReducedMotion() ?? false) && hydrated
  const [internalMonth, setInternalMonth] = useState(() => (value ? monthStart(value) : undefined))
  const [focusedDate, setFocusedDate] = useState(value)
  const viewportRef = useRef<HTMLDivElement>(null)
  const focusRequest = useRef<string | null>(null)
  // Without a value or month the calendar waits for the client's today, then settles on that month once.
  const fallback = value ?? today
  const month = controlledMonth ? monthStart(controlledMonth) : (internalMonth ?? (fallback && monthStart(fallback)))
  if (!controlledMonth && !internalMonth && month) setInternalMonth(month)
  const monthTime = month?.getTime()
  const monthKey = month ? dateKey(month) : "pending"
  // Direction is read from the month itself, so arrows, keys, Today, and a controlled month all travel the same way.
  const [shownMonth, setShownMonth] = useState(monthTime)
  const [direction, setDirection] = useState(0)
  if (shownMonth !== monthTime) {
    setShownMonth(monthTime)
    setDirection(shownMonth === undefined || monthTime === undefined ? 0 : monthTime > shownMonth ? 1 : -1)
  }
  const weeks = useMemo(() => (monthTime === undefined ? [] : makeWeeks(new Date(monthTime))), [monthTime])
  // The strip position is measured in months. The panes on either side of it render, plus the month being navigated to.
  const target = month ? monthIndex(month) : 0
  const position = useMotionValue(target)
  const [span, setSpan] = useState<[number, number]>([target, target])
  useMotionValueEvent(position, "change", (value) => {
    const next: [number, number] = [Math.floor(value + 1e-3), Math.ceil(value - 1e-3)]
    setSpan((current) => (current[0] === next[0] && current[1] === next[1] ? current : next))
  })
  const ready = month !== undefined
  const placed = useRef(ready)
  useLayoutEffect(() => {
    if (!ready) return
    const from = position.get()
    if (from === target) return
    // The first month and reduced motion land in place; everything else slides on the strip.
    if (!placed.current || reducedMotion) {
      placed.current = true
      position.jump(target)
      return
    }
    // Long jumps (Today, a year with Shift) start one month away, so the strip never scrolls through the months between.
    if (Math.abs(target - from) > 2) position.jump(target - Math.sign(target - from))
    const controls = animate(position, target, stripSpring)
    return () => controls.stop()
  }, [ready, target, reducedMotion, position])
  const paneIndexes = Array.from(new Set([span[0], span[1], target])).sort((a, b) => a - b)
  const formatter = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }), [locale])
  const weekdayFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short" }), [locale])
  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => weekdayFormatter.format(new Date(2024, 0, 7 + index))),
    [weekdayFormatter],
  )
  const monthLabel = month ? formatter.format(month) : ""
  // The selected disc glides between days, so each number flips color as the disc actually passes it:
  // the day it leaves waits longer on short hops, the day it lands on waits longer on long ones.
  const valueKey = value ? dateKey(value) : ""
  const [last, setLast] = useState({ key: valueKey, date: value })
  const [handoff, setHandoff] = useState({ from: "", to: "", distance: 0 })
  if (last.key !== valueKey) {
    const days = last.date && value ? Math.round((startOfDay(value).getTime() - startOfDay(last.date).getTime()) / 864e5) : 0
    const columns = last.date && value ? value.getDay() - last.date.getDay() : 0
    setLast({ key: valueKey, date: value })
    setHandoff({ from: last.key, to: valueKey, distance: Math.hypot(columns, (days - columns) / 7) })
  }
  const numberDelay = (key: string): CSSProperties | undefined => {
    if (!handoff.distance || reducedMotion || (key !== handoff.to && key !== handoff.from)) return undefined
    const delay = key === handoff.to ? Math.min(260, 95 + 85 * Math.log(handoff.distance)) : Math.max(20, 130 / handoff.distance)
    return { "--number-delay": `${Math.round(delay)}ms` } as CSSProperties
  }

  const isDisabled = (date: Date) => isBefore(date, minDate) || isAfter(date, maxDate) || Boolean(disabledDates?.(date))
  const previousMonth = month && addMonths(month, -1)
  const nextMonth = month && addMonths(month, 1)
  // While the month is still unknown the controls keep their resting look, so hydration does not flash them dim.
  const previousDisabled = Boolean(previousMonth && minDate && previousMonth.getTime() < monthStart(minDate).getTime())
  const nextDisabled = Boolean(nextMonth && maxDate && nextMonth.getTime() > monthStart(maxDate).getTime())
  const todaySelectable = Boolean(today && !isDisabled(today) && onChange)
  const todayIdle = Boolean(today && sameMonth(month, today) && (!todaySelectable || sameDay(value, today)))
  // Roving tab stop: the day last focused, else the selection, else today, else the first open day of the month.
  const tabbableKey = (() => {
    const open = (date?: Date) => (date && sameMonth(date, month) && !isDisabled(date) ? dateKey(date) : "")
    return (
      open(focusedDate) ||
      open(value) ||
      open(today) ||
      dateKey(weeks.flat().find((date) => sameMonth(date, month) && !isDisabled(date)) ?? new Date(0))
    )
  })()

  const changeMonth = (target: Date) => {
    const normalized = monthStart(target)
    if (!controlledMonth) setInternalMonth(normalized)
    onMonthChange?.(normalized)
  }

  /** Keyboard focus lands on the new day in the same frame the month starts to slide. */
  useLayoutEffect(() => {
    const key = focusRequest.current
    if (!key) return
    const button = viewportRef.current?.querySelector<HTMLButtonElement>(`[data-present] [data-date="${key}"]`)
    if (button) {
      focusRequest.current = null
      button.focus({ preventScroll: true })
    }
  })

  /** Clamps a keyboard move to the allowed range and steps past blocked days in the direction of travel. */
  const moveFocus = (from: Date, target: Date, step: number) => {
    let next =
      isBefore(target, minDate) && minDate ? startOfDay(minDate) : isAfter(target, maxDate) && maxDate ? startOfDay(maxDate) : target
    for (let tries = 0; tries < 42 && isDisabled(next); tries += 1) next = addDays(next, step)
    if (isDisabled(next) || sameDay(next, from)) return
    setFocusedDate(next)
    focusRequest.current = dateKey(next)
    if (!sameMonth(next, month)) changeMonth(next)
  }

  const onDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      if (!isDisabled(date)) onChange?.(date)
      return
    }
    const moves: Record<string, [Date, number]> = {
      ArrowLeft: [addDays(date, -1), -1],
      ArrowRight: [addDays(date, 1), 1],
      ArrowUp: [addDays(date, -7), -1],
      ArrowDown: [addDays(date, 7), 1],
      Home: [addDays(date, -date.getDay()), 1],
      End: [addDays(date, 6 - date.getDay()), -1],
      PageUp: [shiftMonths(date, event.shiftKey ? -12 : -1), -1],
      PageDown: [shiftMonths(date, event.shiftKey ? 12 : 1), 1],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    moveFocus(date, move[0], move[1])
  }

  const goToToday = () => {
    if (!today || !month || todayIdle) return
    setFocusedDate(today)
    if (!sameMonth(today, month)) changeMonth(today)
    if (todaySelectable && !sameDay(value, today)) onChange?.(today)
  }

  // Six fixed weeks per month, so a day's cell is its distance from the first day on the grid.
  const cellOf = (paneMonth: Date) => {
    if (!value) return -1
    const first = addDays(paneMonth, -paneMonth.getDay())
    const index = Math.round((startOfDay(value).getTime() - first.getTime()) / 864e5)
    return index >= 0 && index < 42 ? index : -1
  }

  const renderMonth = (paneMonth: Date, present: boolean) => (
    <>
      <SelectionDisc cell={cellOf(paneMonth)} reduced={reducedMotion} />
      <div className="grid gap-y-1" role="grid" aria-label={formatter.format(paneMonth)}>
        {makeWeeks(paneMonth).map((week) => (
          <div key={dateKey(week[0])} className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-x-1" role="row">
            {week.map((date) => {
              const key = dateKey(date)
              const selected = sameDay(date, value)
              const isToday = sameDay(date, today)
              const outside = !sameMonth(date, paneMonth)
              const disabled = isDisabled(date)
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  data-date={key}
                  aria-label={date.toLocaleDateString(locale, { dateStyle: "full" })}
                  aria-selected={selected}
                  aria-current={isToday ? "date" : undefined}
                  tabIndex={present && key === tabbableKey ? 0 : -1}
                  disabled={disabled}
                  style={present ? numberDelay(key) : undefined}
                  // Outside days dim their number, not the button, so a disc gliding onto one keeps its full strength.
                  className={cn(
                    dayClass,
                    outside && "text-text-muted",
                    (selected || isToday) && "font-medium",
                    selected && "text-accent-foreground",
                  )}
                  onFocus={() => setFocusedDate(date)}
                  onKeyDown={(event) => onDayKeyDown(event, date)}
                  onClick={() => onChange?.(date)}
                >
                  <span
                    className={cn(
                      dayNumberClass,
                      disabled ? (outside ? "opacity-30" : "opacity-42") : outside && !selected && "opacity-80",
                      isToday && todayDotClass,
                    )}
                  >
                    {date.getDate()}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )

  return (
    <section className={cn("w-[min(100%,328px)] min-w-0 text-foreground", className)} aria-labelledby={titleId}>
      {/* The header is its own size container: below 260px the title takes a full row and the controls sit under it, decided by width alone so a long month name never reflows it. */}
      <div className="@container mb-3.5 grid min-h-[34px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
        <h2
          id={titleId}
          className="m-0 min-w-0 font-body text-base leading-body font-medium tracking-body @max-[260px]:col-span-full"
        >
          <span className="sr-only">{monthLabel}</span>
          {/* Old and new titles share one cell while they cross, so the heading never changes height or jumps. */}
          <span className="grid leading-body" aria-hidden="true">
            <AnimatePresence initial={false} custom={direction}>
              {month && (
                <motion.span
                  key={monthKey}
                  className="col-start-1 row-start-1 inline-block justify-self-start whitespace-nowrap tabular-nums"
                  custom={direction}
                  variants={reducedMotion || !direction ? titleFade : titleSlide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  {monthLabel}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </h2>
        <span className="sr-only" aria-live="polite">
          {direction ? monthLabel : ""}
        </span>
        <div className="-mr-1.5 inline-flex flex-none items-center gap-0.5 @max-[260px]:col-span-full @max-[260px]:justify-self-end">
          {showToday && (
            <button
              type="button"
              className={cn(headerButtonClass, "px-[11px] text-sm leading-none font-medium")}
              aria-disabled={todayIdle || undefined}
              aria-label={today ? `Today, ${today.toLocaleDateString(locale, { dateStyle: "full" })}` : "Today"}
              onClick={goToToday}
            >
              Today
            </button>
          )}
          <button
            type="button"
            className={cn(headerButtonClass, "w-8")}
            aria-label="Previous month"
            aria-disabled={previousDisabled || undefined}
            onClick={() => {
              if (!previousDisabled && previousMonth) changeMonth(previousMonth)
            }}
          >
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={cn(headerButtonClass, "w-8")}
            aria-label="Next month"
            aria-disabled={nextDisabled || undefined}
            onClick={() => {
              if (!nextDisabled && nextMonth) changeMonth(nextMonth)
            }}
          >
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        className="mb-1.5 grid grid-cols-[repeat(7,minmax(0,1fr))] gap-x-1 text-center text-xs leading-6 font-medium text-text-muted *:min-w-0 *:overflow-hidden"
        aria-hidden="true"
      >
        {weekdays.map((day, index) => (
          <span key={`${day}-${index}`}>{day.slice(0, 2)}</span>
        ))}
      </div>
      {/* Months sit on one strip inside a clipped window. Every pane shares one grid cell and has six weeks, so the height never changes. */}
      <div className="relative grid overflow-hidden [contain:paint]" ref={viewportRef}>
        {month ? (
          paneIndexes.map((index) => (
            <MonthPane key={index} index={index} position={position} present={index === target}>
              {renderMonth(fromIndex(index), index === target)}
            </MonthPane>
          ))
        ) : (
          <div className="relative col-start-1 row-start-1 min-w-0 will-change-transform" aria-hidden="true">
            <div className="grid gap-y-1">
              {Array.from({ length: 6 }, (_, week) => (
                <div key={week} className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-x-1">
                  {Array.from({ length: 7 }, (_, day) => (
                    <span key={day} className="aspect-square" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export { addDays, addMonths, sameDay, startOfDay }

export default Calendar
