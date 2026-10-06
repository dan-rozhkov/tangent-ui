"use client"

import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from "react"
import type {
  ButtonHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react"
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react"
import type { AnimationPlaybackControls, MotionValue, TargetAndTransition } from "motion/react"
import { Trash2 } from "lucide-react"
import { useMotionTokens, type MotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"

/**
 * A button that commits only after it is held, for destructive or hard to undo actions where a stray tap must not count. A fill tracks the hold on a
 * linear timeline; letting go early rewinds it on a spring, and finishing morphs the label and icon into a done state. Space and Enter can be held too.
 * Prefer a regular confirmation dialog when people need to read consequences first; use this when the consequence is already on screen.
 */
export interface HoldToConfirmProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onClick" | "onDrag" | "onDragEnd" | "onDragStart" | "onAnimationStart" | "onAnimationEnd"
> {
  /** The instruction and the action, for example “Hold to delete project”. */
  label: string
  /** Shown once the hold completes, for example “Deleted”. */
  confirmedLabel?: string
  /** Called once when the hold completes. */
  onConfirm: () => void
  /** Hold length in milliseconds. */
  duration?: number
  icon?: ReactNode
  /** `accent` (default) fills with the selected accent; `danger` is for an irreversible action; `neutral` fills with the foreground. */
  tone?: "accent" | "danger" | "neutral"
  /** Controls the done state. Set it back to false to reset the button; leave it undefined to let the button keep its own state. */
  confirmed?: boolean
  /** Reports when a hold starts and ends, for surrounding hints such as “Keep holding”. */
  onHoldChange?: (holding: boolean) => void
}

/* The button hugs its label; the fill is a second, inverted copy of the face revealed by clip-path, so the text flips colour exactly at the edge.
   The default tone follows the selected accent; danger stays available for a truly irreversible action. */
const buttonClass = [
  "[--hold-ink:var(--foreground)] [--hold-fill:var(--accent)] [--hold-on-fill:var(--accent-foreground)] [--hold-border:var(--border-strong)]",
  "data-[tone=danger]:[--hold-ink:var(--danger)] data-[tone=danger]:[--hold-fill:var(--danger)] data-[tone=danger]:[--hold-on-fill:var(--background)] data-[tone=danger]:[--hold-border:color-mix(in_oklab,var(--danger)_32%,var(--border))]",
  "data-[tone=neutral]:[--hold-ink:var(--foreground)] data-[tone=neutral]:[--hold-fill:var(--foreground)] data-[tone=neutral]:[--hold-on-fill:var(--background)] data-[tone=neutral]:[--hold-border:var(--border-strong)]",
  "relative inline-flex min-h-control-md items-center justify-center px-5 border border-(--hold-border) rounded-control bg-surface text-(--hold-ink)",
  "[font:inherit] text-sm leading-body font-medium cursor-pointer select-none [-webkit-touch-callout:none] touch-manipulation [-webkit-tap-highlight-color:transparent]",
  "[transition:background-color_var(--duration-fast)_var(--ease-standard),border-color_var(--duration-fast)_var(--ease-standard),opacity_var(--duration-fast)_var(--ease-standard)] motion-reduce:transition-none",
  "pointer-fine:hover:not-disabled:not-aria-disabled:bg-[color-mix(in_oklab,var(--hold-fill)_6%,var(--surface))]",
  "aria-disabled:cursor-default disabled:cursor-not-allowed disabled:opacity-50",
].join(" ")
const faceClass = "inline-flex items-center gap-2 whitespace-nowrap"
/* Covers the border too, and keeps its own rounded corners; the clip only ever cuts a straight leading edge. */
const fillClass =
  "pointer-events-none absolute -inset-px flex items-center justify-center rounded-control bg-(--hold-fill) text-(--hold-on-fill)"

const bezier = (curve: readonly number[]) => [...curve] as [number, number, number, number]

function motionFor(motionTokens: MotionTokens) {
  const enter = bezier(motionTokens.ease.enter)
  const standard = bezier(motionTokens.ease.standard)
  const rest: TargetAndTransition = {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
  }
  const textIn: TargetAndTransition = {
    opacity: 0,
    y: "0.3em",
    filter: `blur(${motionTokens.blur.soft}px)`,
  }
  const textOut: TargetAndTransition = {
    opacity: 0,
    y: "-0.3em",
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: { duration: motionTokens.duration.fast, ease: standard },
  }
  const iconIn: TargetAndTransition = {
    opacity: 0,
    scale: 0.6,
    filter: `blur(${motionTokens.blur.subtle}px)`,
  }
  const iconOut: TargetAndTransition = {
    ...iconIn,
    transition: { duration: motionTokens.duration.fast, ease: standard },
  }
  const fadeIn: TargetAndTransition = { opacity: 0 }
  const fadeOut: TargetAndTransition = {
    opacity: 0,
    transition: { duration: motionTokens.duration.instant },
  }
  /** Scale rides the spring; opacity and blur tween so the blur never overshoots below zero. */
  const iconEnter = {
    ...motionTokens.spring.snappy,
    opacity: { duration: motionTokens.duration.fast, ease: enter },
    filter: { duration: motionTokens.duration.fast, ease: enter },
  }
  return { enter, rest, textIn, textOut, iconIn, iconOut, fadeIn, fadeOut, iconEnter }
}

/** The tick draws itself from its short stroke, the way a hand would write it. */
function DrawnCheck({ reduced }: { reduced: boolean }) {
  const motionTokens = useMotionTokens()
  const { enter } = useMemo(() => motionFor(motionTokens), [motionTokens])
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <motion.path
        d="M4 12.5l5 5L20 6.5"
        initial={reduced ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{
          pathLength: { duration: 0.32, ease: enter, delay: 0.08 },
          opacity: { duration: 0.05, delay: 0.08 },
        }}
      />
    </svg>
  )
}

type FaceProps = {
  icon: ReactNode
  text: string
  done: boolean
  width: MotionValue<number | "auto">
  reduced: boolean
  measure?: (node: HTMLSpanElement | null) => void
}

/** Icon and label. The button renders it twice: once on the surface and once inside the fill, so the text changes colour exactly at the fill edge. */
function Face({ icon, text, done, width, reduced, measure }: FaceProps) {
  const motionTokens = useMotionTokens()
  const { enter, rest, textIn, textOut, iconIn, iconOut, fadeIn, fadeOut, iconEnter } = useMemo(() => motionFor(motionTokens), [motionTokens])
  return (
    <span className={faceClass}>
      <span className="grid size-[18px] flex-none place-items-center">
        <AnimatePresence initial={false}>
          <motion.span
            key={done ? "done" : "idle"}
            className="grid place-items-center [grid-area:1/1] [&_svg]:size-[18px]"
            initial={reduced ? fadeIn : iconIn}
            animate={rest}
            exit={reduced ? fadeOut : iconOut}
            transition={reduced ? { duration: motionTokens.duration.fast } : iconEnter}
          >
            {done ? <DrawnCheck reduced={reduced} /> : icon}
          </motion.span>
        </AnimatePresence>
      </span>
      {/* Clips the outgoing label while the frame narrows, with room for the rise and the soft blur. */}
      <motion.span className="relative inline-flex min-w-0 [clip-path:inset(-.6em_-3px)]" style={{ width }}>
        {measure && (
          <span ref={measure} className="pointer-events-none invisible absolute top-0 left-0 whitespace-nowrap">
            {text}
          </span>
        )}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={text}
            className="block whitespace-nowrap"
            initial={reduced ? fadeIn : textIn}
            animate={rest}
            exit={reduced ? fadeOut : textOut}
            transition={{
              duration: reduced ? motionTokens.duration.fast : motionTokens.duration.standard,
              ease: enter,
            }}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </span>
  )
}

/** Springs the label frame to the width of new text, so the button morphs instead of snapping. A late web font or a reflow follows instantly. */
function useLabelWidth(reduced: boolean) {
  const motionTokens = useMotionTokens()
  const width = useMotionValue<number | "auto">("auto")
  const [node, setNode] = useState<HTMLSpanElement | null>(null)
  useEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return
    let lastText: string | null = null
    let sizing: AnimationPlaybackControls | null = null
    const observer = new ResizeObserver(([entry]) => {
      // Layout width, not the painted box: the done label is measured while the pressed button is still scaled down.
      const next = entry?.borderBoxSize?.[0]?.inlineSize ?? node.offsetWidth
      const text = node.textContent
      const morph = lastText !== null && lastText !== text && !reduced && typeof width.get() === "number"
      lastText = text
      sizing?.stop()
      if (morph) sizing = animate(width, next, motionTokens.spring.morph)
      else width.jump(next)
    })
    observer.observe(node)
    return () => {
      observer.disconnect()
      sizing?.stop()
    }
  }, [node, reduced, width, motionTokens])
  return [width, setNode] as const
}

