"use client"

import { useId, useMemo, useState } from "react"
import type { ComponentProps } from "react"
import { AnimatePresence, motion } from "motion/react"
import type { Variants } from "motion/react"
import { CheckIcon, ClockIcon } from "@phosphor-icons/react"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { TextMorph } from "@/components/ui/text-morph"
import { startOfDay } from "@/lib/date"
import { useMotionTokens } from "@/lib/motion-tokens-context"
import { useReducedMotion } from "@/lib/reduced-motion"
import { cn } from "@/lib/utils"

export interface AvailabilityAttendee {
  id: string
  name: string
  src?: string
}

export interface AvailabilitySlot {
  /** Local start time. */
  start: Date
  /** Attendee ids who can't make it. */
  busy?: string[]
}

export interface AvailabilityDay {
  date: Date
  slots: AvailabilitySlot[]
}

/**
 * A card for finding a meeting time across several attendees. Day cards count the open slots, the slot list slides in from the direction of travel,
 * and the selection glides between times. Hovering or focusing a slot dims whoever is busy in the header. Slots where everyone is busy cannot be picked;
 * slots where only some are busy can, since the organizer may still want them. Use it for scheduling a call, an interview or a demo.
 */
export interface AvailabilityPickerProps extends Omit<ComponentProps<"div">, "onChange" | "defaultValue"> {
  title: string
  /** Meeting length in minutes. Default 30. */
  duration?: number
  /** Shown in the header, e.g. "Zürich time". */
  timeZoneLabel?: string
  attendees: AvailabilityAttendee[]
  /** The strip shows the first five. */
  days: AvailabilityDay[]
  /** Controlled selected slot start; null = nothing selected. */
  value?: Date | null
  defaultValue?: Date | null
  onValueChange?: (start: Date | null) => void
  onConfirm?: (slot: { start: Date; end: Date }) => void
  /** Default "Confirm time". */
  confirmLabel?: string
}

const weekdayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short" })
const dayNumberFormat = new Intl.DateTimeFormat("en-US", { day: "numeric" })
const summaryDayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" })
const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

const dayKey = (date: Date) => startOfDay(date).getTime()
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name

