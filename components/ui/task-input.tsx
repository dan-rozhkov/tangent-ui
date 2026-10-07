"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, KeyboardEvent, ReactNode } from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { AnimatePresence, animate, motion } from "motion/react"
import type { Transition } from "motion/react"
import { CalendarBlankIcon, CaretDownIcon, CheckIcon } from "@phosphor-icons/react"

import { motionTokens as staticTokens } from "@/lib/motion-tokens"
import { useMotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface TaskInputList {
  id: string
  label: string
  /** Any CSS color, usually a design token such as "var(--series-1)". Lists without one show a hollow ring. */
  color?: string
}
export interface TaskInputTask {
  title: string
  /** Local midnight of the due day, or null. */
  date: Date | null
  /** The id of the chosen list, or null. */
  list: string | null
}
export interface TaskInputProps {
  lists: TaskInputList[]
  placeholder?: string
  /** Called on Enter with the title stripped of any date or #list words that were applied. The row then clears. */
  onSubmit?: (task: TaskInputTask) => void
  /** The list a new task starts in, and the one the row returns to after each submit. */
  defaultList?: string | null
  className?: string
}

type Bezier = [number, number, number, number]
const enter = [...staticTokens.ease.enter] as Bezier
const standard = [...staticTokens.ease.standard] as Bezier
/** Duration springs restated as stiffness and damping, so a retarget mid-flight keeps the velocity it already has. */
const physical = (visualDuration: number, bounce: number): Transition => {
  const root = (2 * Math.PI) / (visualDuration * 1.2)
  return { type: "spring", stiffness: root * root, damping: 2 * (1 - bounce) * root, mass: 1 }
}

/* Dates: everything is local midnight, so two dates on the same day compare equal. */
const DAY = 86_400_000
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const sameDay = (a: Date | null, b: Date | null) => (a && b ? a.getTime() === b.getTime() : a === b)
const weekday = (date: Date) => date.toLocaleDateString("en-US", { weekday: "short" })
const dayDiff = (date: Date, now: Date) => Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY)

/** "Today", "Tomorrow", a weekday within the coming week, otherwise a short date. */
export function formatDueLabel(date: Date, now = new Date()) {
  const diff = dayDiff(date, now)
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  if (diff > 1 && diff < 7) return weekday(date)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** The coming given weekday (0 is Sunday), never today. */
const nextWeekday = (now: Date, day: number) => addDays(startOfDay(now), ((day - now.getDay() + 6) % 7) + 1)

const quickDates = (now: Date) => [
  { id: "today", label: "Today", date: startOfDay(now) },
  { id: "tomorrow", label: "Tomorrow", date: addDays(startOfDay(now), 1) },
  { id: "weekend", label: "This weekend", date: now.getDay() === 6 ? startOfDay(now) : nextWeekday(now, 6) },
  { id: "next-week", label: "Next week", date: nextWeekday(now, 1) },
]

/** Full names, plus only the short forms that are not everyday words ("sun", "mon", "wed" and "sat" stay plain text). */
const weekdayNames: Record<string, number> = {
  sunday: 0, monday: 1, tue: 2, tues: 2, tuesday: 2, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, saturday: 6,
}
function dateWord(word: string, now: Date) {
  if (word === "today") return startOfDay(now)
  if (word === "tomorrow" || word === "tmrw") return addDays(startOfDay(now), 1)
  const day = weekdayNames[word]
  return day === undefined ? null : nextWeekday(now, day)
}

/** A recognized word in the text: its range, and what it stands for. */
type Token = { kind: "date"; start: number; end: number; date: Date } | { kind: "list"; start: number; end: number; list: string }

/** Reads date words and #list words off the end of the text, in either order, and stops at the first word that is neither. */
function parseTokens(text: string, lists: TaskInputList[], now: Date): Token[] {
  const words = [...text.matchAll(/\S+/g)].map(match => ({ text: match[0].toLowerCase(), start: match.index, end: match.index + match[0].length }))
  const tokens: Token[] = []
  let date = false
  let list = false
  let index = words.length - 1
  while (index >= 0) {
    const word = words[index]
    if (!list && word.text.startsWith("#")) {
      const name = word.text.slice(1)
      const found = lists.find(item => item.id.toLowerCase() === name || item.label.toLowerCase() === name)
      if (found) {
        tokens.push({ kind: "list", start: word.start, end: word.end, list: found.id })
        list = true
        index--
        continue
      }
    }
    if (!date) {
      const before = words[index - 1]
      if (word.text === "week" && before?.text === "next") {
        tokens.push({ kind: "date", start: before.start, end: word.end, date: nextWeekday(now, 1) })
        date = true
        index -= 2
        continue
      }
      const found = dateWord(word.text, now)
      if (found) {
        tokens.push({ kind: "date", start: word.start, end: word.end, date: found })
        date = true
        index--
        continue
      }
    }
    break
  }
  return tokens.sort((a, b) => a.start - b.start)
}

/** Natural width of a node, so a clipped wrapper can spring to it. The first measure and font swaps settle instantly. */
function useNaturalWidth(key: string) {
  const ref = useRef<HTMLButtonElement>(null)
  const last = useRef<string | null>(null)
  const [size, setSize] = useState<{ width: number | undefined; animate: boolean }>({ width: undefined, animate: false })
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      const animate = last.current !== null && last.current !== key
      last.current = key
      setSize({ width: Math.ceil(entry.borderBoxSize?.[0]?.inlineSize ?? node.offsetWidth), animate })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [key])
  return [ref, size] as const
}

