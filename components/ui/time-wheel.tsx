"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react"
import { motion } from "motion/react"

import { clamp, rubberBand } from "@/lib/gesture"
import { motionTokens as staticTokens } from "@/lib/motion-tokens"
import { useMotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export type TimeWheelMode = "datetime" | "date" | "time"

export interface TimeWheelCopy {
  /** Day reel in datetime mode. */
  day?: string
  month?: string
  /** Day of the month reel in date mode. */
  date?: string
  year?: string
  hour?: string
  minute?: string
  /** AM or PM reel. */
  period?: string
  /** Goes between the day and the time in the summary, as in "Tomorrow, 9:00 AM". */
  joiner?: string
  /** Name of the shortcuts group. */
  shortcuts?: string
  commit?: string
  committing?: string
  committed?: string
  failed?: string
}

export interface TimeWheelShortcut {
  label: string
  value: Date | ((today: Date) => Date)
}

export interface TimeWheelProps {
  /** Which reels to show: day, hour, minute and AM or PM; month, day and year; or time only. */
  mode?: TimeWheelMode
  /** Controlled value. When it changes from outside, every reel spins to it along the short way around. */
  value?: Date
  /** Starting value when uncontrolled. Pass a fixed date so the first render matches on server and client. */
  defaultValue?: Date
  /** Called once when the reels come to rest on a new moment, not on every frame. */
  onChange?: (value: Date) => void
  /** Start of today, for the Today entry and relative words. Defaults to the day of the first value. */
  today?: Date
  /** Earliest selectable day. Defaults to 30 days before today (100 years in date mode). */
  minDate?: Date
  /** Latest selectable day. Defaults to a year after today (10 years in date mode). */
  maxDate?: Date
  /** Minutes between entries on the minute reel. */
  minuteInterval?: 1 | 5 | 10 | 15 | 30
  /** 12 hour clock with an AM or PM reel, or a 24 hour clock. */
  clock?: 12 | 24
  /** BCP 47 locale for names, the time format, the AM and PM words and relative phrases. */
  locale?: string
  /** Shortcut pills under the wheels. false hides them. */
  shortcuts?: TimeWheelShortcut[] | false
  /** Optional heading above the summary. */
  heading?: string
  /** Adds a primary button. Return a promise to show pending, success and failure in place. */
  onCommit?: (value: Date) => void | Promise<void>
  /** Words for localization. */
  copy?: TimeWheelCopy
  /** Spins the reels into place, one after another, the first time the picker scrolls into view. */
  spinIn?: boolean
  /** Multiplies the speed of glides, snaps and the intro. */
  speed?: number
  /** Stops automatic motion. Reels still follow a drag and land on the nearest entry at once. */
  paused?: boolean
  /** Any CSS color for the active reel in the lens and the chosen quick pick. */
  accent?: string
  /** Accessible name of the picker group. */
  label?: string
  className?: string
  style?: CSSProperties
}

/* ---------------------------------------------------------------------------------------------------------------
   Geometry. Entries ride a cylinder drawn with plain 2D transforms: each node rises on the sine of its angle,
   shrinks with a perspective factor and flattens with the cosine. Eleven nodes cover the visible half turn.
   --------------------------------------------------------------------------------------------------------------- */

const SLOTS = 11
const HALF = (SLOTS - 1) / 2
/** Cylinder radius in rows (121px at a 42px row), so arc length on the drum matches the pointer 1:1. */
const RADIUS_ROWS = 121 / 42
/** Eye distance for the perspective shrink, in cylinder radii. */
const EYE = 4
/** Seconds of momentum a flick carries: it lands on the entry nearest to where it would be after this long. */
const PROJECTION = 0.32
/** Exponential glide rates (1/s): flicks decay slower than gentle releases, so long throws read as momentum. */
const GLIDE_FAST = 3.05
const GLIDE_SLOW = 4
/** Release speeds in rows per second between which the glide rate eases from slow to fast (about 210 to 600px/s). */
const GLIDE_SLOW_SPEED = 5
const GLIDE_FAST_SPEED = 14.3
/** Home and End sweep through every entry on a quicker glide. */
const GLIDE_JUMP = 10.5
/** Keys, taps and the wheel: one spring whatever the distance, slightly overdamped, settling in about 0.4s. */
const SPRING_STEP = { k: 380, c: 43 }
/** Shortcuts and outside changes: critically damped and calmer, settling in about 0.6s. */
const SPRING_PICK = { k: 137, c: 23.4 }
/** Back from a rubber band stretch: critically damped at 15 rad/s, no bounce at the edge. */
const SPRING_BACK = { k: 225, c: 30 }
/** iOS rubber band, passed to rubberBand as (limit = RUBBER_D, k = RUBBER_C): the stretch tends to D rows (105px at a 42px row). */
const RUBBER_C = 0.55
const RUBBER_D = 2.5
/** Pixels a press may wander and still count as a tap. */
const TAP_SLOP = 3
/** Shortcuts wait for the pressed pill, then start one reel after another. */
const PICK_DELAY = 0.14
const PICK_STAGGER = 0.05
/** The intro waits a beat after the picker is first seen, then glides every reel in together. */
const INTRO_DELAY = 0.14
/** Confirm shows its pending label only when the promise takes longer than this, so quick saves never flash. */
const PENDING_DELAY = 150
const DEFAULT_VALUE = new Date(2026, 8, 24, 9, 30)
const DAY = 86_400_000

const DEFAULT_COPY: Required<TimeWheelCopy> = {
  day: "Day",
  month: "Month",
  date: "Day",
  year: "Year",
  hour: "Hour",
  minute: "Minute",
  period: "AM or PM",
  joiner: ", ",
  shortcuts: "Shortcuts",
  commit: "Set",
  committing: "Setting",
  committed: "All set",
  failed: "Not saved",
}

const mod = (value: number, count: number) => ((value % count) + count) % count
const pad2 = (value: number) => String(value).padStart(2, "0")
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const addYears = (date: Date, years: number) => new Date(date.getFullYear() + years, date.getMonth(), date.getDate())
/** Whole days from a to b, safe across daylight saving changes. */
const dayDiff = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY)
const daysIn = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1)
/** Rounds to the minute step, carrying into the hour. */
function normalize(date: Date, step: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes())
  next.setMinutes(Math.round(next.getMinutes() / step) * step)
  return next
}

/* ---------------------------------------------------------------------------------------------------------------
   Reel models: what each column shows and how entries map to and from a Date.
   --------------------------------------------------------------------------------------------------------------- */

type ReelKind = "day" | "month" | "date" | "year" | "hour" | "minute" | "period"

interface Reel {
  kind: ReelKind
  name: string
  count: number
  cyclic: boolean
  align: "start" | "center" | "end"
  /** Entries per Page up or Page down. */
  page: number
  label: (entry: number) => string
  spoken: (entry: number) => string
  numeric: (entry: number) => number
  /** Typeahead: the entry matching what was typed, searching onward from `from`. */
  match: (query: string, from: number) => number | null
}

