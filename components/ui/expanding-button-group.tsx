"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, FocusEvent, KeyboardEvent, PointerEvent, ReactNode } from "react"
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react"
import type { TargetAndTransition, Transition, Variants } from "motion/react"

import { motionTokens as staticTokens } from "@/lib/motion-tokens"
import { useMotionTokens, type MotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"

export type ExpandingButtonGroupSize = "sm" | "md"
export type ExpandingButtonGroupTone = "neutral" | "danger"

export interface ExpandingButtonGroupItem {
  /** Stable key for the action. Also the value passed to onAction. */
  id: string
  /** Visible label once the button expands, and its accessible name at all times. Use a short verb, such as "Archive". */
  label: string
  /** Icon shown while collapsed. A 16px lucide icon fits; it is sized by the group. */
  icon: ReactNode
  /** Runs the action. Return false, or reject, to skip the confirmation. A promise keeps the button busy until it settles. */
  onSelect?: () => void | boolean | Promise<void | boolean>
  /** Past tense word shown in place after the action, such as "Archived". The icon becomes a check for confirmDuration. Omit for actions that open something. */
  doneLabel?: string
  /** "danger" colors the expanded state with the danger token, for destructive actions such as Delete. */
  tone?: ExpandingButtonGroupTone
  /** Dimmed and inert. Stays focusable and still reveals its label, so people can learn what it would do. */
  disabled?: boolean
}

export interface ExpandingButtonGroupProps {
  items: readonly ExpandingButtonGroupItem[]
  /** Accessible name of the toolbar, such as "Message actions". */
  label: string
  size?: ExpandingButtonGroupSize
  /** Id of the action whose label shows at rest, usually the primary one. Defaults to the first enabled action: one action is always
   *  expanded. Pointing at or focusing another moves the expansion there, and it returns here when the pointer and focus leave. */
  defaultExpanded?: string | null
  /** Called with the item id whenever an action runs, before its own onSelect. */
  onAction?: (id: string) => void
  /** How long the confirmation stays, in milliseconds. */
  confirmDuration?: number
  className?: string
  style?: CSSProperties
}

/** Geometry per size. The icon keeps the same left inset collapsed and expanded, so it never moves while the label is revealed. */
const metrics = {
  sm: { height: 28, icon: 14, start: 7, gap: 5, end: 11 },
  md: { height: 36, icon: 16, start: 10, gap: 7, end: 14 },
} as const

/** Pixels the pointer must travel into a neighbouring action before the expansion moves to it. */
const hysteresis = 4

const bezier = (curve: readonly number[]) => [...curve] as [number, number, number, number]
const inOut = bezier(staticTokens.ease.inOut)

function motionFor(motionTokens: MotionTokens) {
  const enter = bezier(motionTokens.ease.enter)
  const standard = bezier(motionTokens.ease.standard)

  /** The label slides out from behind the icon as the width opens, and tucks back a little faster than it came. */
  const labelVariants: Variants = {
    shown: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.standard, ease: enter, delay: 0.04 } },
    hidden: {
      opacity: 0,
      x: -6,
      filter: `blur(${motionTokens.blur.subtle}px)`,
      transition: { duration: motionTokens.duration.instant, ease: standard },
    },
  }
  const reducedLabelVariants: Variants = {
    shown: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.instant } },
    hidden: { opacity: 0, x: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.instant } },
  }
  const rest: TargetAndTransition = { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
  const textIn: TargetAndTransition = { opacity: 0, y: "0.5em", filter: `blur(${motionTokens.blur.soft}px)` }
  const textOut: TargetAndTransition = {
    opacity: 0,
    y: "-0.4em",
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: { duration: motionTokens.duration.fast, ease: standard },
  }
  const iconIn: TargetAndTransition = { opacity: 0, scale: 0.55, filter: `blur(${motionTokens.blur.subtle}px)` }
  const iconOut: TargetAndTransition = { ...iconIn, transition: { duration: motionTokens.duration.fast, ease: standard } }
  const fadeIn: TargetAndTransition = { ...rest, opacity: 0 }
  const fadeOut: TargetAndTransition = { opacity: 0, transition: { duration: motionTokens.duration.instant } }
  const textEnter: Transition = { duration: motionTokens.duration.standard, ease: enter }
  /** Scale rides the spring; opacity and blur tween so blur never overshoots below zero. */
  const iconEnter: Transition = {
    ...motionTokens.spring.snappy,
    opacity: { duration: motionTokens.duration.fast, ease: enter },
    filter: { duration: motionTokens.duration.fast, ease: enter },
  }
  const instant: Transition = { duration: motionTokens.duration.instant }
  return { enter, labelVariants, reducedLabelVariants, rest, textIn, textOut, iconIn, iconOut, fadeIn, fadeOut, textEnter, iconEnter, instant }
}

