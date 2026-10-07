"use client"

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import type { KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react"
import { AnimatePresence, animate, motion, useMotionValue, useSpring, useTransform } from "motion/react"
import type { MotionValue } from "motion/react"
import { Check, Ellipsis, X } from "lucide-react"

import { motionTokens as defaultTokens } from "@/lib/motion-tokens"
import { useMotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface OrbitAction {
  id: string
  label: string
  icon: ReactNode
  /** Short confirmation shown after firing. Defaults to the label. */
  done?: string
  tone?: "neutral" | "danger"
}

export interface OrbitMenuProps {
  /** Three to six actions. */
  actions: OrbitAction[]
  onAction: (id: string) => void
  /** Accessible name of the button and menu, also shown while the arc is open and nothing is targeted. */
  label?: string
  /** Distance from the button center to each action, in px. */
  radius?: number
  /** Degrees the arc spans. */
  spread?: number
  /** Degrees the arc opens toward: -90 up, 0 right, 90 down, 180 left. */
  direction?: number
  disabled?: boolean
  /** Announces confirmations in a polite status region. */
  announce?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

const DEAD_ZONE = 34
const HOLD = 320
const DONE_FOR = 1400
const MAGNET = 7
const ACTION = 46
const TRIGGER = 56
/** Gap between the trigger and the label pill. */
const PILL_GAP = 8
/** Measured magnification: a targeted action at rest (keyboard) and under a drag, and its neighbours during a drag. */
const FOCUS_SCALE = 1.1
const DRAG_SCALE = 1.42
const NEIGHBOUR_SCALE = 1.05
/** While dragging, the trigger shrinks and follows the pointer by this share of its offset. */
const TRIGGER_DRAG_SCALE = 0.865
const TRIGGER_FOLLOW = 0.23
const TRIGGER_FOLLOW_MAX = 22
const enter = [...defaultTokens.ease.enter] as [number, number, number, number]
const standard = [...defaultTokens.ease.standard] as [number, number, number, number]
/** The swirl: each action travels the last part of the arc as it flies out, in radians (~40 degrees, as measured). */
const SWIRL = 0.7
/** Fly out: ~2% radial overshoot peaking ~440ms after an action starts. */
const flyOut = { type: "spring", visualDuration: 0.45, bounce: 0.22 } as const
const OPEN_STAGGER = 0.045
/** Border and fills measured on the open material: --border-strong at 55%, --surface-raised at 94% (actions) and 76%. */
const ring = "border border-[color-mix(in_oklab,var(--border-strong)_55%,transparent)]"

const toRad = (deg: number) => (deg * Math.PI) / 180
/** Signed smallest difference between two angles in degrees. */
const angleDiff = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180

function angles(count: number, direction: number, spread: number) {
  if (count <= 1) return [direction]
  return Array.from({ length: count }, (_, i) => direction - spread / 2 + (spread * i) / (count - 1))
}

type Glyph = "more" | "close" | "done"

function OrbitItem({
  action,
  angle,
  radius,
  index,
  count,
  open,
  focused,
  targeted,
  emphasis,
  leans,
  pointer,
  reduced,
  register,
  onFire,
  onKeyDown,
  onFocus,
}: {
  action: OrbitAction
  angle: number
  radius: number
  index: number
  count: number
  open: boolean
  focused: boolean
  targeted: boolean
  /** Magnification over the resting size. */
  emphasis: number
  /** Whether the action leans toward the pointer. The targeted one holds still over the lens. */
  leans: boolean
  pointer: MotionValue<{ x: number; y: number } | null>
  reduced: boolean
  register: (node: HTMLButtonElement | null) => void
  onFire: () => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  onFocus: () => void
}) {
  const motionTokens = useMotionTokens()
  const progress = useMotionValue(0)
  const fade = useMotionValue(0)
  const blur = useMotionValue<number>(motionTokens.blur.soft)
  useEffect(() => {
    // Out in reading order, back in reverse.
    if (reduced) {
      progress.jump(open ? 1 : 0)
      blur.jump(0)
      const controls = animate(fade, open ? 1 : 0, { duration: motionTokens.duration.fast })
      return () => controls.stop()
    }
    /** Fold: critically damped, a touch quicker than smooth (~580ms for the whole arc). */
    const foldIn = { ...motionTokens.spring.smooth, visualDuration: 0.34 }
    const closeStagger = motionTokens.stagger.item * 0.6
    const delay = open ? index * OPEN_STAGGER : (count - 1 - index) * closeStagger
    // Measured: opacity lands within ~120ms of an action starting and the blur clears over ~200ms; on the way back in the
    // fade waits ~30ms, then drops linearly over ~110ms while the action is still travelling.
    const controls = open
      ? [
          animate(progress, 1, { ...flyOut, delay }),
          animate(fade, 1, { duration: motionTokens.duration.instant, ease: enter, delay }),
          animate(blur, 0, { duration: 0.2, ease: "easeInOut", delay }),
        ]
      : [
          animate(progress, 0, { ...foldIn, delay }),
          animate(fade, 0, { duration: 0.11, ease: "linear", delay: delay + 0.03 }),
          animate(blur, motionTokens.blur.soft, { duration: 0.2, ease: "easeInOut", delay }),
        ]
    return () => controls.forEach((control) => control.stop())
  }, [blur, count, fade, index, motionTokens, open, progress, reduced])

  const zoom = useMotionValue(emphasis)
  useEffect(() => {
    if (reduced) zoom.jump(emphasis)
    else {
      const controls = animate(zoom, emphasis, motionTokens.spring.snappy)
      return () => controls.stop()
    }
  }, [emphasis, motionTokens.spring.snappy, reduced, zoom])

  // Geometry lives in a motion value so the derived transforms always read the current props.
  const geometry = useMotionValue({ rad: toRad(angle), radius, reduced, leans })
  useEffect(() => {
    geometry.set({ rad: toRad(angle), radius, reduced, leans })
  }, [angle, geometry, leans, radius, reduced])
  // Nearby actions lean toward the pointer, a few px at most.
  const magnet = useTransform(() => {
    const at = pointer.get()
    const { rad, radius, reduced, leans } = geometry.get()
    if (!at || reduced || !leans) return { x: 0, y: 0 }
    const dx = at.x - Math.cos(rad) * radius
    const dy = at.y - Math.sin(rad) * radius
    const distance = Math.hypot(dx, dy)
    if (distance > 72 || distance === 0) return { x: 0, y: 0 }
    const pull = (1 - distance / 72) * MAGNET
    return { x: (dx / distance) * pull, y: (dy / distance) * pull }
  })
  const x = useTransform(() => {
    const p = progress.get()
    const { rad, radius } = geometry.get()
    const a = rad - (1 - Math.min(1, p)) * SWIRL
    return Math.cos(a) * radius * p + magnet.get().x
  })
  const y = useTransform(() => {
    const p = progress.get()
    const { rad, radius } = geometry.get()
    const a = rad - (1 - Math.min(1, p)) * SWIRL
    return Math.sin(a) * radius * p + magnet.get().y
  })
  // Closed actions sit at .4 of their size with the icon at half size again.
  const scale = useTransform(() => (0.4 + 0.6 * progress.get()) * zoom.get())
  const iconScale = useTransform(progress, [0, 1], [0.5, 1])
  const filter = useTransform(() => (geometry.get().reduced ? "none" : `blur(${Math.max(0, blur.get())}px)`))

  return (
    <motion.button
      ref={register}
      type="button"
      role="menuitem"
      aria-label={action.label}
      tabIndex={focused ? 0 : -1}
      data-targeted={targeted || undefined}
      className={cn(
        "absolute top-1/2 left-1/2 -mt-[23px] -ml-[23px] grid size-[46px] cursor-pointer place-items-center rounded-pill outline-none",
        ring,
        "bg-[color-mix(in_oklab,var(--surface-raised)_94%,transparent)] text-foreground shadow-raised [touch-action:none] [-webkit-tap-highlight-color:transparent]",
        "transition-[color,background,border-color,box-shadow] duration-160 ease-standard motion-reduce:transition-none",
        "data-targeted:border-transparent data-targeted:bg-transparent data-targeted:text-background data-targeted:shadow-none [&_svg]:size-5",
        action.tone === "danger" && "text-danger data-targeted:text-white",
        reduced && "transition-[opacity,color,background] duration-160",
      )}
      style={{ x, y, opacity: fade, scale, filter }}
      onClick={onFire}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      <motion.span className="grid place-items-center" style={{ scale: iconScale }}>
        {action.icon}
      </motion.span>
    </motion.button>
  )
}

/** Text in the pill crossfades while the pill springs to fit it. */
function OrbitPill({ text, tone, reduced }: { text: string; tone: "neutral" | "danger" | "muted"; reduced: boolean }) {
  const motionTokens = useMotionTokens()
  const measure = useRef<HTMLSpanElement>(null)
  const width = useMotionValue<number | "auto">("auto")
  const measured = useRef(false)
  useLayoutEffect(() => {
    const node = measure.current
    if (!node) return
    const next = node.offsetWidth
    if (!measured.current || reduced) width.jump(next)
    else animate(width, next, motionTokens.spring.morph)
    measured.current = true
  }, [motionTokens.spring.morph, reduced, text, width])
  return (
    <motion.span
      className={cn(
        "relative flex h-8 items-center justify-center overflow-hidden rounded-pill text-sm font-medium whitespace-nowrap shadow-raised",
        ring,
        "bg-[color-mix(in_oklab,var(--surface-raised)_76%,transparent)] backdrop-blur-xl [@media(prefers-reduced-transparency:reduce)]:bg-surface-raised [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
        tone === "danger" ? "text-danger" : "text-foreground",
      )}
      style={{ width }}
    >
      <span ref={measure} className="invisible absolute px-3.5">
        {text}
      </span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={text}
          className="px-3.5"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4, filter: `blur(${motionTokens.blur.soft}px)` }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: motionTokens.duration.instant } }
              : { opacity: 0, y: -3, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.instant, ease: standard } }
          }
          transition={{ duration: motionTokens.duration.standard, ease: enter }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  )
}