interface Config {
  mode: TimeWheelMode
  reels: Reel[]
  today: Date
  minDay: Date
  maxDay: Date
  indicesOf: (date: Date) => number[]
  compose: (entries: number[], anchor: Date) => Date
  valid: (reel: number, entry: number, entries: number[]) => boolean
  /** A date the reels should turn to by themselves (a day that does not exist, or outside the range), else null. */
  repair: (entries: number[], anchor: Date) => { reel: number; entry: number } | { date: Date } | null
  summary: (date: Date) => { primary: string; secondary: string; spoken: string }
}

function numberMatch(query: string) {
  return /^\d+$/.test(query) ? Number(query) : null
}

function buildConfig(options: {
  mode: TimeWheelMode
  today: Date
  minDate?: Date
  maxDate?: Date
  step: number
  clock: 12 | 24
  locale: string
  labels: Required<TimeWheelCopy>
}): Config {
  const { mode, today, step, clock, locale, labels } = options
  const minDay = startOfDay(options.minDate ?? (mode === "date" ? addYears(today, -100) : addDays(today, -30)))
  const maxDay = startOfDay(options.maxDate ?? (mode === "date" ? addYears(today, 10) : addYears(today, 1)))
  const minYear = minDay.getFullYear()
  const twelve = clock === 12
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", hourCycle: twelve ? "h12" : "h23" })
  const dayShort = new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" })
  const fullDate = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", year: "numeric" })
  const fullDateDay = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
  const monthName = new Intl.DateTimeFormat(locale, { month: "long" })
  const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: "long" })
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const periods = [9, 21].map(
    hour => timeFormat.formatToParts(new Date(2026, 0, 1, hour)).find(part => part.type === "dayPeriod")?.value ?? (hour < 12 ? "AM" : "PM"),
  )
  /** Days up to a month away, then months, then years, so a birthday reads "32 years ago" rather than thousands of days. */
  const relativeDay = (date: Date) => {
    const days = dayDiff(today, date)
    const size = Math.abs(days)
    if (size <= 31) return capitalize(relative.format(days, "day"))
    if (size < 365) return capitalize(relative.format(Math.round(days / 30.44), "month"))
    return capitalize(relative.format(Math.round(days / 365.25), "year"))
  }
  /** The headline says yesterday, today or tomorrow, a weekday name within the coming week, then a short date. */
  const headlineDay = (date: Date) => {
    const days = dayDiff(today, date)
    if (Math.abs(days) <= 1) return capitalize(relative.format(days, "day"))
    if (days > 1 && days < 7) return capitalize(weekdayLong.format(date))
    return dayShort.format(date)
  }
  const dayCount = Math.max(1, dayDiff(minDay, maxDay) + 1)
  const yearCount = Math.max(1, maxDay.getFullYear() - minYear + 1)
  const months = Array.from({ length: 12 }, (_, month) => monthName.format(new Date(2026, month, 1)))

  /** Letters match the start of a label, searching onward from the current entry so repeats cycle. */
  const prefix = (count: number, text: (entry: number) => string) => (query: string, from: number) => {
    for (let offset = 1; offset <= count; offset++) {
      const entry = mod(from + offset, count)
      if (text(entry).toLocaleLowerCase(locale).startsWith(query)) return entry
    }
    return null
  }

  const reelOf: Record<ReelKind, () => Reel> = {
    day: () => {
      const dateOf = (entry: number) => addDays(minDay, entry)
      const isToday = (entry: number) => dayDiff(today, dateOf(entry)) === 0
      const weekdays = prefix(dayCount, entry => weekdayLong.format(dateOf(entry)))
      return {
        kind: "day",
        name: labels.day,
        count: dayCount,
        cyclic: false,
        align: "end",
        page: 7,
        label: entry => (isToday(entry) ? relativeDay(dateOf(entry)) : dayShort.format(dateOf(entry))),
        spoken: entry => (isToday(entry) ? `${relativeDay(dateOf(entry))}, ${dayShort.format(dateOf(entry))}` : dayShort.format(dateOf(entry))),
        numeric: entry => entry,
        match: (query, from) => {
          const day = numberMatch(query)
          if (day === null) return weekdays(query, from)
          // A number finds the next day of the month with that date.
          for (let offset = 1; offset <= dayCount; offset++) {
            const entry = mod(from + offset, dayCount)
            if (dateOf(entry).getDate() === day) return entry
          }
          return null
        },
      }
    },
    month: () => {
      const names = prefix(12, entry => months[entry])
      return {
        kind: "month",
        name: labels.month,
        count: 12,
        cyclic: true,
        align: "start",
        page: 3,
        label: entry => months[entry],
        spoken: entry => months[entry],
        numeric: entry => entry + 1,
        match: (query, from) => {
          const month = numberMatch(query)
          if (month === null) return names(query, from)
          return month >= 1 && month <= 12 ? month - 1 : null
        },
      }
    },
    date: () => ({
      kind: "date",
      name: labels.date,
      count: 31,
      cyclic: true,
      align: "center",
      page: 7,
      label: entry => String(entry + 1),
      spoken: entry => String(entry + 1),
      numeric: entry => entry + 1,
      match: query => {
        const day = numberMatch(query)
        return day !== null && day >= 1 && day <= 31 ? day - 1 : null
      },
    }),
    year: () => ({
      kind: "year",
      name: labels.year,
      count: yearCount,
      cyclic: false,
      align: "center",
      page: 10,
      label: entry => String(minYear + entry),
      spoken: entry => String(minYear + entry),
      numeric: entry => minYear + entry,
      match: (query, from) => {
        if (numberMatch(query) === null) return null
        // The closest year that starts with what was typed.
        let best: number | null = null
        for (let entry = 0; entry < yearCount; entry++) {
          if (!String(minYear + entry).startsWith(query)) continue
          if (best === null || Math.abs(entry - from) < Math.abs(best - from)) best = entry
        }
        return best
      },
    }),
    hour: () => ({
      kind: "hour",
      name: labels.hour,
      count: twelve ? 12 : 24,
      cyclic: true,
      align: "end",
      page: twelve ? 3 : 6,
      label: entry => (twelve ? String(entry === 0 ? 12 : entry) : pad2(entry)),
      spoken: entry => (twelve ? String(entry === 0 ? 12 : entry) : pad2(entry)),
      numeric: entry => (twelve ? entry || 12 : entry),
      match: query => {
        const hour = numberMatch(query)
        if (hour === null) return null
        if (twelve) return hour >= 1 && hour <= 12 ? hour % 12 : null
        return hour <= 23 ? hour : null
      },
    }),
    minute: () => {
      const count = Math.round(60 / step)
      return {
        kind: "minute",
        name: labels.minute,
        count,
        cyclic: true,
        align: "start",
        page: Math.max(1, Math.round(15 / step)),
        label: entry => pad2(entry * step),
        spoken: entry => pad2(entry * step),
        numeric: entry => entry * step,
        match: query => {
          const minute = numberMatch(query)
          if (minute === null) return null
          // One digit reads as the tens (4 is :40); two digits land on the nearest step.
          const value = query.length === 1 ? minute * 10 : minute
          return value < 60 ? mod(Math.round(value / step), count) : null
        },
      }
    },
    period: () => {
      const names = prefix(2, entry => periods[entry])
      return {
        kind: "period",
        name: labels.period,
        count: 2,
        cyclic: false,
        align: "center",
        page: 1,
        label: entry => periods[entry],
        spoken: entry => periods[entry],
        numeric: entry => entry,
        match: (query, from) => names(query, from),
      }
    },
  }

  // Reels follow the locale's own order of month, day and year, and of hour, minute and day period.
  const timeOrder = timeFormat
    .formatToParts(new Date(2026, 0, 1, 21, 30))
    .map((part): ReelKind | null => (part.type === "hour" ? "hour" : part.type === "minute" ? "minute" : part.type === "dayPeriod" && twelve ? "period" : null))
    .filter((kind): kind is ReelKind => kind !== null)
  const dateOrder = fullDate
    .formatToParts(new Date(2026, 8, 24))
    .map((part): ReelKind | null => (part.type === "month" ? "month" : part.type === "day" ? "date" : part.type === "year" ? "year" : null))
    .filter((kind): kind is ReelKind => kind !== null)
  const kinds: ReelKind[] = mode === "date" ? dateOrder : mode === "time" ? timeOrder : ["day", ...timeOrder]
  const reels = kinds.map(kind => reelOf[kind]())
  const find = (kind: ReelKind) => kinds.indexOf(kind)

  const indicesOf = (input: Date): number[] => {
    const date = normalize(input, step)
    return reels.map(reel => {
      switch (reel.kind) {
        case "day":
          return clamp(dayDiff(minDay, date), 0, reel.count - 1)
        case "month":
          return date.getMonth()
        case "date":
          return date.getDate() - 1
        case "year":
          return clamp(date.getFullYear() - minYear, 0, reel.count - 1)
        case "hour":
          return twelve ? date.getHours() % 12 : date.getHours()
        case "minute":
          return mod(Math.round(date.getMinutes() / step), reel.count)
        case "period":
          return date.getHours() >= 12 ? 1 : 0
      }
    })
  }

  const compose = (entries: number[], anchor: Date) => {
    let year = anchor.getFullYear()
    let month = anchor.getMonth()
    let day = anchor.getDate()
    let hours = anchor.getHours()
    let minutes = anchor.getMinutes()
    const at = (kind: ReelKind) => entries[find(kind)]
    if (find("day") >= 0) {
      const date = addDays(minDay, at("day"))
      year = date.getFullYear()
      month = date.getMonth()
      day = date.getDate()
    }
    if (find("year") >= 0) year = minYear + at("year")
    if (find("month") >= 0) month = at("month")
    if (find("date") >= 0) day = Math.min(at("date") + 1, daysIn(year, month))
    if (find("hour") >= 0) hours = twelve ? (at("hour") % 12) + (find("period") >= 0 && at("period") === 1 ? 12 : 0) : at("hour")
    if (find("minute") >= 0) minutes = at("minute") * step
    return new Date(year, month, day, hours, minutes)
  }

  const valid = (reel: number, entry: number, entries: number[]) => {
    if (reels[reel]?.kind !== "date") return true
    const year = find("year") >= 0 ? minYear + entries[find("year")] : today.getFullYear()
    const month = find("month") >= 0 ? entries[find("month")] : today.getMonth()
    return entry + 1 <= daysIn(year, month)
  }

  const repair: Config["repair"] = (entries, anchor) => {
    const dateReel = find("date")
    if (dateReel >= 0 && !valid(dateReel, entries[dateReel], entries)) {
      const year = find("year") >= 0 ? minYear + entries[find("year")] : today.getFullYear()
      const month = find("month") >= 0 ? entries[find("month")] : today.getMonth()
      return { reel: dateReel, entry: daysIn(year, month) - 1 }
    }
    if (mode === "date") {
      const date = compose(entries, anchor)
      if (date < minDay) return { date: minDay }
      if (startOfDay(date) > maxDay) return { date: maxDay }
    }
    return null
  }

  const summary = (date: Date) => {
    const time = timeFormat.format(date)
    if (mode === "time") return { primary: time, secondary: "", spoken: time }
    if (mode === "date") return { primary: fullDate.format(date), secondary: relativeDay(date), spoken: `${fullDateDay.format(date)}, ${relativeDay(date)}` }
    const primary = `${headlineDay(date)}${labels.joiner}${time}`
    const secondary = fullDateDay.format(date)
    return { primary, secondary, spoken: `${primary}, ${secondary}` }
  }

  return { mode, reels, today, minDay, maxDay, indicesOf, compose, valid, repair, summary }
}

