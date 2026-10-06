"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react"
import { motion, useReducedMotion } from "motion/react"

import { buttonVariants } from "@/components/ui/button"
import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

export type DateReelMode = "datetime" | "date" | "time"

export interface DateReelLabels {
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
  /** Joins the day and the time in the summary, as in "Tomorrow at 9:00 AM". */
  at?: string
  /** Name of the quick picks group. */
  presets?: string
  confirm?: string
  confirming?: string
  confirmed?: string
  failed?: string
}

export interface DateReelPreset {
  label: string
  value: Date | ((today: Date) => Date)
}

export interface DateReelProps {
  /** Which reels to show: day, hour, minute and AM or PM; month, day and year; or time only. */
  mode?: DateReelMode
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
  minuteStep?: 1 | 5 | 10 | 15 | 30
  /** 12 hour clock with an AM or PM reel, or a 24 hour clock. */
  hourCycle?: 12 | 24
  /** BCP 47 locale for names, the time format, the AM and PM words and relative phrases. */
  locale?: string
  /** Quick picks under the reels. false hides them. */
  presets?: DateReelPreset[] | false
  /** Optional heading above the summary. */
  title?: string
  /** Adds a primary button. Return a promise to show pending, success and failure in place. */
  onConfirm?: (value: Date) => void | Promise<void>
  /** Words for localization. */
  labels?: DateReelLabels
  /** Spins the reels into place, one after another, the first time the picker scrolls into view. */
  intro?: boolean
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
   Geometry. Entries sit on a cylinder STEP degrees apart; eleven slots cover the visible half turn.
   --------------------------------------------------------------------------------------------------------------- */

const SLOTS = 11
const HALF = (SLOTS - 1) / 2
const STEP = 18
/** Cylinder radius in rows, so neighbouring entries at the front sit exactly one row apart. */
const RADIUS_ROWS = 1 / (2 * Math.sin((STEP * Math.PI) / 360))
/** Seconds of momentum a flick carries before it lands (iOS-like deceleration). */
const GLIDE = 0.4
/** Critically damped: the same settle time as the smooth token, never overshooting on its own. */
const OMEGA = (2 * Math.PI) / (motionTokens.spring.smooth.visualDuration * 1.2)
/** Entries a drag can stretch past either end. */
const STRETCH = 1.4
const STAGGER = motionTokens.stagger.line
const DEFAULT_VALUE = new Date(2026, 8, 24, 9, 30)
const DAY = 86_400_000

const DEFAULT_LABELS: Required<DateReelLabels> = {
  day: "Day",
  month: "Month",
  date: "Day",
  year: "Year",
  hour: "Hour",
  minute: "Minute",
  period: "AM or PM",
  at: "at",
  presets: "Quick picks",
  confirm: "Confirm",
  confirming: "Saving",
  confirmed: "Saved",
  failed: "Try again",
}

const mod = (value: number, count: number) => ((value % count) + count) % count
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
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
const rubber = (distance: number) => (1 - 1 / ((distance * 0.55) / STRETCH + 1)) * STRETCH

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
  mode: DateReelMode
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
  mode: DateReelMode
  today: Date
  minDate?: Date
  maxDate?: Date
  step: number
  hourCycle: 12 | 24
  locale: string
  labels: Required<DateReelLabels>
}): Config {
  const { mode, today, step, hourCycle, locale, labels } = options
  const minDay = startOfDay(options.minDate ?? (mode === "date" ? addYears(today, -100) : addDays(today, -30)))
  const maxDay = startOfDay(options.maxDate ?? (mode === "date" ? addYears(today, 10) : addYears(today, 1)))
  const minYear = minDay.getFullYear()
  const twelve = hourCycle === 12
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", hourCycle: twelve ? "h12" : "h23" })
  const dayShort = new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" })
  const dayLong = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" })
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
        label: entry => (isToday(entry) ? relativeDay(dateOf(entry)) : dayShort.format(dateOf(entry)).replace(/,/g, "")),
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
    const primary = `${relativeDay(date)} ${labels.at} ${time}`
    const secondary = dayLong.format(date)
    return { primary, secondary, spoken: `${primary}, ${secondary}` }
  }

  return { mode, reels, today, minDay, maxDay, indicesOf, compose, valid, repair, summary }
}