/** A short scale nudge that says "this was filled in for you". */
function nudge(node: HTMLElement | null, reduced: boolean) {
  if (!node || reduced) return
  animate(node, { scale: [1, 1.07, 1] }, { duration: 0.36, ease: enter })
}

/* Menus match the gallery's dropdown: the panel grows from its trigger edge on transitions, so an interrupted open reverses from where it is. */
const menuClass = [
  "[--menu-y:-5px] data-[side=top]:[--menu-y:5px]",
  "relative min-w-60 rounded-panel border border-border bg-surface-raised p-[5px] shadow-floating outline-none",
  "origin-(--transform-origin) [transition:opacity_var(--duration-fast)_var(--ease-enter),transform_var(--duration-spring)_var(--ease-spring)]",
  "data-starting-style:[transform:translateY(var(--menu-y))_scale(.97)] data-starting-style:opacity-0",
  "data-ending-style:pointer-events-none data-ending-style:[transform:translateY(calc(var(--menu-y)*.5))_scale(.985)] data-ending-style:opacity-0",
  "data-ending-style:[transition:opacity_130ms_var(--ease-standard),transform_130ms_var(--ease-standard)]",
  "motion-reduce:[transform:none]! motion-reduce:[transition:opacity_var(--duration-instant)_linear]!",
].join(" ")
const itemClass = [
  "relative flex min-h-9 cursor-pointer items-center gap-2.5 rounded-[calc(var(--radius-panel)-6px)] px-[11px] text-sm text-foreground outline-none",
  "[transition:background-color_var(--duration-instant)_var(--ease-standard)] motion-reduce:transition-none",
  "data-highlighted:bg-surface-muted",
].join(" ")

/** The clipped, springing shell of a trigger: it grows to the natural width of the button inside and carries the shared hover and focus states. */
const shellClass = [
  "inline-flex h-10 flex-none overflow-hidden rounded-control bg-surface-muted text-text-secondary",
  "[transition:background-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard)] motion-reduce:transition-none",
  "pointer-fine:hover:bg-[color-mix(in_oklab,var(--surface-muted),var(--border)_45%)] pointer-fine:hover:text-foreground",
  "has-data-popup-open:bg-[color-mix(in_oklab,var(--surface-muted),var(--border)_45%)] has-data-popup-open:text-foreground",
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus-ring)",
].join(" ")
const buttonClass = "relative inline-flex h-full w-max cursor-pointer items-center whitespace-nowrap border-0 bg-transparent px-[11px] text-sm font-medium text-inherit outline-none"