/** One slot's text, transform and opacities for a reel resting at `pos`. Shared by the first render and the loop. */
function project(reel: Reel, pos: number, slot: number, valid: (entry: number) => boolean) {
  const at = Math.round(pos) + slot - HALF
  const angle = (at - pos) / RADIUS_ROWS
  const inRange = reel.cyclic || (at >= 0 && at < reel.count)
  const entry = reel.cyclic ? mod(at, reel.count) : at
  const text = inRange ? reel.label(entry) : " "
  // Past the visible half turn a node is hidden and left untransformed.
  if (!inRange || Math.abs(angle) > Math.PI / 2) return { text, transform: "none", base: "0", lens: "0" }
  const cos = Math.cos(angle)
  const dim = valid(entry) ? 1 : 0.32
  // The node rises on the sine, shrinks with the perspective of an eye EYE radii away and flattens with the cosine.
  const depth = EYE / (EYE + 1 - cos)
  const rise = RADIUS_ROWS * Math.sin(angle)
  return {
    text,
    transform: `translateY(calc(var(--reel-row) * ${rise.toFixed(4)})) scale(${depth.toFixed(4)}, ${(depth * cos).toFixed(4)})`,
    base: (cos ** 1.5 * dim).toFixed(3),
    lens: dim.toFixed(3),
  }
}

/* ---------------------------------------------------------------------------------------------------------------
   The engine: one requestAnimationFrame loop for every reel, writing straight to recycled nodes.
   --------------------------------------------------------------------------------------------------------------- */

interface Spring {
  k: number
  c: number
}

interface ReelMotion {
  pos: number
  vel: number
  phase: "rest" | "drag" | "glide" | "spring"
  /** Where a spring or a glide lands. */
  target: number
  spring: Spring
  /** Decay rate of the glide, per second. */
  rate: number
  /** Seconds to wait before moving, for the intro and quick pick stagger. */
  delay: number
}

interface ReelDrag {
  id: number
  y: number
  origin: number
  moved: boolean
  samples: { y: number; t: number }[]
}

class ReelEngine {
  config: Config | null = null
  motions: ReelMotion[] = []
  columns: (HTMLElement | null)[] = []
  base: (HTMLElement | null)[][] = []
  lens: (HTMLElement | null)[][] = []
  band: HTMLElement | null = null
  primary: HTMLElement | null = null
  secondary: HTMLElement | null = null
  row = 42
  speed = 1
  still = false
  visible = true
  hidden = false
  committed = Number.NaN
  anchor = DEFAULT_VALUE
  /** While the intro spins, the summary keeps showing the real value. */
  quiet = false
  introDone = false
  private introReady = false
  onCommit: (date: Date) => void = () => {}
  private raf = 0
  private last = 0
  private shown: number[] = []
  private texts = new WeakMap<HTMLElement, string>()
  private drags = new Map<number, ReelDrag>()
  private wheelTimers = new Map<number, number>()
  private wheelRest = new Map<number, number>()
  private typed = new Map<number, { text: string; at: number }>()
  private canvas: HTMLCanvasElement | null = null

