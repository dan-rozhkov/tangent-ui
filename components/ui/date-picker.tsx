"use client"

import { useEffect, useId, useRef, useState } from "react"
import type { ButtonHTMLAttributes, FocusEvent, KeyboardEvent } from "react"
import { AnimatePresence, motion } from "motion/react"
import type { Variants } from "motion/react"
import { CalendarBlankIcon, CaretDownIcon } from "@phosphor-icons/react"

import { Calendar, type CalendarDateMatcher } from "@/components/ui/calendar"
import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface DatePickerProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "onChange"> {
  label: string
  value?: Date
  onChange?: (date: Date | undefined) => void
  description?: string
  placeholder?: string
  minDate?: Date
  maxDate?: Date
  disabledDates?: CalendarDateMatcher
  locale?: string
  format?: Intl.DateTimeFormatOptions
  /** Adds a Today button to the calendar header. */
  showToday?: boolean
}

const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)
const { spring, duration, blur } = motionTokens
const enterEase = [...motionTokens.ease.enter] as [number, number, number, number]
const standardEase = [...motionTokens.ease.standard] as [number, number, number, number]
const instant = { duration: duration.instant }
/** Each part of the date rolls with time: a later date rises from below, an earlier one drops from above. Parts that did not change stay still. */
const valueRoll: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${direction * 0.35}em`, filter: `blur(${blur.soft}px)` }),
  center: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: duration.standard, ease: enterEase } },
  exit: (direction: number) => ({
    opacity: 0,
    y: `${direction * -0.3}em`,
    filter: `blur(${blur.subtle}px)`,
    transition: { duration: 0.14, ease: standardEase },
  }),
}
/** Reduced motion keeps a short crossfade; resting values match the roll so server and client markup agree. */
const valueFade: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, y: 0, filter: "blur(0px)", transition: instant },
  exit: { opacity: 0, transition: instant },
}
/** The footer confirms the pick: new copy rises in with a soft blur while the old line lifts away. */
const statusRise: Variants = {
  enter: { opacity: 0, y: "0.3em", filter: `blur(${blur.soft}px)` },
  center: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: duration.standard, ease: enterEase } },
  exit: { opacity: 0, y: "-0.3em", filter: `blur(${blur.subtle}px)`, transition: { duration: 0.14, ease: standardEase } },
}

/* The trigger anchors the calendar, so press feedback stays in color; it never scales. */
const triggerClass = [
  "relative flex min-h-control-md w-full cursor-pointer items-center gap-[9px] rounded-control border border-border bg-surface px-3 text-left text-sm leading-body text-foreground",
  "[transition:border-color_var(--duration-fast)_var(--ease-standard),background_var(--duration-fast)_var(--ease-standard),box-shadow_var(--duration-fast)_var(--ease-standard)]",
  "pointer-fine:hover:not-disabled:border-border-strong pointer-fine:hover:not-disabled:bg-surface-muted",
  "active:not-disabled:border-border-strong active:not-disabled:bg-surface-muted aria-expanded:border-border-strong aria-expanded:bg-surface-muted",
  "disabled:cursor-not-allowed disabled:opacity-50 [&>svg:first-child]:flex-none [&>svg:first-child]:text-text-muted",
  "motion-reduce:transition-none",
].join(" ")

/* Grows out of the trigger's calendar icon and returns there on close.
   On phone widths the calendar matches the field instead of running past the screen edge, and a tighter inset keeps the month and its controls on one row. */
const popoverClass = [
  "absolute top-[calc(100%+8px)] left-0 z-20 w-[min(320px,calc(100vw-32px))] origin-[22px_-8px] overflow-hidden will-change-[transform,opacity]",
  "rounded-panel border border-border bg-surface-raised p-4 shadow-floating",
  "max-[360px]:right-0 max-[360px]:w-auto max-[360px]:p-3",
].join(" ")

const footerButtonClass = [
  "cursor-pointer rounded-control border-0 bg-transparent px-2 py-1 text-text-secondary",
  "[transition:background-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard),transform_var(--duration-spring)_var(--ease-spring)]",
  "pointer-fine:hover:not-disabled:bg-surface-muted pointer-fine:hover:not-disabled:text-foreground",
  "active:not-disabled:[transform:scale(.97)] active:not-disabled:[transition-duration:var(--duration-fast),var(--duration-fast),100ms] active:not-disabled:[transition-timing-function:var(--ease-standard)]",
  "disabled:cursor-not-allowed disabled:opacity-40",
  "motion-reduce:transition-none motion-reduce:active:not-disabled:[transform:none]!",
].join(" ")

export function DatePicker({
  label,
  value,
  onChange,
  description,
  placeholder = "Select a date",
  minDate,
  maxDate,
  disabledDates,
  locale = "en-US",
  format = { month: "short", day: "numeric", year: "numeric" },
  showToday,
  id,
  className,
  disabled,
  ...buttonProps
}: DatePickerProps) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const hintId = description ? `${controlId}-description` : undefined
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(monthStart(value ?? new Date()))
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | undefined>(undefined)
  const formatter = new Intl.DateTimeFormat(locale, format)
  const reduce = useReducedMotion() ?? false
  const time = value?.getTime() ?? null
  const [previousTime, setPreviousTime] = useState(time)
  const [direction, setDirection] = useState(1)
  if (previousTime !== time) {
    setPreviousTime(time)
    setDirection(time === null || previousTime === null || time >= previousTime ? 1 : -1)
  }
  const shown = value ? formatter.format(value) : placeholder
  const parts = value ? formatter.formatToParts(value) : []
  // Parts after a wider or narrower segment move on the same curve the new text arrives on, so they never overlap it.
  const partMotion = reduce ? { duration: 0 } : { duration: duration.standard, ease: enterEase }

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        window.clearTimeout(closeTimer.current)
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      window.clearTimeout(closeTimer.current)
    }
  }, [])

  /** Opening moves focus to the day that owns the tab stop, so arrows work at once; a pointer open shows no ring. */
  useEffect(() => {
    if (open) popoverRef.current?.querySelector<HTMLButtonElement>('[data-present] [data-date][tabindex="0"]')?.focus({ preventScroll: true })
  }, [open])

  /** Closing hands focus back to the trigger when it was inside the calendar, so keyboard users never land on the page body. */
  const close = () => {
    window.clearTimeout(closeTimer.current)
    if (popoverRef.current?.contains(document.activeElement)) triggerRef.current?.focus()
    setOpen(false)
  }
  /** The calendar always opens on the month of the current value, or today's month. */
  const show = () => {
    window.clearTimeout(closeTimer.current)
    setMonth(monthStart(value ?? new Date()))
    setOpen(true)
  }
  /** A picked day lets the highlight glide onto it and the footer confirm it, then the calendar returns to the field. */
  const selectDate = (date: Date | undefined) => {
    onChange?.(date)
    window.clearTimeout(closeTimer.current)
    if (reduce || !date) close()
    else closeTimer.current = window.setTimeout(close, 300)
  }
  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") && !open) {
      event.preventDefault()
      show()
    }
    if (event.key === "Escape") close()
  }
  /** Tabbing past the popover closes it; focus moving within the field keeps it open. */
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null
    if (open && next && !rootRef.current?.contains(next)) {
      window.clearTimeout(closeTimer.current)
      setOpen(false)
    }
  }

  return (
    <div className={cn("grid min-w-0 gap-[7px]", className)} ref={rootRef} onBlur={onBlur}>
      <label className="text-sm leading-body font-medium text-foreground" htmlFor={controlId}>
        {label}
      </label>
      <div className="peer/anchor relative min-w-0">
        <button
          {...buttonProps}
          ref={triggerRef}
          id={controlId}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-describedby={hintId}
          className={cn(triggerClass, "group/trigger")}
          onClick={() => (open ? close() : show())}
          onKeyDown={onTriggerKeyDown}
        >
          <CalendarBlankIcon size={16} aria-hidden="true" />
          <span className="sr-only">{shown}</span>
          {/* Old and new values cross in place; each part of a date is its own box so a wider day or month moves the rest along on a spring. */}
          <span className="relative flex min-w-0 flex-1" aria-hidden="true">
            <AnimatePresence mode="popLayout" initial={false} custom={1}>
              {value ? (
                <motion.span
                  key="value"
                  className="relative inline-flex whitespace-pre tabular-nums"
                  custom={1}
                  variants={reduce ? valueFade : valueRoll}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  {parts.map((part, index) => (
                    <motion.span
                      key={`${index}-${part.type}`}
                      className="relative inline-flex whitespace-pre"
                      layout="position"
                      layoutDependency={time}
                      transition={partMotion}
                    >
                      {part.type === "literal" ? (
                        <span className="inline-block whitespace-pre">{part.value}</span>
                      ) : (
                        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                          <motion.span
                            key={part.value}
                            className="inline-block whitespace-pre"
                            custom={direction}
                            variants={reduce ? valueFade : valueRoll}
                            initial="enter"
                            animate="center"
                            exit="exit"
                          >
                            {part.value}
                          </motion.span>
                        </AnimatePresence>
                      )}
                    </motion.span>
                  ))}
                </motion.span>
              ) : (
                <motion.span
                  key="placeholder"
                  className="min-w-0 truncate text-text-muted"
                  custom={-1}
                  variants={reduce ? valueFade : valueRoll}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  {placeholder}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
          <CaretDownIcon
            className="flex-none text-text-muted [transition:transform_var(--duration-spring)_var(--ease-spring)] group-aria-expanded/trigger:[transform:rotate(180deg)] motion-reduce:transition-none"
            size={16}
            aria-hidden="true"
          />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              ref={popoverRef}
              className={popoverClass}
              role="dialog"
              aria-label={`${label} calendar`}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation()
                  close()
                }
              }}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.95 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                transition: reduce ? instant : { ...spring.snappy, opacity: { duration: duration.fast, ease: enterEase } },
              }}
              exit={{ opacity: 0, ...(reduce ? {} : { y: -6, scale: 0.97 }), transition: { duration: 0.14, ease: standardEase } }}
            >
              <Calendar
                value={value}
                onChange={selectDate}
                month={month}
                onMonthChange={setMonth}
                minDate={minDate}
                maxDate={maxDate}
                disabledDates={disabledDates}
                locale={locale}
                showToday={showToday}
              />
              <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-border-subtle pt-[11px] text-xs leading-body text-text-muted">
                <button type="button" className={footerButtonClass} onClick={() => selectDate(undefined)} disabled={!value}>
                  Clear
                </button>
                {/* Old and new status lines share one cell, pinned to the trailing edge so a shorter line never shifts. */}
                <span className="grid min-w-0 justify-items-end *:col-start-1 *:row-start-1 *:max-w-full *:truncate">
                  <AnimatePresence initial={false}>
                    <motion.span
                      key={time ?? "none"}
                      variants={reduce ? valueFade : statusRise}
                      initial="enter"
                      animate="center"
                      exit="exit"
                    >
                      {value ? `Selected ${formatter.format(value)}` : "Choose a day"}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {description && (
        // The open calendar covers the hint; fading it keeps its first letters from peeking past the popover's rounded corner.
        <span
          id={hintId}
          className="text-xs leading-body text-text-muted [transition:opacity_var(--duration-fast)_var(--ease-standard)] peer-has-[[role=dialog]]/anchor:opacity-0 motion-reduce:transition-none"
        >
          {description}
        </span>
      )}
    </div>
  )
}

export default DatePicker