function busyLabel(names: string[], everyone: boolean) {
  if (!names.length) return "Everyone is free"
  if (everyone) return "Everyone is busy"
  if (names.length === 1) return `${names[0]} is busy`
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} are busy`
}

export function AvailabilityPicker({
  title,
  duration = 30,
  timeZoneLabel,
  attendees,
  days: allDays,
  value,
  defaultValue = null,
  onValueChange,
  onConfirm,
  confirmLabel = "Confirm time",
  className,
  ...props
}: AvailabilityPickerProps) {
  const id = useId()
  const reduced = !!useReducedMotion()
  const tokens = useMotionTokens()

  const days = useMemo(() => allDays.slice(0, 5), [allDays])
  /** First names by id; busy ids that aren't attendees (a room, someone removed) are ignored everywhere. */
  const names = useMemo(() => new Map(attendees.map(person => [person.id, firstName(person.name)])), [attendees])
  const busyOf = (slot: AvailabilitySlot) => (slot.busy ?? []).filter(person => names.has(person))
  const pickable = (slot: AvailabilitySlot) => busyOf(slot).length < attendees.length || attendees.length === 0

  const [innerValue, setInnerValue] = useState<Date | null>(defaultValue)
  const selected = value !== undefined ? value : innerValue
  const selectedTime = selected ? selected.getTime() : null

  const [viewedKey, setViewedKey] = useState<number | null>(() => {
    if (selected) return dayKey(selected)
    const first = days.find(day => day.slots.some(slot => !busyOf(slot).length)) ?? days.find(day => day.slots.some(pickable)) ?? days[0]
    return first ? dayKey(first.date) : null
  })
  const [direction, setDirection] = useState(1)
  // A selection that moves to another day (a controlled value, a suggestion) brings that day into view.
  const [seenTime, setSeenTime] = useState(selectedTime)
  if (seenTime !== selectedTime) {
    setSeenTime(selectedTime)
    const at = selected ? days.findIndex(day => dayKey(day.date) === dayKey(selected)) : -1
    if (at !== -1 && dayKey(days[at].date) !== viewedKey) {
      const from = days.findIndex(day => dayKey(day.date) === viewedKey)
      setDirection(at > from ? 1 : -1)
      setViewedKey(dayKey(days[at].date))
    }
  }
  /** The slot the pointer or focus is on; the header shows its busy attendees, falling back to the selection. */
  const [probe, setProbe] = useState<number | null>(null)
  const [bookedTime, setBookedTime] = useState<number | null>(null)

  const viewed = days.find(day => dayKey(day.date) === viewedKey) ?? days[0]
  const viewedIndex = viewed ? days.indexOf(viewed) : -1
  // A probe only counts while its slot is on screen; an unmounted button never fires pointerleave or blur.
  const probeSlot = probe === null ? undefined : viewed?.slots.find(slot => slot.start.getTime() === probe)
  const activeSlot = probeSlot ?? (selectedTime === null ? undefined : days.flatMap(day => day.slots).find(slot => slot.start.getTime() === selectedTime))
  const activeBusy = new Set(activeSlot ? busyOf(activeSlot) : [])

  const select = (start: Date) => {
    setBookedTime(null)
    if (value === undefined) setInnerValue(start)
    onValueChange?.(start)
  }
  const viewDay = (index: number) => {
    if (index === viewedIndex) return
    setDirection(index > viewedIndex ? 1 : -1)
    setProbe(null)
    setViewedKey(dayKey(days[index].date))
  }

  const booked = selectedTime !== null && bookedTime === selectedTime
  const end = selected ? new Date(selected.getTime() + duration * 60_000) : null
  const summary = selected && end ? `${summaryDayFormat.format(selected)} · ${timeFormat.format(selected)} – ${timeFormat.format(end)}` : "Pick a time"

  const spring = reduced ? { duration: 0 } : tokens.spring.morph
  const listVariants: Variants = {
    enter: (dir: number) => ({ opacity: 0, x: reduced ? 0 : dir * 24, filter: reduced ? "blur(0px)" : `blur(${tokens.blur.subtle}px)` }),
    center: { opacity: 1, x: 0, filter: "blur(0px)" },
    exit: (dir: number) => ({ opacity: 0, x: reduced ? 0 : dir * -24, filter: reduced ? "blur(0px)" : `blur(${tokens.blur.subtle}px)` }),
  }
  const listTransition = reduced
    ? { duration: 0.01 }
    : { duration: tokens.duration.standard, ease: [...tokens.ease.enter] as [number, number, number, number] }

  return (
    <div
      {...props}
      className={cn("@container flex w-full flex-col gap-4 rounded-surface border border-border bg-surface p-4 text-foreground", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="truncate text-base font-medium">{title}</h3>
          <p className="flex items-center gap-1.5 text-sm text-text-secondary">
            <ClockIcon aria-hidden="true" className="size-4 flex-none" />
            <span>{[`${duration} min`, timeZoneLabel].filter(Boolean).join(" · ")}</span>
          </p>
        </div>
        <ul className="flex items-center gap-1 @md:gap-3" aria-label="Attendees">
          {attendees.map(person => {
            const busy = activeBusy.has(person.id)
            return (
              <li key={person.id} className="flex items-center gap-2" aria-label={busy ? `${person.name}, busy at this time` : person.name}>
                <motion.span
                  className="relative inline-flex"
                  initial={false}
                  animate={{ opacity: busy ? 0.35 : 1, scale: busy ? 0.92 : 1, filter: busy ? "grayscale(1)" : "grayscale(0)" }}
                  transition={reduced ? { duration: 0 } : tokens.spring.snappy}
                >
                  <Avatar name={person.name} src={person.src} size="sm" />
                </motion.span>
                <span className="sr-only @md:not-sr-only @md:text-sm @md:text-text-secondary">{firstName(person.name)}</span>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {days.map((day, index) => {
          const open = day.slots.filter(pickable).length
          const active = index === viewedIndex
          return (
            <button
              key={day.date.getTime()}
              type="button"
              aria-pressed={active}
              onClick={() => viewDay(index)}
              className="relative flex min-w-0 cursor-pointer flex-col items-center gap-0.5 rounded-control border border-border px-1 py-2 text-center"
            >
              {active && (
                <motion.span
                  layoutId={`${id}-day`}
                  className="absolute inset-0 rounded-[inherit] bg-accent-subtle"
                  transition={spring}
                />
              )}
              <span className="relative text-xs text-text-muted">{weekdayFormat.format(day.date)}</span>
              <span className="relative text-lg leading-6 font-medium tabular-nums">{dayNumberFormat.format(day.date)}</span>
              <span className={cn("relative text-xs", open ? "text-text-secondary" : "text-text-muted")}>{open ? `${open} open` : "Full"}</span>
            </button>
          )
        })}
      </div>

      <div className="relative">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          {viewed && (
            <motion.div
              key={viewed.date.getTime()}
              custom={direction}
              variants={listVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={listTransition}
              className="grid grid-cols-2 gap-2"
            >
              {viewed.slots.map(slot => {
                const time = slot.start.getTime()
                const busy = busyOf(slot)
                const everyone = !pickable(slot)
                const picked = selectedTime === time
                const label = busyLabel(busy.map(person => names.get(person) ?? person), everyone)
                return (
                  <button
                    key={time}
                    type="button"
                    aria-pressed={picked}
                    aria-disabled={everyone || undefined}
                    aria-label={`${timeFormat.format(slot.start)}, ${label}`}
                    onClick={() => !everyone && select(slot.start)}
                    onPointerEnter={() => setProbe(time)}
                    onPointerLeave={() => setProbe(null)}
                    onFocus={() => setProbe(time)}
                    onBlur={() => setProbe(null)}
                    className={cn(
                      "relative flex min-w-0 cursor-pointer flex-col items-start gap-0.5 rounded-control border px-3 py-2 text-left transition-[color,background-color,border-color,opacity] duration-160 ease-standard motion-reduce:transition-none",
                      picked ? "border-accent text-accent-foreground" : busy.length ? "border-border bg-surface-muted text-text-secondary" : "border-border text-foreground",
                      everyone && "cursor-not-allowed opacity-52",
                    )}
                  >
                    {picked && (
                      <motion.span layoutId={`${id}-slot-${dayKey(viewed.date)}`} className="absolute -inset-px rounded-[inherit] bg-accent" transition={spring} />
                    )}
                    <span className="relative text-sm font-medium tabular-nums">{timeFormat.format(slot.start)}</span>
                    <span className={cn("relative max-w-full truncate text-xs", picked ? "opacity-80" : "text-text-muted")}>{label}</span>
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-3">
        <p aria-live="polite" className={cn("text-sm transition-colors duration-160 ease-standard motion-reduce:transition-none", selected ? "text-foreground" : "text-text-muted")}>
          <TextMorph>{summary}</TextMorph>
        </p>
        <Button
          className="w-full"
          disabled={!selected}
          onClick={() => {
            if (!selected || !end || booked) return
            setBookedTime(selected.getTime())
            onConfirm?.({ start: selected, end })
          }}
        >
          {booked ? (
            <>
              <CheckIcon aria-hidden="true" className="size-4" />
              Booked
            </>
          ) : (
            confirmLabel
          )}
        </Button>
      </div>
    </div>
  )
}

export default AvailabilityPicker