  /** Places every reel on `date` when the reels themselves change (mode, range, locale). */
  setup(config: Config, date: Date) {
    const changed = this.config !== config
    this.config = config
    if (!changed) return
    if (Number.isNaN(this.committed)) {
      this.committed = date.getTime()
      this.anchor = date
    }
    this.motions = config
      .indicesOf(this.anchor)
      .map(index => ({ pos: index, vel: 0, phase: "rest", target: index, spring: SPRING_STEP, rate: GLIDE_SLOW, delay: 0 }))
    this.shown = []
    this.drawAll()
    this.refresh(true)
  }

  entry(reel: number) {
    const model = this.config!.reels[reel]
    const index = Math.round(this.motions[reel].pos)
    return model.cyclic ? mod(index, model.count) : clamp(index, 0, model.count - 1)
  }

  entries() {
    return this.motions.map((_, reel) => this.entry(reel))
  }

  now() {
    return this.config ? this.config.compose(this.entries(), this.anchor) : this.anchor
  }

  draw(reel: number) {
    const config = this.config
    const model = config?.reels[reel]
    const motion = this.motions[reel]
    if (!config || !model || !motion) return
    const entries = this.entries()
    const valid = (entry: number) => config.valid(reel, entry, entries)
    for (let slot = 0; slot < SLOTS; slot++) {
      const view = project(model, motion.pos, slot, valid)
      this.write(this.base[reel]?.[slot], view.text, view.transform, view.base)
      this.write(this.lens[reel]?.[slot], view.text, view.transform, view.lens)
    }
  }

  drawAll() {
    this.motions.forEach((_, reel) => this.draw(reel))
  }

  private write(node: HTMLElement | null | undefined, text: string, transform: string, opacity: string) {
    if (!node) return
    node.style.transform = transform
    node.style.opacity = opacity
    // Text is written only when a node shows a new entry, into the text node React made, so React stays in sync.
    if (this.texts.get(node) === text) return
    this.texts.set(node, text)
    this.setText(node, text)
  }

  private setText(node: HTMLElement | null, text: string) {
    if (!node) return
    const child = node.firstChild
    if (child && child.nodeType === Node.TEXT_NODE) child.nodeValue = text
    else node.textContent = text
  }

  /** Writes the summary as the reels turn, and redraws the day reel when the month or year makes days appear or vanish. */
  refresh(force = false) {
    const config = this.config
    if (!config) return
    const entries = this.entries()
    if (!force && entries.every((entry, reel) => entry === this.shown[reel])) return
    const previous = this.shown
    this.shown = entries
    const dateReel = config.reels.findIndex(reel => reel.kind === "date")
    if (dateReel >= 0 && entries.some((entry, reel) => reel !== dateReel && entry !== previous[reel])) this.draw(dateReel)
    if (this.quiet) return
    const summary = config.summary(config.compose(entries, this.anchor))
    this.setText(this.primary, summary.primary)
    this.setText(this.secondary, summary.secondary || " ")
  }

  /** The spoken value changes only when a reel rests, so a spinning reel never floods a screen reader. */
  syncAria(reel: number) {
    const column = this.columns[reel]
    const model = this.config?.reels[reel]
    if (!column || !model) return
    const entry = this.entry(reel)
    column.setAttribute("aria-valuetext", model.spoken(entry))
    column.setAttribute("aria-valuenow", String(entry))
  }

  kick() {
    if (this.raf || !this.visible || this.hidden || typeof window === "undefined") return
    this.raf = requestAnimationFrame(this.frame)
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    this.last = 0
    this.wheelTimers.forEach(timer => window.clearTimeout(timer))
    this.wheelTimers.clear()
  }

  private frame = (time: number) => {
    this.raf = 0
    // Off screen or in a hidden tab the loop sleeps; kick() resumes from wherever each reel was.
    if (!this.visible || this.hidden) {
      this.last = 0
      return
    }
    const dt = this.last ? Math.min(0.05, (time - this.last) / 1000) : 1 / 60
    this.last = time
    let moving = false
    this.motions.forEach((motion, reel) => {
      if (motion.phase !== "glide" && motion.phase !== "spring") return
      if (motion.delay > 0) {
        motion.delay -= dt
        moving = true
        return
      }
      this.step(motion, reel, dt)
      this.draw(reel)
      // step() may have brought the reel to rest.
      if ((motion.phase as ReelMotion["phase"]) === "rest") this.syncAria(reel)
      else moving = true
    })
    this.refresh()
    if (moving) this.raf = requestAnimationFrame(this.frame)
    else {
      this.last = 0
      this.settle()
    }
  }

  private step(motion: ReelMotion, reel: number, dt: number) {
    if (motion.phase === "glide") {
      // A plain exponential decay toward a whole entry: no spring phase, so it never overshoots.
      const remaining = (motion.target - motion.pos) * Math.exp(-motion.rate * this.speed * dt)
      motion.pos = motion.target - remaining
      motion.vel = remaining * motion.rate * this.speed
      if (Math.abs(remaining) < 0.01) this.land(motion, reel)
      return
    }
    // A damped spring, integrated in small steps so it behaves the same at any frame rate.
    const k = motion.spring.k * this.speed * this.speed
    const c = motion.spring.c * this.speed
    const steps = Math.ceil(dt / 0.002)
    const h = dt / steps
    for (let i = 0; i < steps; i++) {
      motion.vel += (-k * (motion.pos - motion.target) - c * motion.vel) * h
      motion.pos += motion.vel * h
    }
    if (Math.abs(motion.pos - motion.target) < 0.002 && Math.abs(motion.vel) < 0.02) this.land(motion, reel)
  }

  private land(motion: ReelMotion, reel: number) {
    const model = this.config!.reels[reel]
    // Cyclic reels drift back to the first lap so positions stay small.
    const lap = model.cyclic ? Math.floor(motion.target / model.count) * model.count : 0
    motion.target -= lap
    motion.pos = motion.target
    motion.vel = 0
    motion.phase = "rest"
  }

  /** Commits once every reel rests, after turning any impossible day back to a real one. */
  settle() {
    const config = this.config
    if (!config || this.motions.some(motion => motion.phase !== "rest") || this.wheelTimers.size) return
    const entries = this.entries()
    const fix = config.repair(entries, this.anchor)
    if (fix) {
      if ("reel" in fix) this.spinTo(fix.reel, fix.entry)
      else this.spinAll(fix.date)
      return
    }
    if (this.quiet) {
      this.quiet = false
      this.refresh(true)
    }
    const date = config.compose(entries, this.anchor)
    if (date.getTime() === this.committed) return
    this.committed = date.getTime()
    this.anchor = date
    this.onCommit(date)
  }