/** One slot's text, transform and opacities for a reel resting at `pos`. Shared by the first render and the loop. */
function project(reel: Reel, pos: number, slot: number, valid: (entry: number) => boolean) {
  const at = Math.round(pos) + slot - HALF
  const angle = (at - pos) * STEP
  const inRange = reel.cyclic || (at >= 0 && at < reel.count)
  const entry = reel.cyclic ? mod(at, reel.count) : at
  const facing = Math.abs(angle) < 90 ? Math.cos((angle * Math.PI) / 180) : 0
  const dim = inRange && !valid(entry) ? 0.32 : 1
  return {
    text: inRange ? reel.label(entry) : " ",
    // Entries rise on a sine and compress with the cosine of their angle; perspective does the rest.
    transform: `translateY(-50%) rotateX(${(-angle).toFixed(3)}deg) translateZ(var(--reel-radius))`,
    base: inRange ? (facing ** 1.5 * dim).toFixed(3) : "0",
    lens: inRange && facing > 0 ? dim.toFixed(3) : "0",
  }
}

/* ---------------------------------------------------------------------------------------------------------------
   The engine: one requestAnimationFrame loop for every reel, writing straight to recycled nodes.
   --------------------------------------------------------------------------------------------------------------- */

interface ReelMotion {
  pos: number
  vel: number
  phase: "rest" | "drag" | "glide" | "spring"
  target: number
  glide: { from: number; to: number; tau: number; t: number } | null
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
  row = 36
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
    this.motions = config.indicesOf(this.anchor).map(index => ({ pos: index, vel: 0, phase: "rest", target: index, glide: null, delay: 0 }))
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
    this.setText(this.secondary, summary.secondary || " ")
  }

  /** The spoken value changes only when a reel rests, so a spinning reel never floods a screen reader. */
  syncAria(reel: number) {
    const column = this.columns[reel]
    const model = this.config?.reels[reel]
    if (!column || !model) return
    const entry = this.entry(reel)
    column.setAttribute("aria-valuetext", model.spoken(entry))
    column.setAttribute("aria-valuenow", String(model.numeric(entry)))
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
    if (motion.phase === "glide" && motion.glide) {
      // An exponential glide solved to land exactly on an entry; the last half row goes to the spring.
      const glide = motion.glide
      glide.t += dt
      const decay = Math.exp(-glide.t / glide.tau)
      motion.pos = glide.from + (glide.to - glide.from) * (1 - decay)
      motion.vel = ((glide.to - glide.from) / glide.tau) * decay
      if (Math.abs(glide.to - motion.pos) <= 0.5) {
        motion.phase = "spring"
        motion.target = glide.to
        motion.glide = null
      }
      return
    }
    // A critically damped spring, solved exactly for this frame so it behaves the same at any frame rate.
    const omega = OMEGA * this.speed
    const offset = motion.pos - motion.target
    const decay = Math.exp(-omega * dt)
    const next = (offset + (motion.vel + omega * offset) * dt) * decay
    motion.vel = (motion.vel - omega * (motion.vel + omega * offset) * dt) * decay
    motion.pos = motion.target + next
    if (Math.abs(next) < 0.004 && Math.abs(motion.vel) < 0.05) {
      const model = this.config!.reels[reel]
      // Cyclic reels drift back to the first lap so positions stay small.
      const lap = model.cyclic ? Math.floor(motion.target / model.count) * model.count : 0
      motion.target -= lap
      motion.pos = motion.target
      motion.vel = 0
      motion.phase = "rest"
    }
  }

  /** Commits once every reel rests, after turning any impossible day back to a real one. */
  settle() {
    const config = this.config
    if (!config || this.motions.some(motion => motion.phase !== "rest") || this.wheelTimers.size) return
    const entries = this.entries()
    const fix = config.repair(entries, this.anchor)
    if (fix) {
      if ("reel" in fix) this.spinTo(fix.reel, fix.entry)
      else this.spinAll(fix.date, 0)
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
    if (motion.phase === "spring") return Math.round(motion.target)
    if (motion.phase === "glide" && motion.glide) return motion.glide.to
    return Math.round(motion.pos)
  }

  private aim(reel: number, target: number, delay = 0) {
    const motion = this.motions[reel]
    const model = this.config?.reels[reel]
    if (!motion || !model || motion.phase === "drag") return
    const next = model.cyclic ? target : clamp(target, 0, model.count - 1)
    motion.glide = null
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
    // Pressing again mid-spin moves the target; the spring keeps its velocity and adds to the motion.
    motion.phase = "spring"
    motion.delay = delay
    this.kick()
  }

  spinBy(reel: number, delta: number) {
    this.aim(reel, this.heading(reel) + delta)
    if (this.still) this.settle()
  }

  spinTo(reel: number, entry: number, delay = 0) {
    const model = this.config?.reels[reel]
    if (!model) return
    const heading = this.heading(reel)
    if (model.cyclic) {
      // The short way around.
      let delta = mod(entry - mod(heading, model.count), model.count)
      if (delta > model.count / 2) delta -= model.count
      this.aim(reel, heading + delta, delay)
    } else this.aim(reel, entry, delay)
    if (this.still) this.settle()
  }

  spinAll(date: Date, stagger: number) {
    const config = this.config
    if (!config) return
    const indices = config.indicesOf(date)
    // Parts of the moment that have no reel (the time in date mode, the day in time mode) come along too.
    this.anchor = new Date(date)
    indices.forEach((index, reel) => this.spinTo(reel, index, (reel * stagger) / this.speed))
  }

  /** Before the picker is first seen, every reel waits a few entries away, ready to spin in. */
  prepareIntro() {
    // Effects can run twice in development; the reels step away only once.
    if (this.introDone || this.introReady) return
    this.introReady = true
    this.motions.forEach((motion, reel) => {
      const model = this.config!.reels[reel]
      const away = model.cyclic ? motion.pos - 4 : motion.pos - 4 >= 0 ? motion.pos - 4 : Math.min(model.count - 1, motion.pos + 4)
      motion.target = motion.pos
      motion.pos = away
      motion.phase = "spring"
      motion.delay = Number.POSITIVE_INFINITY
    })
    this.quiet = true
    this.drawAll()
  }

  startIntro() {
    if (this.introDone) return
    this.introDone = true
    this.motions.forEach((motion, reel) => {
      if (motion.delay === Number.POSITIVE_INFINITY) motion.delay = (reel * STAGGER * 1.5) / this.speed
    })
    this.kick()
  }

  dragStart(reel: number, id: number, y: number, time: number) {
    const motion = this.motions[reel]
    if (!motion) return
    motion.phase = "drag"
    motion.glide = null
    motion.vel = 0
    motion.delay = 0
    this.drags.set(reel, { id, y, origin: motion.pos, moved: false, samples: [{ y, t: time }] })
  }

  dragMove(reel: number, id: number, y: number, time: number) {
    const drag = this.drags.get(reel)
    const motion = this.motions[reel]
    const model = this.config?.reels[reel]
    if (!drag || drag.id !== id || !motion || !model) return
    if (!drag.moved && Math.abs(y - drag.y) < 4) return
    if (!drag.moved) {
      // Re-anchor past the slop so the reel does not jump by it.
      drag.moved = true
      drag.y = y
    }
    const raw = drag.origin + (drag.y - y) / this.row
    const last = model.count - 1
    // 1:1 inside the reel; past the first or last entry it stretches like rubber.
    motion.pos = model.cyclic ? raw : raw < 0 ? -rubber(-raw) : raw > last ? last + rubber(raw - last) : raw
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
      const sine = clamp(offset / (this.row * RADIUS_ROWS), -1, 1)
      const steps = cancelled ? 0 : Math.round((Math.asin(sine) * 180) / Math.PI / STEP)
      this.aim(reel, Math.round(motion.pos) + steps)
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
    motion.vel = velocity
    const outside = !model.cyclic && (motion.pos < 0 || motion.pos > last)
    const nearest = model.cyclic ? Math.round(motion.pos) : clamp(Math.round(motion.pos), 0, last)
    if (outside || Math.abs(velocity) < 0.8) {
      // Past an end, or barely moving: the spring bounces back or snaps to the nearest entry.
      motion.phase = "spring"
      motion.target = nearest
      this.kick()
      return
    }
    // Project the flick, land on a whole entry, and solve the glide's time constant so it starts at the flick's speed.
    let to = Math.round(motion.pos + velocity * (GLIDE / this.speed))
    if (!model.cyclic) to = clamp(to, 0, last)
    const tau = (to - motion.pos) / velocity
    if (tau > 0.06 && tau < 2) {
      motion.phase = "glide"
      motion.glide = { from: motion.pos, to, tau, t: 0 }
    } else {
      motion.phase = "spring"
      motion.target = to
    }
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
    const from = motion.phase === "spring" ? motion.target : motion.phase === "glide" && motion.glide ? motion.glide.to : motion.pos
    const next = from + delta / this.row
    motion.target = model.cyclic ? next : clamp(next, -0.3, model.count - 0.7)
    motion.phase = "spring"
    motion.glide = null
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

  /** Each reel is as wide as its widest entry in the lens font. */
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
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      let widest = 0
      for (let entry = 0; entry < model.count; entry++) widest = Math.max(widest, context.measureText(model.label(entry)).width)
      column.style.width = `${Math.ceil(widest + 2)}px`
    })
  }
}