/** A busy action breathes on its icon: half opacity at the middle of each 1.1s beat. */
const busyPulse: Transition = { duration: 1.1, times: [0, 0.5, 1], ease: [inOut, inOut], repeat: Infinity }

/** The confirmation tick draws itself from its short stroke. */
function DrawnCheck({ reduced }: { reduced: boolean }) {
  const motionTokens = useMotionTokens()
  const { enter } = useMemo(() => motionFor(motionTokens), [motionTokens])
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <motion.path
        d="M4 12.5l5 5L20 6.5"
        initial={reduced ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{
          pathLength: { duration: motionTokens.duration.standard, ease: enter, delay: 0.06 },
          opacity: { duration: 0.05, delay: 0.06 },
        }}
      />
    </svg>
  )
}

interface ItemProps {
  item: ExpandingButtonGroupItem
  size: ExpandingButtonGroupSize
  expanded: boolean
  done: boolean
  busy: boolean
  tabStop: boolean
  reduced: boolean
  onPointerDown: (item: ExpandingButtonGroupItem, event: PointerEvent<HTMLButtonElement>) => void
  onClick: (item: ExpandingButtonGroupItem) => void
  onFocus: (item: ExpandingButtonGroupItem, event: FocusEvent<HTMLButtonElement>) => void
}

/* The box never scales: its width is the animation, so a press answers with the icon and with color. The label overflows to the
   right of the icon and the clipped width reveals it. min-width keeps the spring's settle from pinching a collapsed button. */
function itemClass({ size, expanded, done, busy, disabled, danger, measured }: {
  size: ExpandingButtonGroupSize
  expanded: boolean
  done: boolean
  busy: boolean
  disabled: boolean
  danger: boolean
  measured: boolean
}) {
  return cn(
    size === "sm" ? "text-xs" : "text-sm",
    "group/item relative inline-flex h-(--ebg-h) min-w-(--ebg-h) flex-none cursor-pointer touch-manipulation items-center justify-start gap-(--ebg-gap) overflow-clip",
    "rounded-pill border-0 bg-transparent py-0 pr-0 pl-(--ebg-start) leading-none font-medium tracking-body whitespace-nowrap [-webkit-tap-highlight-color:transparent]",
    "[transition:color_var(--duration-fast)_var(--ease-standard),background-color_var(--duration-standard)_var(--ease-standard)]",
    "motion-reduce:[transition:color_var(--duration-instant)_linear,background-color_var(--duration-instant)_linear]",
    disabled
      ? cn("cursor-not-allowed opacity-50", expanded ? "bg-surface-muted text-text-secondary" : "text-text-muted")
      : !expanded
        ? "text-text-secondary"
        : danger
          ? "bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))] text-danger dark:bg-[color-mix(in_oklab,var(--danger)_14%,var(--surface))]"
          : "bg-surface-muted text-foreground",
    // The confirmation carries its meaning on the check, with a faint tint behind the whole button.
    done &&
      !danger &&
      !disabled &&
      "bg-[color-mix(in_oklab,var(--success)_10%,var(--surface))] dark:bg-[color-mix(in_oklab,var(--success)_14%,var(--surface))]",
    busy && "cursor-progress",
    // Before the first measurement (the server render), the expanded action takes its natural width, which is exactly the width the
    // spring later targets, so hydration never moves anything.
    !measured && expanded && "w-auto! pe-(--ebg-end)",
  )
}