  /** Where the reel is heading: its spring or glide target, or the entry under the lens. */
  private heading(reel: number) {
    const motion = this.motions[reel]
    if (motion.phase === "spring" || motion.phase === "glide") return Math.round(motion.target)
    return Math.round(motion.pos)
  }

  private aim(reel: number, target: number, options: { delay?: number; spring?: Spring; rate?: number } = {}) {
    const motion = this.motions[reel]
    const model = this.config?.reels[reel]
    if (!motion || !model || motion.phase === "drag") return
    const next = model.cyclic ? target : clamp(target, 0, model.count - 1)
    motion.target = next
    if (this.still) {
      motion.pos = next
      motion.vel = 0
      motion.phase = "rest"
      motion.delay = 0
      this.draw(reel)
      this.syncAria(reel)
      this.refresh()
      return
    }
    if (options.rate) {
      motion.phase = "glide"
      motion.rate = options.rate
    } else {
      // Pressing again mid-spin moves the target; the spring keeps its velocity and adds to the motion.
      motion.phase = "spring"
      motion.spring = options.spring ?? SPRING_STEP
    }
    motion.delay = options.delay ?? 0
    this.kick()
  }

  spinBy(reel: number, delta: number) {
    this.aim(reel, this.heading(reel) + delta)
    if (this.still) this.settle()
  }

  spinTo(reel: number, entry: number, options: { delay?: number; spring?: Spring; rate?: number } = {}) {
    const model = this.config?.reels[reel]
    if (!model) return
    const heading = this.heading(reel)
    if (model.cyclic) {
      // The short way around.
      let delta = mod(entry - mod(heading, model.count), model.count)
      if (delta > model.count / 2) delta -= model.count
      this.aim(reel, heading + delta, options)
    } else this.aim(reel, entry, options)
    if (this.still) this.settle()
  }

  /** Spins every reel to `date` on the calmer spring; quick picks wait a beat and start one reel after another. */
  spinAll(date: Date, picked = false) {
    const config = this.config
    if (!config) return
    const indices = config.indicesOf(date)
    // Parts of the moment that have no reel (the time in date mode, the day in time mode) come along too.
    this.anchor = new Date(date)
    indices.forEach((index, reel) =>
      this.spinTo(reel, index, { spring: SPRING_PICK, delay: picked ? (PICK_DELAY + reel * PICK_STAGGER) / this.speed : 0 }),
    )
  }

  /** Before the picker is first seen, every reel waits a few entries back, ready to glide forward into place. */
  prepareIntro() {
    // Effects can run twice in development; the reels step away only once.
    if (this.introDone || this.introReady) return
    this.introReady = true
    this.motions.forEach((motion, reel) => {
      const model = this.config!.reels[reel]
      const away = model.kind === "period" ? 1 : model.kind === "minute" ? 9 : 7
      const back = motion.pos - away
      motion.target = motion.pos
      motion.pos = model.cyclic || back >= 0 ? back : Math.min(model.count - 1, motion.pos + away)
      motion.phase = "glide"
      motion.rate = GLIDE_FAST
      motion.delay = Number.POSITIVE_INFINITY
    })
    this.quiet = true
    this.drawAll()
  }

  startIntro() {
    if (this.introDone) return
    this.introDone = true
    this.motions.forEach(motion => {
      if (motion.delay === Number.POSITIVE_INFINITY) motion.delay = INTRO_DELAY / this.speed
    })
    this.kick()
  }

  dragStart(reel: number, id: number, y: number, time: number) {
    const motion = this.motions[reel]
    if (!motion) return
    motion.phase = "drag"
    motion.vel = 0
    motion.delay = 0
    this.drags.set(reel, { id, y, origin: motion.pos, moved: false, samples: [{ y, t: time }] })
  }

  dragMove(reel: number, id: number, y: number, time: number) {
    const drag = this.drags.get(reel)
    const motion = this.motions[reel]
    const model = this.config?.reels[reel]
    if (!drag || drag.id !== id || !motion || !model) return
    if (Math.abs(y - drag.y) >= TAP_SLOP) drag.moved = true
    // 1:1 in arc length from the first pixel; past the first or last entry it stretches like rubber.
    const raw = drag.origin + (drag.y - y) / this.row
    const last = model.count - 1
    motion.pos = model.cyclic ? raw : raw < 0 ? -rubberBand(-raw, RUBBER_D, RUBBER_C) : raw > last ? last + rubberBand(raw - last, RUBBER_D, RUBBER_C) : raw
    drag.samples.push({ y, t: time })
    if (drag.samples.length > 12) drag.samples.shift()
    this.draw(reel)
    this.refresh()
  }

  /** `offset` is the pointer's distance from the lens, for taps on neighbouring entries. */
  dragEnd(reel: number, id: number, time: number, offset: number, cancelled: boolean) {
    const drag = this.drags.get(reel)
    const motion = this.motions[reel]
    const model = this.config?.reels[reel]
    if (!drag || drag.id !== id || !motion || !model) return
    this.drags.delete(reel)
    motion.phase = "rest"
    if (!drag.moved) {
      // A tap turns to the entry under the pointer, found back through the cylinder's sine.
      const radius = RADIUS_ROWS * this.row
      const rows = cancelled ? 0 : Math.round((Math.asin(clamp(offset / radius, -1, 1)) * radius) / this.row)
      this.aim(reel, Math.round(drag.origin) + rows)
      if (this.still || motion.phase === "rest") this.settle()
      return
    }
    const recent = drag.samples.filter(sample => time - sample.t <= 100)
    const first = recent[0]
    const last = recent[recent.length - 1]
    const velocity =
      !cancelled && first && last && first !== last && time - last.t < 60 ? clamp((first.y - last.y) / this.row / ((last.t - first.t) / 1000), -60, 60) : 0
    this.release(reel, velocity)
  }

  private release(reel: number, velocity: number) {
    const motion = this.motions[reel]
    const model = this.config!.reels[reel]
    const last = model.count - 1
    if (this.still) {
      this.aim(reel, Math.round(motion.pos))
      this.settle()
      return
    }
    if (!model.cyclic && (motion.pos < 0 || motion.pos > last)) {
      // Past an end the rubber band springs back to the edge.
      motion.vel = velocity
      motion.phase = "spring"
      motion.spring = SPRING_BACK
      motion.target = motion.pos < 0 ? 0 : last
      this.kick()
      return
    }
    // Land on the entry nearest to where the flick would be after PROJECTION seconds, decaying straight into it.
    let to = Math.round(motion.pos + velocity * PROJECTION)
    if (!model.cyclic) to = clamp(to, 0, last)
    const fast = clamp((Math.abs(velocity) - GLIDE_SLOW_SPEED) / (GLIDE_FAST_SPEED - GLIDE_SLOW_SPEED), 0, 1)
    motion.phase = "glide"
    motion.target = to
    motion.rate = GLIDE_SLOW + (GLIDE_FAST - GLIDE_SLOW) * fast
    this.kick()
  }

