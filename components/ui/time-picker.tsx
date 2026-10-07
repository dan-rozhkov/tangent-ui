"use client"

import { AnimatePresence, motion } from "motion/react"
import type { Variants } from "motion/react"
import { ChevronDown, Clock3 } from "lucide-react"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import type { KeyboardEvent } from "react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface TimePickerProps {
  label: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  description?: string
  placeholder?: string
  minuteStep?: 1 | 5 | 10 | 15 | 30
  format?: "12h" | "24h"
  disabled?: boolean
  className?: string
}

const pad = (value: number) => String(value).padStart(2, "0")
const toMinutes = (value: string) => {
  const [h, m] = value.split(":").map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0
}
const enter = [...motionTokens.ease.enter] as [number, number, number, number]
const standard = [...motionTokens.ease.standard] as [number, number, number, number]
/** The shown time rolls like a clock face: a later time rises from below, an earlier one drops from above. */
const valueRoll: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${direction * 0.35}em`, filter: `blur(${motionTokens.blur.soft}px)` }),
  center: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.standard, ease: enter } },
  exit: (direction: number) => ({
    opacity: 0,
    y: `${direction * -0.3}em`,
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: { duration: motionTokens.duration.fast, ease: standard },
  }),
}
/** Reduced motion keeps a short crossfade; the resting state matches valueRoll so server and client markup agree. */
const valueFade: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.instant } },
  exit: { opacity: 0, transition: { duration: motionTokens.duration.instant } },
}

/* The trigger anchors the menu, so press feedback stays in color; it never scales. */
const triggerClass = [
  "group/trigger relative flex min-h-control-md w-full cursor-pointer items-center gap-[9px] rounded-control border border-border bg-surface px-3 text-left text-sm leading-body text-foreground",
  "[transition:border-color_var(--duration-fast)_var(--ease-standard),background-color_var(--duration-fast)_var(--ease-standard),box-shadow_var(--duration-fast)_var(--ease-standard)]",
  "pointer-fine:hover:not-disabled:border-border-strong pointer-fine:hover:not-disabled:bg-surface-muted",
  "active:not-disabled:border-border-strong active:not-disabled:bg-surface-muted aria-expanded:border-border-strong aria-expanded:bg-surface-muted",
  "disabled:cursor-not-allowed disabled:opacity-50 [&>svg:first-child]:flex-none [&>svg:first-child]:text-text-muted",
  "motion-reduce:transition-none",
].join(" ")

const menuClass = [
  "absolute top-[calc(100%+6px)] right-0 left-0 z-80 max-h-[250px] origin-top overflow-y-auto overscroll-contain will-change-[transform,opacity]",
  "rounded-panel border border-border bg-surface-raised p-[5px] shadow-floating",
].join(" ")

/* Arrow keys move the highlight often, so it changes almost instantly. The dot marks the chosen time, so only one row is ever highlighted. */
const optionClass = [
  "flex min-h-9 w-full cursor-pointer items-center justify-between rounded-[calc(var(--radius-panel)-5px)] border-0 bg-transparent px-3",
  "text-left text-sm text-foreground tabular-nums [transition:background-color_80ms_var(--ease-standard)] motion-reduce:transition-none",
  "data-[active=true]:bg-surface-muted",
].join(" ")

export function TimePicker({
  label,
  value,
  defaultValue = "09:00",
  onChange,
  description,
  placeholder = "Select a time",
  minuteStep = 15,
  format = "12h",
  disabled = false,
  className,
}: TimePickerProps) {
  const id = useId()
  const labelId = `${id}-label`
  const valueId = `${id}-value`
  const rootRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const centerOnOpen = useRef(false)
  const [internal, setInternal] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const selected = value ?? internal
  const reduce = useReducedMotion()
  const [previous, setPrevious] = useState(selected)
  const [direction, setDirection] = useState(1)
  if (previous !== selected) {
    setPrevious(selected)
    setDirection(toMinutes(selected) >= toMinutes(previous) ? 1 : -1)
  }
  const options = Array.from({ length: Math.ceil(1440 / minuteStep) }, (_, index) => {
    const minutes = index * minuteStep
    const hour = Math.floor(minutes / 60)
    const minute = minutes % 60
    return `${pad(hour)}:${pad(minute)}`
  })
  const display = (raw: string) => {
    const minutes = toMinutes(raw)
    const hour = Math.floor(minutes / 60)
    const minute = minutes % 60
    return format === "24h" ? `${pad(hour)}:${pad(minute)}` : `${hour % 12 || 12}:${pad(minute)} ${hour < 12 ? "AM" : "PM"}`
  }
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [])
  // Runs before paint so the menu's first frame is already centered on the selected time.
  useLayoutEffect(() => {
    if (!open || activeIndex < 0) return
    // Scroll only the menu, never the page: the selected time opens centered, arrow keys then keep the highlight in view.
    const option = optionRefs.current[activeIndex]
    const menu = option?.parentElement
    if (!option || !menu) return
    const top = option.offsetTop
    const bottom = top + option.offsetHeight
    if (centerOnOpen.current) {
      centerOnOpen.current = false
      menu.scrollTop = top - (menu.clientHeight - option.offsetHeight) / 2
    } else if (top < menu.scrollTop) menu.scrollTop = top
    else if (bottom > menu.scrollTop + menu.clientHeight) menu.scrollTop = bottom - menu.clientHeight
  }, [activeIndex, open])
  const choose = (next: string) => {
    if (value === undefined) setInternal(next)
    onChange?.(next)
    setOpen(false)
  }
  const openMenu = () => {
    const selectedIndex = options.indexOf(selected)
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    centerOnOpen.current = true
    setOpen(true)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      setOpen(false)
      return
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      if (open && activeIndex >= 0) choose(options[activeIndex])
      else openMenu()
      return
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (!open) {
        openMenu()
        return
      }
      setActiveIndex((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length)
    }
  }
  return (
    <div ref={rootRef} className={cn("grid min-w-0 gap-2", className)}>
      <span id={labelId} className="text-sm leading-body font-medium">
        {label}
      </span>
      <div className="relative min-w-0">
        <button
          type="button"
          className={triggerClass}
          disabled={disabled}
          aria-labelledby={`${labelId} ${valueId}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={onKeyDown}
        >
          <Clock3 size={16} aria-hidden="true" />
          <span id={valueId} className="sr-only">
            {selected ? display(selected) : placeholder}
          </span>
          <span
            className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] *:col-start-1 *:row-start-1 *:min-w-0 *:truncate"
            aria-hidden="true"
          >
            <AnimatePresence initial={false} custom={direction}>
              <motion.span
                key={selected || "placeholder"}
                className={selected ? "tabular-nums" : "text-text-muted"}
                custom={direction}
                variants={reduce ? valueFade : valueRoll}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {selected ? display(selected) : placeholder}
              </motion.span>
            </AnimatePresence>
          </span>
          <ChevronDown
            className="flex-none text-text-muted [transition:transform_var(--duration-spring)_var(--ease-spring)] group-aria-expanded/trigger:[transform:rotate(180deg)] motion-reduce:transition-none"
            size={16}
            aria-hidden="true"
          />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id={`${id}-listbox`}
              className={menuClass}
              role="listbox"
              aria-label={`${label} options`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                transition: reduce
                  ? { duration: motionTokens.duration.instant }
                  : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.fast, ease: enter } },
              }}
              exit={{ opacity: 0, ...(reduce ? {} : { y: -4, scale: 0.98 }), transition: { duration: motionTokens.duration.instant, ease: standard } }}
            >
              {options.map((option, index) => (
                <button
                  ref={(node) => {
                    optionRefs.current[index] = node
                  }}
                  id={`${id}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={option === selected}
                  data-active={activeIndex === index || undefined}
                  className={optionClass}
                  key={option}
                  onPointerMove={() => {
                    if (activeIndex !== index) setActiveIndex(index)
                  }}
                  onClick={() => choose(option)}
                >
                  {display(option)}
                  {option === selected && <span className="size-1.5 rounded-full bg-foreground" aria-hidden="true" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {description && <span className="text-xs leading-body text-text-muted">{description}</span>}
    </div>
  )
}

export default TimePicker