/* ---------------------------------------------------------------------------------------------------------------
   The component.
   --------------------------------------------------------------------------------------------------------------- */

const at = (today: Date, days: number, hours: number, minutes = 0) =>
  new Date(today.getFullYear(), today.getMonth(), today.getDate() + days, hours, minutes)

function defaultPresets(locale: string): DateReelPreset[] {
  // Sep 28, 2026 is a Monday; only its weekday name is used.
  const monday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date(2026, 8, 28))
  return [
    { label: "This evening", value: today => at(today, 0, 18) },
    { label: "Tomorrow", value: today => at(today, 1, 9) },
    { label: capitalize(monday), value: today => at(today, ((1 - today.getDay() + 7) % 7) || 7, 9) },
  ]
}

type ConfirmState = "idle" | "pending" | "success" | "failure"

const lensClip = "inset(calc(50% - var(--reel-row) / 2) 0 calc(50% - var(--reel-row) / 2) 0)"
const baseMask =
  "linear-gradient(to bottom, #000 calc(50% - var(--reel-row) / 2), transparent calc(50% - var(--reel-row) / 2), transparent calc(50% + var(--reel-row) / 2), #000 calc(50% + var(--reel-row) / 2))"
const slotClass =
  "absolute inset-x-0 top-1/2 block h-(--reel-row) leading-(--reel-row) whitespace-nowrap tabular-nums [backface-visibility:hidden] will-change-transform"