  wheel(reel: number, delta: number) {
    const motion = this.motions[reel]
    const model = this.config?.reels[reel]
    if (!motion || !model || motion.phase === "drag") return
    if (this.still) {
      // Without motion, each row of scrolling turns one whole entry.
      const total = (this.wheelRest.get(reel) ?? 0) + delta / this.row
      const steps = Math.trunc(total)
      this.wheelRest.set(reel, total - steps)
      if (steps) this.spinBy(reel, steps)
      return
    }
    const from = motion.phase === "spring" || motion.phase === "glide" ? motion.target : motion.pos
    const next = from + delta / this.row
    motion.target = model.cyclic ? next : clamp(next, -0.3, model.count - 0.7)
    motion.phase = "spring"
    motion.spring = SPRING_STEP
    motion.delay = 0
    // Scrolling moves the target freely; once it pauses, the target snaps to a whole entry on the same spring.
    window.clearTimeout(this.wheelTimers.get(reel))
    this.wheelTimers.set(
      reel,
      window.setTimeout(() => {
        this.wheelTimers.delete(reel)
        if (motion.phase === "spring") motion.target = model.cyclic ? Math.round(motion.target) : clamp(Math.round(motion.target), 0, model.count - 1)
        if (motion.phase === "rest") this.aim(reel, Math.round(motion.pos))
        this.kick()
        this.settle()
      }, 110),
    )
    this.kick()
  }

  /** Home and End sweep through every entry between on a quick glide. */
  jump(reel: number, entry: number) {
    this.spinTo(reel, entry, { rate: GLIDE_JUMP })
  }

  type(reel: number, key: string, time: number) {
    const model = this.config?.reels[reel]
    if (!model) return
    const previous = this.typed.get(reel)
    let text = (previous && time - previous.at < 900 ? previous.text : "") + key.toLocaleLowerCase()
    const from = mod(this.heading(reel), model.count)
    let hit = model.match(text, from)
    if (hit === null && text.length > 1) {
      text = key.toLocaleLowerCase()
      hit = model.match(text, from)
    }
    this.typed.set(reel, { text, at: time })
    if (hit !== null) this.spinTo(reel, hit)
  }

  /** Each reel is as wide as its widest entry in the lens font, plus its side padding. */
  measure() {
    const config = this.config
    if (!config || typeof document === "undefined") return
    if (this.band?.offsetHeight) this.row = this.band.offsetHeight
    this.canvas ??= document.createElement("canvas")
    const context = this.canvas.getContext("2d")
    if (!context) return
    config.reels.forEach((model, reel) => {
      const column = this.columns[reel]
      const sample = this.lens[reel]?.[HALF]
      if (!column || !sample) return
      const style = getComputedStyle(sample)
      const box = getComputedStyle(column)
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      let widest = 0
      // Canvas has no tabular figures, so every digit is measured as a zero, the widest of them.
      for (let entry = 0; entry < model.count; entry++) widest = Math.max(widest, context.measureText(model.label(entry).replace(/\d/g, "0")).width)
      const padding = parseFloat(box.paddingLeft) + parseFloat(box.paddingRight)
      column.style.width = `${Math.ceil(widest + padding)}px`
    })
  }
}

/* ---------------------------------------------------------------------------------------------------------------
   The component.
   --------------------------------------------------------------------------------------------------------------- */

const at = (today: Date, days: number, hours: number, minutes = 0) =>
  new Date(today.getFullYear(), today.getMonth(), today.getDate() + days, hours, minutes)

function defaultShortcuts(locale: string): TimeWheelShortcut[] {
  // Sep 26, 2026 is a Saturday; only its weekday name is used.
  const saturday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date(2026, 8, 26))
  return [
    { label: "After lunch", value: today => at(today, 0, 13, 30) },
    { label: "Early tomorrow", value: today => at(today, 1, 8) },
    { label: capitalize(saturday), value: today => at(today, ((6 - today.getDay() + 7) % 7) || 7, 10) },
  ]
}

type ConfirmState = "idle" | "pending" | "success" | "failure"

const lensClip = "inset(calc(50% - var(--reel-row) / 2) 0 calc(50% - var(--reel-row) / 2) 0)"
const baseMask =
  "linear-gradient(to bottom, #000 calc(50% - var(--reel-row) / 2), transparent calc(50% - var(--reel-row) / 2), transparent calc(50% + var(--reel-row) / 2), #000 calc(50% + var(--reel-row) / 2))" // token-audit-ignore: mask colors, only alpha matters
/** Nodes sit at the vertical center; the engine moves them along the cylinder with translateY and scale. */
const slotClass = "absolute inset-x-0 top-[calc(50%-var(--reel-row)/2)] block h-(--reel-row) leading-(--reel-row) whitespace-nowrap tabular-nums will-change-transform"
/** The stage fades its top and bottom quarter so the drum turns away into the card. */
const stageMask = "linear-gradient(transparent, #000 24%, #000 76%, transparent)"
const alignClass = { start: "text-left", center: "text-center", end: "text-right" } as const