function Item({ item, size, expanded, done, busy, tabStop, reduced, onPointerDown, onClick, onFocus }: ItemProps) {
  const motionTokens = useMotionTokens()
  const tokensMotion = useMemo(() => motionFor(motionTokens), [motionTokens])
  const { labelVariants, reducedLabelVariants, rest, textIn, textOut, iconIn, iconOut, fadeIn, fadeOut, textEnter, iconEnter, instant } = tokensMotion
  const m = metrics[size]
  const labelRef = useRef<HTMLSpanElement>(null)
  const doneRef = useRef<HTMLSpanElement>(null)
  const [text, setText] = useState(0)

  // Hidden copies of both words share the label's grid cell, so the slot is always as wide as the longer one. The confirmation
  // swap then never changes the width, and the server render already has the right width before anything is measured.
  // Changes under half a pixel are ignored, so a re-measure never makes the row wobble.
  useLayoutEffect(() => {
    const measure = () => {
      const next = Math.max(
        labelRef.current?.getBoundingClientRect().width ?? 0,
        doneRef.current?.getBoundingClientRect().width ?? 0,
      )
      setText(current => (Math.abs(current - next) < 0.5 ? current : next))
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    if (labelRef.current) observer.observe(labelRef.current)
    if (doneRef.current) observer.observe(doneRef.current)
    return () => observer.disconnect()
  }, [item.label, item.doneLabel, size])

  const showDone = done && !!item.doneLabel
  const measured = text > 0
  const target = expanded && measured ? m.start + m.icon + m.gap + text + m.end : m.height
  const width = useMotionValue<number>(target)
  const settled = useRef(false)

  // Width rides the morph spring, so neighbours slide and the group's own width follows without a jump. The first measured
  // width (and every width under reduced motion) is placed at once.
  useLayoutEffect(() => {
    if (!settled.current || reduced) {
      width.jump(target)
      if (measured) settled.current = true
      return
    }
    animate(width, target, motionTokens.spring.morph)
  }, [target, measured, reduced, width, motionTokens])

  const word = showDone ? (item.doneLabel ?? item.label) : item.label
  const disabled = !!item.disabled
  return (
    <motion.button
      type="button"
      className={itemClass({ size, expanded, done: showDone, busy, disabled, danger: item.tone === "danger", measured })}
      style={{ width }}
      data-ebg-item=""
      data-id={item.id}
      data-tone={item.tone ?? "neutral"}
      data-state={showDone ? "done" : "idle"}
      data-expanded={expanded || undefined}
      data-unmeasured={measured ? undefined : ""}
      aria-label={item.label}
      aria-disabled={item.disabled || undefined}
      aria-busy={busy || undefined}
      tabIndex={tabStop ? 0 : -1}
      onPointerDown={event => onPointerDown(item, event)}
      onClick={() => onClick(item)}
      onFocus={event => onFocus(item, event)}
    >
      <motion.span
        className={cn(
          "relative grid size-(--ebg-icon) flex-none place-items-center [transition:transform_320ms_var(--ease-spring)] motion-reduce:transition-none",
          !disabled &&
            "motion-safe:group-active/item:[transform:scale(.86)] group-active/item:[transition-duration:90ms] group-active/item:[transition-timing-function:var(--ease-standard)]",
          showDone && item.tone !== "danger" && "text-success",
        )}
        aria-hidden="true"
        initial={false}
        animate={{ opacity: busy ? (reduced ? 0.6 : [1, 0.45, 1]) : 1 }}
        transition={busy && !reduced ? busyPulse : { duration: 0 }}
      >
        <AnimatePresence initial={false}>
          <motion.span
            key={showDone ? "done" : "icon"}
            className="grid size-full place-items-center [grid-area:1/1] [&_svg]:size-full [&_svg]:stroke-[1.75]"
            initial={reduced ? fadeIn : iconIn}
            animate={rest}
            exit={reduced ? fadeOut : iconOut}
            transition={reduced ? instant : iconEnter}
          >
            {showDone ? <DrawnCheck reduced={reduced} /> : item.icon}
          </motion.span>
        </AnimatePresence>
      </motion.span>
      {/* Outgoing and incoming words share one cell, so a confirmation crossfades in place while the width springs between them. */}
      <motion.span
        className="inline-grid flex-none items-center justify-items-start"
        aria-hidden="true"
        variants={reduced ? reducedLabelVariants : labelVariants}
        initial={false}
        animate={expanded ? "shown" : "hidden"}
      >
        <AnimatePresence initial={false}>
          <motion.span
            key={word}
            className="whitespace-nowrap [grid-area:1/1]"
            initial={reduced ? fadeIn : textIn}
            animate={rest}
            exit={reduced ? fadeOut : textOut}
            transition={reduced ? instant : textEnter}
          >
            {word}
          </motion.span>
        </AnimatePresence>
        {/* Invisible copies of both words hold the slot at the longer one; they are also what gets measured for the width target. */}
        <span ref={labelRef} className="pointer-events-none invisible whitespace-nowrap [grid-area:1/1]">
          {item.label}
        </span>
        {item.doneLabel ? (
          <span ref={doneRef} className="pointer-events-none invisible whitespace-nowrap [grid-area:1/1]">
            {item.doneLabel}
          </span>
        ) : null}
      </motion.span>
    </motion.button>
  )
}

/**
 * A compact pill of icon buttons for actions. One action always shows its label; the one you point at or focus takes over the
 * label while its neighbours slide aside, and an action can confirm in place: the icon draws a check and the label becomes a past tense word.
 * On touch, the first tap reveals the label and a second tap runs the action.
 */
export function ExpandingButtonGroup({
  items,
  label,
  size = "md",
  defaultExpanded = null,
  onAction,
  confirmDuration = 1400,
  className,
  style,
}: ExpandingButtonGroupProps) {
  const reduced = useReducedMotion() ?? false
  const root = useRef<HTMLDivElement>(null)
  const [intent, setIntent] = useState<string | null>(null)
  const [done, setDone] = useState<{ id: string; seq: number } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const [focused, setFocused] = useState<string | null>(null)

  // Refs mirror what the pointer and keyboard are doing right now, so leave and blur handlers can fall back correctly.
  const pointerOver = useRef<string | null>(null)
  const pointerAt = useRef<{ x: number; y: number } | null>(null)
  const keyFocus = useRef<string | null>(null)
  const touchOpen = useRef<string | null>(null)
  const press = useRef<{ id: string; kind: string; wasExpanded: boolean } | null>(null)
  const doneRef = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(true)
  const seq = useRef(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const has = (id: string | null) => !!id && items.some(item => item.id === id)
  // One action is always expanded: the resting one is defaultExpanded, else the first enabled action.
  const firstEnabled = items.find(item => !item.disabled)?.id ?? items[0]?.id ?? null
  const restId = has(defaultExpanded) ? defaultExpanded : firstEnabled
  const expandedId = has(intent) ? intent : restId
  const tabStop = has(focused) ? focused : restId

  // A tap outside closes a label opened by a first tap.
  useEffect(() => {
    if (!intent || touchOpen.current !== intent) return
    const onDown = (event: globalThis.PointerEvent) => {
      if (root.current?.contains(event.target as Node)) return
      touchOpen.current = null
      setIntent(doneRef.current ?? keyFocus.current)
    }
    document.addEventListener("pointerdown", onDown, true)
    return () => document.removeEventListener("pointerdown", onDown, true)
  }, [intent])

  const confirm = useCallback(
    (item: ExpandingButtonGroupItem) => {
      if (timer.current) clearTimeout(timer.current)
      seq.current += 1
      doneRef.current = item.id
      setDone({ id: item.id, seq: seq.current })
      // A zero width space alternates so the same word is announced again on a repeat action.
      setAnnouncement(`${item.doneLabel}${seq.current % 2 ? "" : "​"}`)
      timer.current = setTimeout(() => {
        doneRef.current = null
        setDone(null)
        // Collapse unless the pointer or the keyboard is still on it.
        if (pointerOver.current !== item.id && keyFocus.current !== item.id) {
          if (touchOpen.current === item.id) touchOpen.current = null
          setIntent(current => (current === item.id ? (pointerOver.current ?? keyFocus.current) : current))
        }
      }, confirmDuration)
    },
    [confirmDuration],
  )

  const activate = useCallback(
    async (item: ExpandingButtonGroupItem) => {
      if (item.disabled || busy === item.id || doneRef.current === item.id) return
      setIntent(item.id)
      onAction?.(item.id)
      let result: void | boolean
      try {
        const pending = item.onSelect?.()
        if (pending instanceof Promise) {
          setBusy(item.id)
          result = await pending
        } else result = pending
      } catch {
        result = false
      } finally {
        if (mounted.current) setBusy(current => (current === item.id ? null : current))
      }
      if (!mounted.current || result === false || !item.doneLabel) return
      confirm(item)
    },
    [busy, confirm, onAction],
  )

  const onItemPointerDown = (item: ExpandingButtonGroupItem, event: PointerEvent<HTMLButtonElement>) => {
    press.current = { id: item.id, kind: event.pointerType, wasExpanded: expandedId === item.id }
  }

  const onItemClick = (item: ExpandingButtonGroupItem) => {
    const last = press.current
    press.current = null
    // Touch has no hover: the first tap opens the label, the second runs it. An item already showing its label runs at once.
    if (last && last.id === item.id && last.kind === "touch" && !last.wasExpanded) {
      touchOpen.current = item.id
      setIntent(item.id)
      return
    }
    if (last?.kind === "touch") touchOpen.current = item.id
    void activate(item)
  }

  const onItemFocus = (item: ExpandingButtonGroupItem, event: FocusEvent<HTMLButtonElement>) => {
    setFocused(item.id)
    // Only keyboard focus expands; a mouse click or a tap already has its own path, and would otherwise leave the label open.
    let visible = true
    try {
      visible = event.currentTarget.matches(":focus-visible")
    } catch {
      /* older engines expand on any focus */
    }
    if (!visible) return
    keyFocus.current = item.id
    setIntent(item.id)
  }

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (root.current?.contains(event.relatedTarget as Node | null)) return
    keyFocus.current = null
    touchOpen.current = null
    setIntent(pointerOver.current ?? doneRef.current)
  }

  // Hover follows real pointer movement only. Expanding moves the buttons, and a button that slides under a resting pointer
  // must not take over, or two neighbours could trade places back and forth.
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return
    const at = pointerAt.current
    if (at && Math.abs(at.x - event.clientX) < 1 && Math.abs(at.y - event.clientY) < 1) return
    pointerAt.current = { x: event.clientX, y: event.clientY }
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-ebg-item]")
    const id = button?.dataset.id
    if (!button || !id || id === pointerOver.current) return
    // Hysteresis: moving from one action to the next needs the pointer a few pixels inside the new one, so resting on a
    // boundary never flips between them.
    if (pointerOver.current) {
      const box = button.getBoundingClientRect()
      if (event.clientX < box.left + hysteresis || event.clientX > box.right - hysteresis) return
    }
    pointerOver.current = id
    setIntent(id)
  }

  const onPointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return
    pointerAt.current = null
    pointerOver.current = null
    setIntent(doneRef.current ?? keyFocus.current)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = Array.from(root.current?.querySelectorAll<HTMLButtonElement>("[data-ebg-item]") ?? [])
    const index = list.findIndex(button => button === document.activeElement)
    if (index < 0) return
    const last = list.length - 1
    const target =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1
    if (target < 0) return
    event.preventDefault()
    list[target].focus()
  }

  const m = metrics[size]
  const vars = {
    "--ebg-h": `${m.height}px`,
    "--ebg-icon": `${m.icon}px`,
    "--ebg-start": `${m.start}px`,
    "--ebg-gap": `${m.gap}px`,
    "--ebg-end": `${m.end}px`,
    ...style,
  } as CSSProperties

  return (
    /* A flat pill on the surface. Geometry comes from the component as --ebg-* variables, so the measured widths and the CSS agree. */
    <div
      ref={root}
      role="toolbar"
      aria-label={label}
      aria-orientation="horizontal"
      className={cn(
        "relative isolate inline-flex max-w-full flex-none items-center gap-0.5 rounded-pill border border-border bg-surface p-(--ebg-pad) [--ebg-pad:3px]",
        className,
      )}
      style={vars}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {items.map(item => (
        <Item
          key={item.id}
          item={item}
          size={size}
          expanded={expandedId === item.id}
          done={done?.id === item.id}
          busy={busy === item.id}
          tabStop={tabStop === item.id}
          reduced={reduced}
          onPointerDown={onItemPointerDown}
          onClick={onItemClick}
          onFocus={onItemFocus}
        />
      ))}
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}

export default ExpandingButtonGroup