const alignClass = { start: "text-left", center: "text-center", end: "text-right" } as const

/** A 3D reel date and time picker, like the wheels on a phone. */
export function DateReel({
  mode = "datetime",
  value,
  defaultValue,
  onChange,
  today: todayProp,
  minDate,
  maxDate,
  minuteStep = 5,
  hourCycle = 12,
  locale = "en-US",
  presets,
  title,
  onConfirm,
  labels,
  intro = true,
  speed = 1,
  paused = false,
  accent,
  label = "Date and time",
  className,
  style,
}: DateReelProps) {
  const reduced = useReducedMotion() ?? false
  const [first] = useState(() => normalize(value ?? defaultValue ?? DEFAULT_VALUE, minuteStep))
  const [inner, setInner] = useState(first)
  const valueTime = value ? normalize(value, minuteStep).getTime() : undefined
  const current = useMemo(() => (valueTime === undefined ? inner : new Date(valueTime)), [inner, valueTime])
  const todayTime = startOfDay(todayProp ?? first).getTime()
  const minTime = minDate?.getTime()
  const maxTime = maxDate?.getTime()
  const labelsKey = JSON.stringify(labels ?? {})
  const words = useMemo<Required<DateReelLabels>>(() => ({ ...DEFAULT_LABELS, ...(JSON.parse(labelsKey) as DateReelLabels) }), [labelsKey])
  const config = useMemo(
    () =>
      buildConfig({
        mode,
        today: new Date(todayTime),
        minDate: minTime === undefined ? undefined : new Date(minTime),
        maxDate: maxTime === undefined ? undefined : new Date(maxTime),
        step: minuteStep,
        hourCycle,
        locale,
        labels: words,
      }),
    [hourCycle, locale, maxTime, minTime, minuteStep, mode, todayTime, words],
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
    reels().spinAll(new Date(valueTime), 0)
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
  const introOn = intro && !reduced && !paused
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
      Home: () => reels().spinTo(reel, 0),
      End: () => reels().spinTo(reel, model.count - 1),
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

  const picks = presets === false ? [] : (presets ?? defaultPresets(locale))
  const today = config.today
  const resolve = (preset: DateReelPreset) => normalize(typeof preset.value === "function" ? preset.value(new Date(today)) : preset.value, minuteStep)
  const matches = (date: Date) => config.indicesOf(date).every((index, reel) => index === currentIndices[reel])

  const confirm = async () => {
    if (!onConfirm || status === "pending") return
    window.clearTimeout(statusTimer.current)
    const date = reels().now()
    const done = (next: ConfirmState, words: string) => {
      setStatus(next)
      setAnnouncement(words)
      statusTimer.current = window.setTimeout(() => setStatus("idle"), 2000)
    }
    try {
      const result = onConfirm(date)
      if (result && typeof (result as Promise<void>).then === "function") {
        setStatus("pending")
        await result
      }
      done("success", `${wordsFor("success")}. ${config.summary(date).spoken}`)
    } catch {
      done("failure", wordsFor("failure"))
    }
  }
  const wordsFor = (state: ConfirmState) =>
    state === "pending" ? words.confirming : state === "success" ? words.confirmed : state === "failure" ? words.failed : words.confirm

  // Hidden labels keep the same resting values either way (so server and client render alike); reduced motion only fades.
  const swap = reduced
    ? { duration: motionTokens.duration.fast, y: { duration: 0 }, filter: { duration: 0 } }
    : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] as [number, number, number, number] }

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label}
      className={cn("@container w-full rounded-surface border border-border bg-surface-raised text-foreground shadow-raised", className)}
      style={{ ...style, ["--reel-accent" as string]: accent ?? "var(--accent)" }}
    >
      <div
        className={cn(
          "flex flex-col gap-4 p-4 @[26rem]:p-5",
          "[--reel-row:34px] @[24rem]:[--reel-row:38px] @[32rem]:[--reel-row:42px]",
          "[--reel-radius:calc(var(--reel-row)*3.196)] [--reel-perspective:calc(var(--reel-row)*18)]",
        )}
      >
        {/* The visual summary is hidden from assistive technology; the live region below speaks the committed moment. */}
        <div aria-hidden="true" className="grid gap-0.5">
          {title ? <p className="m-0 text-sm leading-body text-text-secondary">{title}</p> : null}
          <p ref={node => void (reels().primary = node)} className="m-0 truncate text-lg leading-tight font-medium tracking-body @[26rem]:text-xl">
            {firstSummary.primary}
          </p>
          {mode === "time" ? null : (
            <p ref={node => void (reels().secondary = node)} className="m-0 truncate text-sm leading-body text-text-muted">
              {firstSummary.secondary || " "}
            </p>
          )}
        </div>

        <div className="relative flex h-[calc(var(--reel-row)*5.6)] items-stretch justify-center gap-[0.8em] overflow-hidden text-[18px] @[24rem]:text-[20px] @[32rem]:text-[22px] supports-[overflow:clip]:overflow-clip">
          {/* One glass lens spans the full width under every reel. */}
          <span
            ref={node => void (reels().band = node)}
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-1/2 h-(--reel-row) -translate-y-1/2 rounded-[12px] bg-surface-muted shadow-[inset_0_0_0_1px_var(--border-subtle)]"
          />
          {config.reels.map((reel, index) => (
            <div
              key={`${reel.kind}-${index}`}
              ref={node => void (reels().columns[index] = node)}
              role="spinbutton"
              tabIndex={0}
              aria-label={reel.name}
              aria-valuemin={reel.numeric(0)}
              aria-valuemax={reel.numeric(reel.count - 1)}
              aria-valuenow={reel.numeric(currentIndices[index])}
              aria-valuetext={reel.spoken(currentIndices[index])}
              className="group/reel relative h-full flex-none cursor-grab touch-pan-x outline-none select-none active:cursor-grabbing"
              style={{ width: `${Math.max(...Array.from({ length: Math.min(reel.count, 40) }, (_, entry) => reel.label(entry).length)) * 0.62 + 0.2}em` }}
              onKeyDown={onKeyDown(index)}
              onPointerDown={onPointerDown(index)}
              onPointerMove={onPointerMove(index)}
              onPointerUp={onPointerEnd(index)}
              onPointerCancel={onPointerEnd(index)}
            >
              {/* Muted copy everywhere but the lens. */}
              <div aria-hidden="true" className="absolute inset-0 text-text-muted [perspective:var(--reel-perspective)]" style={{ maskImage: baseMask, WebkitMaskImage: baseMask }}>
                <div className="absolute inset-0 [transform-style:preserve-3d] [transform:translateZ(calc(var(--reel-radius)*-1))]">
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
              </div>
              {/* A crisp copy clipped to the lens; the focused reel shows its entry in the accent. */}
              <div
                aria-hidden="true"
                className="absolute inset-0 font-medium text-foreground transition-colors duration-160 ease-standard [perspective:var(--reel-perspective)] group-focus/reel:text-(--reel-accent) motion-reduce:transition-none"
                style={{ clipPath: lensClip }}
              >
                <div className="absolute inset-0 [transform-style:preserve-3d] [transform:translateZ(calc(var(--reel-radius)*-1))]">
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
            </div>
          ))}
        </div>

        {picks.length || onConfirm ? (
          <div className="flex flex-col gap-3 @[30rem]:flex-row @[30rem]:items-center @[30rem]:justify-between">
            {picks.length ? (
              <div role="group" aria-label={words.presets} className="flex flex-wrap gap-2">
                {picks.map(preset => {
                  const date = resolve(preset)
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      aria-pressed={matches(date)}
                      className={cn(
                        "inline-flex h-8 cursor-pointer items-center rounded-pill border border-border bg-transparent px-3 text-sm leading-body text-text-secondary outline-none [-webkit-tap-highlight-color:transparent]",
                        "transition-[color,background-color,border-color] duration-160 ease-standard motion-reduce:transition-none",
                        "pointer-fine:hover:bg-surface-muted pointer-fine:hover:text-foreground focus-visible:bg-surface-muted focus-visible:text-foreground",
                        "aria-pressed:border-transparent aria-pressed:bg-[color-mix(in_oklab,var(--reel-accent)_14%,transparent)] aria-pressed:text-(--reel-accent)",
                      )}
                      onClick={() => reels().spinAll(date, STAGGER)}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
            ) : null}
            {onConfirm ? (
              <button
                type="button"
                aria-busy={status === "pending" || undefined}
                className={cn(buttonVariants({ variant: "primary" }), "grid min-w-28 @max-[30rem]:min-h-11 @max-[30rem]:w-full")}
                onClick={confirm}
              >
                {/* Every state shares one grid cell, so the button keeps the width of its longest label. */}
                {(["idle", "pending", "success", "failure"] as const).map(state => (
                  <motion.span
                    key={state}
                    aria-hidden={state === status ? undefined : true}
                    className="col-start-1 row-start-1"
                    initial={false}
                    animate={
                      state === status
                        ? { opacity: 1, y: 0, filter: "blur(0px)" }
                        : { opacity: 0, y: 4, filter: `blur(${motionTokens.blur.soft}px)` }
                    }
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
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}

export default DateReel