/** Date and time wheels that turn like a drum, with momentum, snapping and keyboard control. */
export function TimeWheel({
  mode = "datetime",
  value,
  defaultValue,
  onChange,
  today: todayProp,
  minDate,
  maxDate,
  minuteInterval = 5,
  clock = 12,
  locale = "en-US",
  shortcuts,
  heading,
  onCommit,
  copy,
  spinIn = true,
  speed = 1,
  paused = false,
  accent,
  label = "Moment picker",
  className,
  style,
}: TimeWheelProps) {
  const reduced = useReducedMotion() ?? false
  const motionTokens = useMotionTokens()
  const [first] = useState(() => normalize(value ?? defaultValue ?? DEFAULT_VALUE, minuteInterval))
  const [inner, setInner] = useState(first)
  const valueTime = value ? normalize(value, minuteInterval).getTime() : undefined
  const current = useMemo(() => (valueTime === undefined ? inner : new Date(valueTime)), [inner, valueTime])
  const todayTime = startOfDay(todayProp ?? first).getTime()
  const minTime = minDate?.getTime()
  const maxTime = maxDate?.getTime()
  const copyKey = JSON.stringify(copy ?? {})
  const words = useMemo<Required<TimeWheelCopy>>(() => ({ ...DEFAULT_COPY, ...(JSON.parse(copyKey) as TimeWheelCopy) }), [copyKey])
  const config = useMemo(
    () =>
      buildConfig({
        mode,
        today: new Date(todayTime),
        minDate: minTime === undefined ? undefined : new Date(minTime),
        maxDate: maxTime === undefined ? undefined : new Date(maxTime),
        step: minuteInterval,
        clock,
        locale,
        labels: words,
      }),
    [clock, locale, maxTime, minTime, minuteInterval, mode, todayTime, words],
  )
  const engineRef = useRef<ReelEngine | null>(null)
  if (engineRef.current === null) engineRef.current = new ReelEngine()
  /** The engine is an imperative object that lives outside React's render; it is only touched from effects and events. */
  const reels = () => engineRef.current!
  const rootRef = useRef<HTMLDivElement>(null)
  const [announcement, setAnnouncement] = useState("")
  const [status, setStatus] = useState<ConfirmState>("idle")
  const statusTimer = useRef(0)

  // The drawn slots are rendered once from the first value; afterwards only the engine writes to them.
  const layout = useMemo(() => {
    const entries = config.indicesOf(first)
    return config.reels.map((reel, index) =>
      Array.from({ length: SLOTS }, (_, slot) => project(reel, entries[index], slot, entry => config.valid(index, entry, entries))),
    )
  }, [config, first])
  const firstSummary = useMemo(() => config.summary(first), [config, first])
  const currentIndices = config.indicesOf(current)

  useLayoutEffect(() => {
    reels().speed = Math.max(0.05, speed)
    reels().still = paused || reduced
    reels().onCommit = date => {
      if (valueTime === undefined) setInner(date)
      onChange?.(date)
      setAnnouncement(config.summary(date).spoken)
      // A new moment clears a finished confirmation, so the button offers to confirm again.
      setStatus(previous => (previous === "pending" ? previous : "idle"))
    }
  })

  useLayoutEffect(() => {
    reels().setup(config, first)
    reels().measure()
    reels().settle()
  }, [config, first])

  // A value changed from outside spins every reel to it; one the reels just committed is already there.
  useLayoutEffect(() => {
    if (valueTime === undefined || valueTime === reels().committed) return
    reels().committed = valueTime
    reels().spinAll(new Date(valueTime))
  }, [valueTime])

  // Width and row height follow the container query and the loaded font.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    reels().measure()
    let cancelled = false
    document.fonts?.ready.then(() => {
      if (!cancelled) reels().measure()
    })
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => reels().measure())
    observer.observe(root)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [])

  // The intro waits off to one side until the picker is first seen. The loop sleeps off screen and in hidden tabs.
  const introOn = spinIn && !reduced && !paused
  useLayoutEffect(() => {
    if (introOn) reels().prepareIntro()
  }, [introOn])
  useEffect(() => {
    const root = rootRef.current
    const onVisibility = () => {
      reels().hidden = document.visibilityState === "hidden"
      reels().kick()
    }
    document.addEventListener("visibilitychange", onVisibility)
    const show = () => {
      reels().visible = true
      if (introOn) reels().startIntro()
      reels().kick()
    }
    if (!root || typeof IntersectionObserver === "undefined") {
      show()
      return () => document.removeEventListener("visibilitychange", onVisibility)
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) show()
      else reels().visible = false
    })
    observer.observe(root)
    return () => {
      observer.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [introOn])

  // Paused or reduced motion: anything mid-spin lands at once.
  useEffect(() => {
    if (!(paused || reduced)) return
    reels().motions.forEach((motion, reel) => {
      if (motion.phase === "spring" || motion.phase === "glide") reels().spinBy(reel, 0)
    })
  }, [paused, reduced])

  useEffect(
    () => () => {
      reels().stop()
      window.clearTimeout(statusTimer.current)
    },
    [],
  )

  // Wheel scrolling turns the reel under the pointer; non-passive so the page does not scroll with it.
  const reelCount = config.reels.length
  useEffect(() => {
    const columns = reels().columns.slice(0, reelCount)
    const listeners = columns.map((column, reel) => {
      if (!column) return null
      const listener = (event: WheelEvent) => {
        if (event.ctrlKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return
        event.preventDefault()
        const delta = event.deltaMode === 1 ? event.deltaY * reels().row : event.deltaMode === 2 ? event.deltaY * reels().row * 5 : event.deltaY
        reels().wheel(reel, delta)
      }
      column.addEventListener("wheel", listener, { passive: false })
      return () => column.removeEventListener("wheel", listener)
    })
    return () => listeners.forEach(off => off?.())
  }, [config, reelCount])

  const onKeyDown = (reel: number) => (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const model = config.reels[reel]
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const focus = (next: number) => reels().columns[clamp(next, 0, reelCount - 1)]?.focus()
    const actions: Record<string, () => void> = {
      ArrowUp: () => reels().spinBy(reel, 1),
      ArrowDown: () => reels().spinBy(reel, -1),
      PageUp: () => reels().spinBy(reel, model.page),
      PageDown: () => reels().spinBy(reel, -model.page),
      Home: () => reels().jump(reel, 0),
      End: () => reels().jump(reel, model.count - 1),
      ArrowLeft: () => focus(reel - 1),
      ArrowRight: () => focus(reel + 1),
    }
    const action = actions[event.key]
    if (action) {
      event.preventDefault()
      action()
      return
    }
    if (event.key.length === 1 && /[\p{L}\p{N}]/u.test(event.key)) {
      event.preventDefault()
      reels().type(reel, event.key, event.timeStamp)
    }
  }

  const onPointerDown = (reel: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* The pointer is already gone. */
    }
    reels().dragStart(reel, event.pointerId, event.clientY, event.timeStamp)
  }
  const onPointerMove = (reel: number) => (event: ReactPointerEvent<HTMLDivElement>) => reels().dragMove(reel, event.pointerId, event.clientY, event.timeStamp)
  const onPointerEnd = (reel: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    reels().dragEnd(reel, event.pointerId, event.timeStamp, event.clientY - (box.top + box.height / 2), event.type === "pointercancel")
  }

  const picks = shortcuts === false ? [] : (shortcuts ?? defaultShortcuts(locale))
  const today = config.today
  const resolve = (shortcut: TimeWheelShortcut) => normalize(typeof shortcut.value === "function" ? shortcut.value(new Date(today)) : shortcut.value, minuteInterval)
  const matches = (date: Date) => config.indicesOf(date).every((index, reel) => index === currentIndices[reel])

  const busy = useRef(false)
  const confirm = async () => {
    if (!onCommit || busy.current) return
    busy.current = true
    window.clearTimeout(statusTimer.current)
    const date = reels().now()
    const finish = (next: ConfirmState, words: string) => {
      window.clearTimeout(statusTimer.current)
      setStatus(next)
      setAnnouncement(words)
    }
    try {
      const result = onCommit(date)
      if (result && typeof (result as Promise<void>).then === "function") {
        // Pending shows only when the promise takes a moment, so a quick save goes straight to done.
        statusTimer.current = window.setTimeout(() => setStatus("pending"), PENDING_DELAY)
        await result
      }
      finish("success", `${wordsFor("success")}. ${config.summary(date).spoken}`)
    } catch {
      finish("failure", wordsFor("failure"))
    } finally {
      busy.current = false
    }
  }
  const wordsFor = (state: ConfirmState) =>
    state === "pending" ? words.committing : state === "success" ? words.committed : state === "failure" ? words.failed : words.commit

  // Labels roll 4px and fade in place; hidden labels keep the same resting values either way, so server and client render alike.
  const swap = reduced
    ? { duration: motionTokens.duration.fast, y: { duration: 0 } }
    : { duration: motionTokens.duration.fast, ease: [...staticTokens.ease.enter] as [number, number, number, number] }

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label}
      className={cn("@container w-full rounded-surface border border-border bg-surface text-foreground", className)}
      style={{
        ...style,
        ["--reel-accent" as string]: accent ?? "var(--accent)",
        ["--reel-accent-strong" as string]: accent ? `color-mix(in oklab, ${accent}, var(--foreground))` : "var(--accent-strong)",
      }}
    >
      <div
        className={cn(
          "grid gap-4 p-4 @[26rem]:p-6",
          "[--reel-row:36px] [--reel-pad:8px] @[26rem]:[--reel-row:42px] @[26rem]:[--reel-pad:12px]",
        )}
      >
        {/* The visual summary is hidden from assistive technology; the live region below speaks the committed moment. */}
        <div aria-hidden="true" className="grid gap-1 px-1">
          {heading ? <p className="m-0 text-sm leading-[1.1] tracking-[-0.03em] text-text-secondary">{heading}</p> : null}
          <p ref={node => void (reels().primary = node)} className="m-0 truncate text-[22px] leading-[1.25] font-medium tabular-nums">
            {firstSummary.primary}
          </p>
          {mode === "time" ? null : (
            <p ref={node => void (reels().secondary = node)} className="m-0 truncate text-sm leading-[1.4] text-text-secondary">
              {firstSummary.secondary || " "}
            </p>
          )}
        </div>

        <div
          className="relative flex h-[calc(var(--reel-row)*5.6)] items-stretch justify-center overflow-hidden text-[18px] @[26rem]:text-[22px] supports-[overflow:clip]:overflow-clip"
          style={{ maskImage: stageMask, WebkitMaskImage: stageMask }}
        >
          {/* One glass lens spans the full width under every reel. */}
          <span
            ref={node => void (reels().band = node)}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-0 top-1/2 h-(--reel-row) -translate-y-1/2 rounded-[12px]",
              "bg-[color-mix(in_oklab,var(--surface-muted)_92%,transparent)] dark:bg-[color-mix(in_oklab,var(--surface-raised)_88%,transparent)]",
              "shadow-[inset_0_0_0_1px_var(--border),inset_0_1px_0_color-mix(in_oklab,var(--background)_70%,transparent),var(--shadow-resting)]",
              "dark:shadow-[inset_0_0_0_1px_var(--border),inset_0_1px_0_color-mix(in_oklab,var(--foreground)_6%,transparent),var(--shadow-resting)]",
            )}
          />
          {config.reels.map((reel, index) => (
            <div
              key={`${reel.kind}-${index}`}
              ref={node => void (reels().columns[index] = node)}
              role="spinbutton"
              tabIndex={0}
              aria-label={reel.name}
              aria-valuemin={0}
              aria-valuemax={reel.count - 1}
              aria-valuenow={currentIndices[index]}
              aria-valuetext={reel.spoken(currentIndices[index])}
              className="group/reel relative h-full flex-none cursor-grab touch-pan-x px-(--reel-pad) outline-none select-none active:cursor-grabbing"
              style={{
                width: `calc(${Math.max(...Array.from({ length: Math.min(reel.count, 40) }, (_, entry) => reel.label(entry).length)) * 0.56}em + var(--reel-pad) * 2)`,
              }}
              onKeyDown={onKeyDown(index)}
              onPointerDown={onPointerDown(index)}
              onPointerMove={onPointerMove(index)}
              onPointerUp={onPointerEnd(index)}
              onPointerCancel={onPointerEnd(index)}
            >
              {/* The drum in the secondary ink everywhere but the lens. */}
              <div aria-hidden="true" className="absolute inset-y-0 inset-x-(--reel-pad) text-text-secondary" style={{ maskImage: baseMask, WebkitMaskImage: baseMask }}>
                {layout[index]?.map((slot, at) => (
                  <span
                    key={at}
                    ref={node => {
                      ;(reels().base[index] ??= [])[at] = node
                    }}
                    className={cn(slotClass, alignClass[reel.align])}
                    style={{ transform: slot.transform, opacity: slot.base }}
                  >
                    {slot.text}
                  </span>
                ))}
              </div>
              {/* A crisp copy clipped to the lens; a keyboard-focused reel shows its entry in the accent. */}
              <div
                aria-hidden="true"
                className="absolute inset-y-0 inset-x-(--reel-pad) font-medium text-foreground transition-colors duration-160 ease-standard group-focus-visible/reel:text-(--reel-accent) motion-reduce:transition-none"
                style={{ clipPath: lensClip }}
              >
                {layout[index]?.map((slot, at) => (
                  <span
                    key={at}
                    ref={node => {
                      ;(reels().lens[index] ??= [])[at] = node
                    }}
                    className={cn(slotClass, alignClass[reel.align])}
                    style={{ transform: slot.transform, opacity: slot.lens }}
                  >
                    {slot.text}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {picks.length || onCommit ? (
          <div className="flex flex-col gap-3 border-t border-border pt-4 @[26rem]:flex-row @[26rem]:items-center @[26rem]:justify-between">
            {picks.length ? (
              <div role="group" aria-label={words.shortcuts} className="flex flex-wrap gap-2">
                {picks.map(preset => {
                  const date = resolve(preset)
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      aria-pressed={matches(date)}
                      className={cn(
                        "inline-flex h-9 grow cursor-pointer items-center justify-center rounded-pill border border-border bg-transparent px-3 text-sm leading-body text-text-secondary outline-none @[26rem]:grow-0 [-webkit-tap-highlight-color:transparent]",
                        "transition-[color,background-color,border-color] duration-160 ease-standard motion-reduce:transition-none",
                        "pointer-fine:hover:not-aria-pressed:bg-surface-muted pointer-fine:hover:not-aria-pressed:text-foreground focus-visible:not-aria-pressed:bg-surface-muted focus-visible:not-aria-pressed:text-foreground",
                        "aria-pressed:border-[color-mix(in_oklab,var(--reel-accent)_38%,transparent)] aria-pressed:bg-[color-mix(in_oklab,var(--reel-accent)_10%,transparent)] aria-pressed:text-(--reel-accent)",
                      )}
                      onClick={() => reels().spinAll(date, true)}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
            ) : null}
            {onCommit ? (
              <button
                type="button"
                aria-disabled={status === "pending" || undefined}
                aria-busy={status === "pending" || undefined}
                className={cn(
                  "grid h-11 w-full cursor-pointer place-items-center rounded-pill bg-(--reel-accent) px-7 text-sm leading-body font-medium whitespace-nowrap text-accent-foreground outline-none @[26rem]:h-9 @[26rem]:w-auto [-webkit-tap-highlight-color:transparent]",
                  "transition-[background-color] duration-160 ease-standard aria-busy:cursor-progress motion-reduce:transition-none",
                  "pointer-fine:hover:bg-(--reel-accent-strong) focus-visible:bg-(--reel-accent-strong) aria-busy:bg-(--reel-accent-strong)",
                )}
                onClick={confirm}
              >
                {/* Every state shares one grid cell, so the button keeps the width of its longest label. */}
                {(["idle", "pending", "success", "failure"] as const).map(state => (
                  <motion.span
                    key={state}
                    aria-hidden={state === status ? undefined : true}
                    className="col-start-1 row-start-1"
                    initial={false}
                    animate={state === status ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
                    transition={swap}
                  >
                    {wordsFor(state)}
                  </motion.span>
                ))}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}

export default TimeWheel