/**
 * A round button that bursts into an arc of actions. Press, drag toward an action, and release to fire it; or tap to keep
 * the arc open and tap again to close it. Targeting goes by angle like a pie menu, outside a small dead zone.
 */
export function OrbitMenu({
  actions,
  onAction,
  label = "Actions",
  radius = 104,
  spread = 150,
  direction = -90,
  disabled = false,
  announce = true,
  onOpenChange,
  className,
}: OrbitMenuProps) {
  const motionTokens = useMotionTokens()
  const reduced = useReducedMotion() ?? false
  const menuId = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const items = useRef(new Map<number, HTMLButtonElement>())
  const gesture = useRef<{ id: number; wasOpen: boolean; at: number; moved: boolean } | null>(null)
  const doneTimer = useRef(0)

  const [open, setOpenState] = useState(false)
  const [target, setTarget] = useState<number | null>(null)
  // A drag magnifies harder than keyboard focus and wakes the neighbours.
  const [dragging, setDragging] = useState(false)
  const [focusIndex, setFocusIndex] = useState(0)
  const [offArc, setOffArc] = useState(false)
  const [done, setDone] = useState<{ text: string; tone: "neutral" | "danger" } | null>(null)
  const [status, setStatus] = useState("")
  const pointer = useMotionValue<{ x: number; y: number } | null>(null)
  // During a drag the trigger leans after the pointer.
  const followX = useMotionValue(0)
  const followY = useMotionValue(0)
  const triggerX = useSpring(followX, motionTokens.spring.snappy)
  const triggerY = useSpring(followY, motionTokens.spring.snappy)
  const pendingFocus = useRef<number | "trigger" | null>(null)

  const setOpen = useCallback(
    (next: boolean) => {
      if (next !== open) onOpenChange?.(next)
      setOpenState(next)
      if (!next) {
        setTarget(null)
        setOffArc(false)
        setDragging(false)
        pointer.set(null)
        followX.set(0)
        followY.set(0)
      }
    },
    [followX, followY, onOpenChange, open, pointer],
  )

  // Disabling closes the arc.
  const [wasDisabled, setWasDisabled] = useState(disabled)
  if (wasDisabled !== disabled) {
    setWasDisabled(disabled)
    if (disabled && open) {
      setOpenState(false)
      setTarget(null)
    }
  }
  const reportedDisabled = useRef(disabled)
  useEffect(() => {
    if (disabled && !reportedDisabled.current) onOpenChange?.(false)
    reportedDisabled.current = disabled
  }, [disabled, onOpenChange])

  useEffect(() => () => window.clearTimeout(doneTimer.current), [])

  useLayoutEffect(() => {
    const key = pendingFocus.current
    if (key === null) return
    pendingFocus.current = null
    if (key === "trigger") trigger.current?.focus()
    else items.current.get(key)?.focus()
  })

  // A pointer down outside closes an arc that was left open by a tap.
  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onDown, true)
    return () => document.removeEventListener("pointerdown", onDown, true)
  }, [open, setOpen])

  const arc = angles(actions.length, direction, spread)
  const step = actions.length > 1 ? spread / (actions.length - 1) : 60

  const fire = (index: number) => {
    const action = actions[index]
    if (!action) return
    onAction(action.id)
    const text = action.done ?? action.label
    setDone({ text, tone: action.tone ?? "neutral" })
    if (announce) setStatus(text)
    window.clearTimeout(doneTimer.current)
    doneTimer.current = window.setTimeout(() => {
      setDone(null)
      setStatus("")
    }, DONE_FOR)
    setOpen(false)
  }

  /** Which action the pointer heads toward, by angle, outside the dead zone around the trigger. */
  const aim = (clientX: number, clientY: number) => {
    const box = trigger.current?.getBoundingClientRect()
    if (!box) return { index: null as number | null, outside: false, local: null }
    const local = { x: clientX - (box.left + box.width / 2), y: clientY - (box.top + box.height / 2) }
    const distance = Math.hypot(local.x, local.y)
    if (distance < DEAD_ZONE) return { index: null, outside: false, local }
    const angle = (Math.atan2(local.y, local.x) * 180) / Math.PI
    let best = 0
    arc.forEach((a, i) => {
      if (Math.abs(angleDiff(angle, a)) < Math.abs(angleDiff(angle, arc[best]))) best = i
    })
    const within = Math.abs(angleDiff(angle, arc[best])) <= step / 2 + 8 && distance < radius + ACTION
    return { index: within ? best : null, outside: !within, local }
  }

  /* ---------- pointer: press, drag, release ---------- */
  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = { id: event.pointerId, wasOpen: open, at: event.timeStamp, moved: false }
    setDone(null)
    if (!open) setOpen(true)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = gesture.current
    if (!state || state.id !== event.pointerId) return
    const { index, outside, local } = aim(event.clientX, event.clientY)
    if (local && Math.hypot(local.x, local.y) > 8) state.moved = true
    if (!state.moved) return
    setDragging(true)
    setTarget(index)
    setOffArc(outside)
    if (event.pointerType === "mouse" || event.pointerType === "pen") pointer.set(local)
    if (local && !reduced) {
      const pull = Math.min(1, TRIGGER_FOLLOW_MAX / Math.max(1, Math.hypot(local.x, local.y) * TRIGGER_FOLLOW))
      followX.set(local.x * TRIGGER_FOLLOW * pull)
      followY.set(local.y * TRIGGER_FOLLOW * pull)
    }
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = gesture.current
    if (!state || state.id !== event.pointerId) return
    gesture.current = null
    pointer.set(null)
    followX.set(0)
    followY.set(0)
    setDragging(false)
    if (state.moved) {
      // Releasing on an action fires it; releasing off the arc, or a cancelled pointer, folds it away. The target is read
      // from the release itself: the last move's render may not have committed yet.
      const { index } = aim(event.clientX, event.clientY)
      if (index !== null && event.type !== "pointercancel") fire(index)
      else setOpen(false)
      return
    }
    const held = event.timeStamp - state.at >= HOLD
    if (held || state.wasOpen) setOpen(false)
  }

  // Mouse hovering an arc left open by a tap still targets and pulls.
  const onRootPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!open || gesture.current || event.pointerType !== "mouse") return
    const { index, local } = aim(event.clientX, event.clientY)
    setDragging(index !== null)
    setTarget(index)
    pointer.set(local)
  }

  /* ---------- keyboard ---------- */
  const openAndFocus = (index: number) => {
    setOpen(true)
    setDragging(false)
    setFocusIndex(index)
    setTarget(index)
    pendingFocus.current = index
  }

  const onTriggerClick = (event: MouseEvent<HTMLButtonElement>) => {
    // Pointer presses are handled by the gesture; this is Enter, Space, or an assistive technology click.
    if (event.detail !== 0 || disabled) return
    if (open) setOpen(false)
    else openAndFocus(0)
  }

  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (event.key === "ArrowUp") {
      event.preventDefault()
      openAndFocus(actions.length - 1)
    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault()
      openAndFocus(0)
    } else if (event.key === "Escape" && open) {
      event.preventDefault()
      setOpen(false)
    }
  }

  const onItemKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = actions.length - 1
    let next = -1
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = last
    else if (event.key === "Escape") {
      event.preventDefault()
      setOpen(false)
      pendingFocus.current = "trigger"
      return
    } else if (event.key === "Tab") {
      setOpen(false)
      return
    }
    if (next < 0) return
    event.preventDefault()
    setFocusIndex(next)
    setTarget(next)
    setDragging(false)
    items.current.get(next)?.focus()
  }

  /* ---------- render ---------- */
  const glyph: Glyph = done ? "done" : open ? "close" : "more"
  const targetedAction = target !== null ? actions[target] : null
  const pillText = done
    ? done.text
    : open
      ? targetedAction
        ? targetedAction.label
        : offArc
          ? "Release to cancel"
          : label
      : null
  const pillTone = done ? done.tone : targetedAction ? (targetedAction.tone ?? "neutral") : "muted"

  const lensRad = target !== null ? toRad(arc[target]) : 0
  const lens = { x: Math.cos(lensRad) * radius, y: Math.sin(lensRad) * radius }
  const emphasisOf = (index: number) =>
    target === null
      ? 1
      : index === target
        ? dragging
          ? DRAG_SCALE
          : FOCUS_SCALE
        : dragging && Math.abs(index - target) === 1
          ? NEIGHBOUR_SCALE
          : 1
  // The pill sits between the trigger and the arc, 8px off the trigger's edge, its near edge toward the trigger.
  const pillRad = toRad(direction)
  const pillOffset = TRIGGER / 2 + PILL_GAP
  const pillCos = Math.cos(pillRad)
  const pillSin = Math.sin(pillRad)
  const triggerScale = !open ? 1 : dragging && target !== null ? TRIGGER_DRAG_SCALE : 0.94

  return (
    <div
      ref={root}
      className={cn("relative inline-grid size-14 place-items-center", className)}
      onPointerMove={onRootPointerMove}
      onPointerLeave={() => {
        if (!gesture.current) pointer.set(null)
      }}
    >
      <div id={menuId} role="menu" aria-label={label} inert={!open} className={cn("pointer-events-none absolute inset-0", open && "[&>*]:pointer-events-auto")}>
        <AnimatePresence>
          {open && target !== null ? (
            <motion.span
              key="lens"
              aria-hidden="true"
              className={cn(
                "pointer-events-none! absolute top-1/2 left-1/2 -mt-[23px] -ml-[23px] size-[46px] rounded-pill",
                actions[target]?.tone === "danger" ? "bg-danger" : "bg-foreground",
              )}
              initial={reduced ? { opacity: 0, x: lens.x, y: lens.y, scale: emphasisOf(target) } : { opacity: 0, scale: 0.6, x: lens.x, y: lens.y }}
              animate={{ opacity: 1, scale: emphasisOf(target), x: lens.x, y: lens.y }}
              exit={{ opacity: 0, scale: reduced ? 1 : 0.7, transition: { duration: motionTokens.duration.fast, ease: standard } }}
              transition={
                reduced
                  ? { duration: 0, opacity: { duration: motionTokens.duration.instant } }
                  : { ...motionTokens.spring.morph, scale: motionTokens.spring.snappy }
              }
            />
          ) : null}
        </AnimatePresence>
        {actions.map((action, index) => (
          <OrbitItem
            key={action.id}
            action={action}
            angle={arc[index]}
            radius={radius}
            index={index}
            count={actions.length}
            open={open}
            focused={index === focusIndex}
            targeted={index === target}
            emphasis={emphasisOf(index)}
            leans={index !== target}
            pointer={pointer}
            reduced={reduced}
            register={(node) => {
              if (node) items.current.set(index, node)
              else items.current.delete(index)
            }}
            onFire={() => fire(index)}
            onKeyDown={(event) => onItemKey(event, index)}
            onFocus={() => {
              setFocusIndex(index)
              setTarget(index)
              setDragging(false)
            }}
          />
        ))}
      </div>

      <motion.button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        data-open={open || undefined}
        className={cn(
          "relative z-1 grid size-14 cursor-pointer place-items-center rounded-pill border border-transparent bg-foreground text-background outline-none",
          "[touch-action:none] select-none [-webkit-tap-highlight-color:transparent] disabled:cursor-not-allowed disabled:opacity-52",
          "transition-[background,color,border-color,box-shadow] duration-240 ease-standard motion-reduce:transition-none",
          "data-open:border-[color-mix(in_oklab,var(--border-strong)_55%,transparent)] data-open:bg-[color-mix(in_oklab,var(--surface-raised)_76%,transparent)]",
          "data-open:text-foreground data-open:shadow-raised data-open:backdrop-blur-xl",
          "[@media(prefers-reduced-transparency:reduce)]:data-open:bg-surface-raised [@media(prefers-reduced-transparency:reduce)]:data-open:backdrop-blur-none",
        )}
        style={{ x: triggerX, y: triggerY }}
        initial={false}
        animate={{ scale: triggerScale }}
        transition={reduced ? { duration: 0 } : dragging ? motionTokens.spring.snappy : motionTokens.spring.smooth}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onTriggerClick}
        onKeyDown={onTriggerKey}
        onContextMenu={(event) => event.preventDefault()}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={glyph}
            aria-hidden="true"
            className="grid place-items-center [&_svg]:size-6"
            initial={reduced ? { opacity: 0 } : { opacity: 0, rotate: -60, scale: 0.5, filter: `blur(${motionTokens.blur.subtle}px)` }}
            animate={{ opacity: 1, rotate: 0, scale: 1, filter: "blur(0px)" }}
            exit={
              reduced
                ? { opacity: 0, transition: { duration: motionTokens.duration.instant } }
                : { opacity: 0, rotate: 60, scale: 0.5, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast, ease: standard } }
            }
            transition={reduced ? { duration: motionTokens.duration.instant } : motionTokens.spring.snappy}
          >
            {glyph === "done" ? <Check /> : glyph === "close" ? <X /> : <Ellipsis />}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 z-2"
        style={{ transform: `translate(${pillCos * pillOffset}px, ${pillSin * pillOffset}px)` }}
      >
        <AnimatePresence>
          {pillText ? (
            <motion.div
              key="pill"
              style={{ translate: `${-50 + pillCos * 50}% ${-50 + pillSin * 50}%` }}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85, filter: `blur(${motionTokens.blur.subtle}px)` }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: reduced ? 1 : 0.9, transition: { duration: motionTokens.duration.fast, ease: standard } }}
              transition={reduced ? { duration: motionTokens.duration.instant } : motionTokens.spring.snappy}
            >
              <OrbitPill text={pillText} tone={pillTone} reduced={reduced} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {announce ? (
        <span role="status" aria-live="polite" className="sr-only">
          {status}
        </span>
      ) : null}
    </div>
  )
}

export default OrbitMenu