export function HoldToConfirm({
  label,
  confirmedLabel = "Done",
  onConfirm,
  duration = 1200,
  icon = <Trash2 strokeWidth={1.75} />,
  tone = "accent",
  confirmed,
  onHoldChange,
  className,
  disabled,
  ...props
}: HoldToConfirmProps) {
  const reduced = useReducedMotion() ?? false
  const motionTokens = useMotionTokens()
  const hintId = useId()
  const [ownDone, setOwnDone] = useState(false)
  const [completions, setCompletions] = useState(0)
  const done = confirmed ?? ownDone
  const [holding, setHolding] = useState(false)
  const progress = useMotionValue(0)
  const scale = useMotionValue(1)
  const clipPath = useTransform(
    progress,
    (value) => `inset(0 ${((1 - Math.min(1, Math.max(0, value))) * 100).toFixed(3)}% 0 0)`
  )
  const [width, measure] = useLabelWidth(reduced)
  const source = useRef<"pointer" | "key" | null>(null)
  const pointerType = useRef("mouse")
  const fill = useRef<AnimationPlaybackControls | null>(null)
  const press = useRef<AnimationPlaybackControls | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const text = done ? confirmedLabel : label
  const seconds = (duration / 1000).toLocaleString("en-US", {
    maximumFractionDigits: 1,
  })

  function pressTo(pressed: boolean) {
    press.current?.stop()
    if (reduced) {
      scale.jump(1)
      return
    }
    const depth = (button.current?.offsetWidth ?? 0) > 220 ? 0.985 : 0.97
    press.current = animate(scale, pressed ? depth : 1, motionTokens.spring.snappy)
  }

  function rewind() {
    fill.current?.stop()
    if (reduced) progress.jump(0)
    else
      fill.current = animate(progress, 0, {
        ...motionTokens.spring.smooth,
        velocity: 0,
      })
  }

  function stopHolding() {
    source.current = null
    setHolding(false)
    onHoldChange?.(false)
    pressTo(false)
  }

  function complete() {
    if (!source.current) return
    stopHolding()
    if (pointerType.current === "touch") navigator.vibrate?.(12)
    setOwnDone(true)
    setCompletions((count) => count + 1)
    onConfirm()
  }

  /** Starts or resumes the fill from wherever it is, so a quick re-press after letting go carries on instead of starting over. */
  function begin(from: "pointer" | "key") {
    if (done || disabled || source.current) return
    source.current = from
    setHolding(true)
    onHoldChange?.(true)
    pressTo(true)
    fill.current?.stop()
    fill.current = animate(progress, 1, {
      duration: ((1 - progress.get()) * duration) / 1000,
      ease: "linear",
      onComplete: complete,
    })
  }

  function release() {
    if (!source.current) return
    stopHolding()
    rewind()
  }

  // A reset rewinds the fill as the label morphs back; a confirmation the parent declined rewinds too.
  const syncFill = useEffectEvent(() => {
    if (done && progress.get() < 1 && !source.current) {
      fill.current?.stop()
      if (reduced) progress.jump(1)
      else fill.current = animate(progress, 1, motionTokens.spring.smooth)
    }
    if (!done && progress.get() > 0 && !source.current) rewind()
  })
  useEffect(() => {
    syncFill()
  }, [done, completions])
  useEffect(
    () => () => {
      fill.current?.stop()
      press.current?.stop()
    },
    []
  )

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return
    pointerType.current = event.pointerType
    event.currentTarget.setPointerCapture(event.pointerId)
    begin("pointer")
  }
  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (source.current !== "pointer") return
    // Sliding well off the button cancels, the way a native press does.
    const box = event.currentTarget.getBoundingClientRect(),
      slack = 24
    if (
      event.clientX < box.left - slack ||
      event.clientX > box.right + slack ||
      event.clientY < box.top - slack ||
      event.clientY > box.bottom + slack
    )
      release()
  }
  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") return
    event.preventDefault()
    if (!event.repeat) begin("key")
  }
  function onKeyUp(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") return
    event.preventDefault()
    if (source.current === "key") release()
  }

  return (
    <>
      <motion.button
        {...props}
        ref={button}
        type="button"
        className={cn(buttonClass, className)}
        data-tone={tone}
        data-state={done ? "done" : holding ? "holding" : "idle"}
        disabled={disabled}
        aria-disabled={done || undefined}
        aria-label={text}
        aria-describedby={done ? undefined : hintId}
        style={{ scale }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={release}
        onContextMenu={(event) => event.preventDefault()}
      >
        <Face icon={icon} text={text} done={done} width={width} reduced={reduced} measure={measure} />
        <motion.span className={fillClass} style={{ clipPath }} aria-hidden="true">
          <Face icon={icon} text={text} done={done} width={width} reduced={reduced} />
        </motion.span>
      </motion.button>
      <span
        id={hintId}
        className="sr-only"
      >{`Press and hold for ${seconds} seconds to confirm. With a keyboard, hold Space or Enter.`}</span>
      <span className="sr-only" role="status">
        {done ? confirmedLabel : ""}
      </span>
    </>
  )
}

export default HoldToConfirm