/** A label that fades and blurs in as it arrives, and leaves the layout at once so the shell can shrink around the rest. */
function FadeLabel({ id, reduced, blur, className, children }: { id: string; reduced: boolean; blur: number; className?: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={id}
        className={cn("block", className)}
        initial={reduced ? { opacity: 0 } : { opacity: 0, filter: `blur(${blur}px)` }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        exit={
          reduced
            ? { opacity: 0, transition: { duration: 0.08 } }
            : { opacity: 0, filter: `blur(${staticTokens.blur.subtle}px)`, transition: { duration: staticTokens.duration.instant, ease: standard } }
        }
        transition={{ duration: reduced ? 0.12 : staticTokens.duration.standard, ease: enter }}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  )
}

function Dot({ color }: { color?: string }) {
  return (
    <span
      className={cn(
        "block size-2.5 flex-none rounded-full border-[1.5px]",
        "[transition:background-color_var(--duration-standard)_var(--ease-standard),border-color_var(--duration-standard)_var(--ease-standard)] motion-reduce:transition-none",
        color ? "border-(--dot) bg-(--dot)" : "border-text-muted bg-transparent",
      )}
      style={{ "--dot": color } as CSSProperties}
      aria-hidden="true"
    />
  )
}

export function TaskInput({ lists, placeholder = "Write a new task", onSubmit, defaultList = null, className }: TaskInputProps) {
  const reduced = useReducedMotion()
  const motionTokens = useMotionTokens()
  const { blur } = motionTokens
  /** Widths follow new content on the morph spring; the label settles a beat after. */
  const WIDTH = useMemo(
    () => physical(motionTokens.spring.morph.visualDuration ?? 0.42, motionTokens.spring.morph.bounce ?? 0.16),
    [motionTokens],
  )
  const rowRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dateShell = useRef<HTMLSpanElement>(null)
  const dateNudge = useRef<HTMLSpanElement>(null)
  const listShell = useRef<HTMLSpanElement>(null)
  const listNudge = useRef<HTMLSpanElement>(null)

  const [text, setText] = useState("")
  /** undefined follows the typed words, a value (or null for none) was chosen by hand and wins over them. */
  const [pickedDate, setPickedDate] = useState<Date | null | undefined>(undefined)
  const [pickedList, setPickedList] = useState<string | null | undefined>(undefined)
  const [announcement, setAnnouncement] = useState("")
  const [now, setNow] = useState<Date | null>(null)

  // The clock is read after hydration, then again on every edit, menu open and submit, so the day is right after midnight too.
  useEffect(() => {
    const timer = window.setTimeout(() => setNow(new Date()), 0)
    return () => window.clearTimeout(timer)
  }, [])
  const clock = now ?? new Date(0)

  /** What the text means at a given moment: the words that apply, the title without them, and the resulting date and list. */
  const read = (at: Date | null) => {
    const applied = (at ? parseTokens(text, lists, at) : []).filter(token => (token.kind === "date" ? pickedDate === undefined : pickedList === undefined))
    const typedDate = applied.find(token => token.kind === "date")?.date ?? null
    const typedList = applied.find(token => token.kind === "list")?.list ?? null
    let title = text
    for (const token of [...applied].reverse()) title = title.slice(0, token.start) + title.slice(token.end)
    return {
      applied,
      typedDate,
      typedList,
      title: title.replace(/\s+/g, " ").trim(),
      date: pickedDate !== undefined ? pickedDate : typedDate,
      listId: pickedList !== undefined ? pickedList : (typedList ?? defaultList),
    }
  }
  const { applied, typedDate, typedList, title, date, listId } = read(now)
  const list = lists.find(item => item.id === listId)
  const dateLabel = date ? formatDueLabel(date, clock) : null

  // A word that just started to apply nudges its chip.
  const typedDateTime = typedDate?.getTime()
  useEffect(() => {
    if (typedDateTime !== undefined) nudge(dateNudge.current, reduced)
  }, [typedDateTime, reduced])
  useEffect(() => {
    if (typedList) nudge(listNudge.current, reduced)
  }, [typedList, reduced])

  // The mirrored text follows the input when a long title scrolls it sideways.
  const syncScroll = () => {
    if (overlayRef.current && inputRef.current) overlayRef.current.scrollLeft = inputRef.current.scrollLeft
  }
  useLayoutEffect(syncScroll, [text])

  // Chips growing narrow the field: while typing at the end of the text, keep the caret in view.
  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    const observer = new ResizeObserver(() => {
      if (document.activeElement === input && input.selectionStart === input.value.length) input.scrollLeft = input.scrollWidth
      syncScroll()
    })
    observer.observe(input)
    return () => observer.disconnect()
  }, [])

  const [dateRef, dateWidth] = useNaturalWidth(dateLabel ?? "")
  const [listRef, listWidth] = useNaturalWidth(list?.label ?? "")
  const spring: Transition = reduced ? { duration: 0 } : WIDTH

  /** The same message twice in a row gets an invisible suffix, so the live region changes and is read again. */
  const announce = (message: string) => setAnnouncement(current => (current === message ? `${message}\u200b` : message))

  const shake = () => {
    announce("Write a task first")
    if (reduced || !rowRef.current) return
    animate(rowRef.current, { x: [0, -7, 6, -4, 2, 0] }, { duration: 0.36, ease: standard })
  }
  const submit = () => {
    // Read against a fresh clock, so a tab left open past midnight still lands on the right day.
    const fresh = new Date()
    setNow(fresh)
    const current = read(fresh)
    if (!current.title) {
      shake()
      return
    }
    onSubmit?.({ title: current.title, date: current.date, list: lists.find(item => item.id === current.listId)?.id ?? null })
    announce(`Added “${current.title}”`)
    setText("")
    setPickedDate(undefined)
    setPickedList(undefined)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === "Enter") {
      event.preventDefault()
      submit()
    } else if (event.key === "Escape") {
      event.preventDefault()
      if (text) {
        setText("")
        setPickedDate(undefined)
        setPickedList(undefined)
      } else event.currentTarget.blur()
    }
  }

  // Menus read the day when they open.
  const options = quickDates(clock)
  const refreshClock = (open: boolean) => {
    if (open) setNow(new Date())
  }
  const dateId = options.find(option => sameDay(option.date, date))?.id

  // The mirrored text: applied words sit on an accent-subtle chip behind the (transparent) input text.
  const segments: ReactNode[] = []
  let cursor = 0
  for (const token of applied) {
    if (token.start > cursor) segments.push(text.slice(cursor, token.start))
    segments.push(
      <mark key={token.start} className="rounded-[5px] bg-accent-subtle text-inherit">
        {text.slice(token.start, token.end)}
      </mark>,
    )
    cursor = token.end
  }
  segments.push(text.slice(cursor))

  const ready = title.length > 0

  return (
    <div className={cn("relative w-full touch-manipulation", className)}>
      <div
        ref={rowRef}
        className={cn(
          "flex h-14 items-center gap-3 rounded-surface bg-surface-raised pr-2 pl-[18px] shadow-raised ring-1 ring-border",
          "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-(--focus-ring)",
        )}
      >
        {/* The checkbox the task will get: a muted fill that firms into an outlined box once there is something to check. */}
        <span
          className={cn(
            "block size-5 flex-none rounded-[6px] border",
            "[transition:background-color_var(--duration-standard)_var(--ease-standard),border-color_var(--duration-standard)_var(--ease-standard)] motion-reduce:transition-none",
            ready ? "border-border-strong bg-surface" : "border-transparent bg-surface-muted",
          )}
          aria-hidden="true"
        />
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            value={text}
            onChange={event => {
              setText(event.target.value)
              setNow(new Date())
              // The input scrolls to its caret after the value lands, so the mirror follows a frame later.
              requestAnimationFrame(syncScroll)
            }}
            onKeyDown={onKeyDown}
            onScroll={syncScroll}
            onSelect={syncScroll}
            onKeyUp={syncScroll}
            placeholder={placeholder}
            aria-label="New task"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            className="block h-10 w-full min-w-0 border-0 bg-transparent p-0 text-base text-transparent caret-foreground outline-none placeholder:text-text-muted"
          />
          <div
            ref={overlayRef}
            className="pointer-events-none absolute inset-0 overflow-hidden text-base leading-10 whitespace-pre text-foreground"
            aria-hidden="true"
          >
            {segments}
          </div>
        </div>

        <MenuPrimitive.Root onOpenChange={refreshClock}>
          <span ref={dateNudge} className="inline-flex flex-none">
            <motion.span
              ref={dateShell}
              className={cn(shellClass, date && "bg-accent-subtle text-foreground")}
              initial={false}
              animate={{ width: dateWidth.width }}
              transition={dateWidth.animate ? spring : { duration: 0 }}
            >
              <MenuPrimitive.Trigger
                ref={dateRef}
                type="button"
                className={cn(buttonClass, "group/trigger")}
                aria-label={`Due date: ${dateLabel ?? "none"}`}
                aria-haspopup="menu"
              >
                <CalendarBlankIcon className="size-[18px] flex-none" aria-hidden="true" />
                {dateLabel && (
                  <FadeLabel id={dateLabel} reduced={reduced} blur={blur.soft} className="pl-1.5">
                    {dateLabel}
                  </FadeLabel>
                )}
              </MenuPrimitive.Trigger>
            </motion.span>
          </span>
          <MenuPrimitive.Portal>
            <MenuPrimitive.Positioner className="z-60" anchor={dateShell} sideOffset={8} align="end" collisionPadding={12}>
              <MenuPrimitive.Popup className={menuClass} aria-label="Due date">
                {options.map(option => (
                  <MenuPrimitive.Item
                    key={option.id}
                    className={itemClass}
                    onClick={() => setPickedDate(option.date)}
                  >
                    <span className="flex-1">{option.label}</span>
                    <span className="text-xs text-text-muted tabular-nums">
                      {option.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                    {dateId === option.id && <CheckIcon className="size-4 text-text-secondary" aria-hidden="true" />}
                  </MenuPrimitive.Item>
                ))}
                {date && (
                  <>
                    <MenuPrimitive.Separator className="-mx-[5px] my-1 h-px bg-border-subtle" />
                    <MenuPrimitive.Item className={itemClass} onClick={() => setPickedDate(null)}>
                      <span className="flex-1 text-text-secondary">No date</span>
                    </MenuPrimitive.Item>
                  </>
                )}
              </MenuPrimitive.Popup>
            </MenuPrimitive.Positioner>
          </MenuPrimitive.Portal>
        </MenuPrimitive.Root>

        <MenuPrimitive.Root>
          <span ref={listNudge} className="inline-flex flex-none">
            <motion.span
              ref={listShell}
              className={shellClass}
              initial={false}
              animate={{ width: listWidth.width }}
              transition={listWidth.animate ? spring : { duration: 0 }}
            >
              <MenuPrimitive.Trigger
                ref={listRef}
                type="button"
                className={cn(buttonClass, "group/trigger gap-2")}
                aria-label={`List: ${list?.label ?? "none"}`}
                aria-haspopup="menu"
              >
                <Dot color={list?.color} />
                <FadeLabel id={list?.id ?? "none"} reduced={reduced} blur={blur.soft}>
                  {list?.label ?? "No list"}
                </FadeLabel>
                <CaretDownIcon
                  className="size-4 flex-none text-text-muted [transition:rotate_var(--duration-spring)_var(--ease-spring)] group-data-popup-open/trigger:rotate-180 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </MenuPrimitive.Trigger>
            </motion.span>
          </span>
          <MenuPrimitive.Portal>
            <MenuPrimitive.Positioner className="z-60" anchor={listShell} sideOffset={8} align="end" collisionPadding={12}>
              <MenuPrimitive.Popup className={cn(menuClass, "min-w-48")} aria-label="List">
                <MenuPrimitive.RadioGroup value={list?.id ?? ""} onValueChange={value => setPickedList(value || null)}>
                  {[{ id: "", label: "No list", color: undefined as string | undefined }, ...lists].map(item => (
                    <MenuPrimitive.RadioItem key={item.id} value={item.id} className={itemClass} closeOnClick>
                      <Dot color={item.color} />
                      <span className="flex-1">{item.label}</span>
                      <MenuPrimitive.RadioItemIndicator keepMounted={false}>
                        <CheckIcon className="size-4 text-text-secondary" aria-hidden="true" />
                      </MenuPrimitive.RadioItemIndicator>
                    </MenuPrimitive.RadioItem>
                  ))}
                </MenuPrimitive.RadioGroup>
              </MenuPrimitive.Popup>
            </MenuPrimitive.Positioner>
          </MenuPrimitive.Portal>
        </MenuPrimitive.Root>
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
    </div>
  )
}

export default TaskInput
