"use client"

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react"
import { AnimatePresence, animate, motion, useMotionValue, useSpring, useTransform } from "motion/react"
import type { MotionValue, TargetAndTransition, Transition } from "motion/react"

import { CaretLeftIcon } from "@phosphor-icons/react"

import { clamp, rubberBand } from "@/lib/gesture"
import { useMotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export type PassFinish = "brushed" | "onyx" | "frost" | "tint"

export interface PassActivity {
  id: string
  name: string
  detail: string
  /** Negative when credit is used, positive when it is added. */
  delta: number
  icon?: ReactNode
  /** Replaces the icon for entries tied to a person. */
  avatar?: string
}

export interface Pass {
  id: string
  brand: string
  title: string
  /** The trailing digits of the pass number. */
  tail: string
  owner: string
  /** The surface treatment. Brushed by default. */
  finish?: PassFinish
  /** Any CSS color for the tint finish. */
  tint?: string
  /** Shown under Renews. */
  renews?: string
  /** Replaces the built-in fictional mark; null hides it. */
  emblem?: ReactNode
  /** Optional artwork under the finish. */
  image?: string
  amount: number
  amountLabel: string
  activity: PassActivity[]
}

export interface PassDeckProps {
  /** Passes in stack order, the first in front. */
  passes: Pass[]
  /** Heading above the deck, also its accessible name. */
  label?: string
  /** ISO currency code for amounts. */
  currency?: string
  /** Locale for number formatting. */
  locale?: string
  /** Called with the opened pass, or null when it goes back into the deck. */
  onOpenChange?: (pass: Pass | null) => void
  className?: string
}

/** Pass proportions, close to a bank-card ratio: 85.6 by 53.98 mm. */
const RATIO = 53.98 / 85.6
/** Geometry is tuned at a 296px pass and scales with the measured width. */
const REFERENCE = 296
/** Room above the front card, so the fanned and lifted cards stay inside the stage. */
const TOP = 12
/** Where the front card rests below that room, and how far each card behind peeks above the one in front. */
const REST = 100
const STEP = 11.2
/** Fanning sinks the front card and spreads the pitch to about 41px, so the cards behind rise. */
const FAN_SINK = 44.8
const FAN_STEP = 29.9
const SHRINK = 0.05
const BEHIND = 3
/** Closed stage height. */
const STAGE = 407
/** The open card lifts to the top at this scale; its activity starts this far under it. */
const OPEN_SCALE = 0.88
const ACTIVITY_GAP = 4
/** Tucked cards show this much above the stage edge, each one 6px higher than the one in front. */
const POCKET = 18
const POCKET_STEP = 6
/** Space between the activity and the pocket when the activity is taller than the stage allows. */
const POCKET_GAP = 29
/** A release coasts this many seconds of its velocity before the nearest card is chosen. */
const PROJECTION = 0.25
const FLICK = 500
const TILT = 5
/** One critically damped curve for fan, cycle, and open, so every card moves in step and none overshoots. */

const mix = (from: number, to: number, amount: number) => from + (to - from) * amount
/** Past the first and last card the stack resists like a rubber band. */
const EDGE_LIMIT = 0.35
/** How much of the pull the stack follows at first, before it stiffens toward EDGE_LIMIT. */
const EDGE_FOLLOW = 0.56
const edgeStretch = (distance: number) => rubberBand(distance, EDGE_LIMIT, EDGE_FOLLOW)
const rubber = (value: number, max: number) => (value < 0 ? -edgeStretch(-value) : value > max ? max + edgeStretch(value - max) : value)

interface Geometry {
  width: MotionValue<number>
  activity: MotionValue<number>
}

/** Closed and open stage heights, where the front card rests, and where the activity starts, all from the measured width. */
function measure(width: number, activity: number) {
  const k = width / REFERENCE
  const height = width * RATIO
  const closed = STAGE * k
  const activityTop = (TOP + ACTIVITY_GAP) * k + height * OPEN_SCALE
  const open = Math.max(closed, activityTop + activity + (POCKET_GAP + POCKET) * k)
  return { k, height, closed, open, front: (TOP + REST) * k, activityTop }
}

/**
 * Every card's transform is one pure function of the continuous stack position, the open amount, and the fan amount,
 * so springs, drags, and interruptions all move the same shape. Z order never changes.
 */
function place(index: number, position: number, opened: number, fan: number, hover: number, selected: number | null, count: number, width: number, activity: number) {
  const { k, closed, open, front } = measure(width, activity)
  const rel = index - position
  let y: number
  let scale: number
  let opacity: number
  if (rel >= 0) {
    // The stack is anchored by the front card: fanning sinks it while the cards behind spread upward.
    y = front + (fan * FAN_SINK - rel * (STEP + fan * FAN_STEP) - hover * 10) * k
    scale = 1 - SHRINK * Math.min(rel, BEHIND + 1)
    opacity = clamp(BEHIND + 1 - rel, 0, 1)
  } else {
    // In front of the stack position: pushed down into the pocket, below the clipped edge.
    y = front + -rel * (closed - front + 14 * k)
    scale = 1
    opacity = 1
  }
  if (opened <= 0 || selected === null) return { y, scale, opacity }
  let openY: number
  let openScale = OPEN_SCALE
  let openOpacity = 1
  if (index === selected) openY = TOP * k
  else {
    const rank = index < selected ? index : index - 1
    openY = open - (POCKET + rank * POCKET_STEP) * k
    openScale = 0.94 - rank * 0.02
    openOpacity = rank < BEHIND ? 1 : 0
    if (count > 1 && rank >= BEHIND) openY = open + 10 * k
  }
  return { y: mix(y, openY, opened), scale: mix(scale, openScale, opened), opacity: mix(opacity, openOpacity, opened) }
}

/** The fictional emblem: two nested diamonds. */
function Emblem() {
  return (
    <svg viewBox="0 0 40 24" className="h-[9cqw] w-auto" aria-hidden="true">
      <path d="M20 1.5 31.5 12 20 22.5 8.5 12Z" fill="none" stroke="currentColor" strokeOpacity=".85" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M20 7 25.5 12 20 17 14.5 12Z" fill="currentColor" fillOpacity=".55" />
    </svg>
  )
}

function Contactless() {
  return (
    <svg viewBox="0 0 24 24" className="size-[6.5cqw] opacity-80" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M8.5 8.5a5 5 0 0 1 0 7" />
      <path d="M12 6a8.5 8.5 0 0 1 0 12" />
      <path d="M15.5 3.5a12 12 0 0 1 0 17" />
    </svg>
  )
}

/** Physical pass materials: fixed illustration colors, the same in light and dark. */
const MATERIAL = {
  brushedInk: "oklch(30% 0.01 260)", // token-audit-ignore: fixed pass material
  brushedA: "oklch(90% 0.005 260)", // token-audit-ignore: fixed pass material
  brushedB: "oklch(74% 0.01 260)", // token-audit-ignore: fixed pass material
  brushedC: "oklch(93% 0.004 260)", // token-audit-ignore: fixed pass material
  brushedD: "oklch(70% 0.012 260)", // token-audit-ignore: fixed pass material
  onyxInk: "oklch(92% 0 0)", // token-audit-ignore: fixed pass material
  onyxBase: "oklch(17% 0.005 260)", // token-audit-ignore: fixed pass material
  onyxA: "oklch(24% 0.005 260)", // token-audit-ignore: fixed pass material
  onyxB: "oklch(12% 0.005 260)", // token-audit-ignore: fixed pass material
  tintBase: "oklch(45% 0.15 262)", // token-audit-ignore: default pass tint
}

const finishes: Record<PassFinish, { className?: string; style: (tint?: string) => CSSProperties }> = {
  // Brushed metal: a soft sheen over fine horizontal grain.
  brushed: {
    style: () => ({
      color: MATERIAL.brushedInk,
      backgroundImage:
        `repeating-linear-gradient(0deg, color-mix(in oklab,var(--sheen) 7%, transparent) 0 1px, transparent 1px 3px), linear-gradient(125deg, ${MATERIAL.brushedA}, ${MATERIAL.brushedB} 38%, ${MATERIAL.brushedC} 58%, ${MATERIAL.brushedD})`,
    }),
  },
  // A dark pass with a fine guilloche of overlapping rings.
  onyx: {
    style: () => ({
      color: MATERIAL.onyxInk,
      backgroundColor: MATERIAL.onyxBase,
      backgroundImage:
        `repeating-radial-gradient(circle at 12% 130%, color-mix(in oklab,var(--sheen) 7%, transparent) 0 1px, transparent 1px 7px), repeating-radial-gradient(circle at 96% -30%, color-mix(in oklab,var(--sheen) 5%, transparent) 0 1px, transparent 1px 9px), linear-gradient(135deg, ${MATERIAL.onyxA}, ${MATERIAL.onyxB})`,
    }),
  },
  // Frosted glass: whatever sits behind shows through a blur.
  frost: {
    className: "text-foreground backdrop-blur-[14px] backdrop-saturate-150",
    style: () => ({
      backgroundColor: "color-mix(in oklab, var(--surface-raised) 52%, transparent)",
      backgroundImage: "linear-gradient(135deg, color-mix(in oklab,var(--sheen) 38%, transparent), color-mix(in oklab,var(--sheen) 4%, transparent) 55%, color-mix(in oklab,var(--sheen) 18%, transparent))",
    }),
  },
  tint: {
    className: "text-on-media",
    style: tint => ({
      backgroundColor: tint ?? MATERIAL.tintBase,
      backgroundImage: "radial-gradient(120% 140% at 0% 0%, color-mix(in oklab,var(--sheen) 22%, transparent), transparent 55%), linear-gradient(160deg, transparent 40%, color-mix(in oklab,var(--shade) 28%, transparent))",
    }),
  },
}

/** The pass itself. Every detail is sized in container units, so it scales as one object; the corner radius is inherited from the pass button. */
function PassFace({ pass }: { pass: Pass }) {
  const material = pass.finish ?? "brushed"
  const finish = finishes[material]
  return (
    <span className="@container absolute inset-0 block overflow-hidden rounded-[inherit] text-left" aria-hidden="true">
      {pass.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- pass art can come from any host.
        <img src={pass.image} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
      ) : null}
      <span
        className={cn("absolute inset-0 flex flex-col justify-between rounded-[inherit] p-[6cqw] ring-1 ring-sheen/18 ring-inset", finish.className)}
        // Artwork shows through a tint finish; brushed and onyx stay opaque, and frost already lets it through.
        style={{
          ...finish.style(pass.tint),
          ...(pass.image && material === "tint" ? { backgroundColor: `color-mix(in oklab, ${pass.tint ?? MATERIAL.tintBase} 62%, transparent)` } : null),
        }}
      >
        <span className="flex items-start justify-between gap-[3cqw]">
          <span className="grid min-w-0 leading-tight">
            <span className="truncate text-[6.1cqw] font-medium tracking-[-0.01em]">{pass.brand}</span>
            <span className="truncate text-[3.7cqw] opacity-72">{pass.title}</span>
          </span>
          <Contactless />
        </span>
        {/* A short barcode: bars of uneven width. */}
        <span className="flex h-[9.5cqw] items-stretch gap-[0.7cqw] opacity-80">
          {[1, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 1, 3, 1, 2].map((weight, bar) => (
            <span key={bar} className="bg-current" style={{ width: `${weight * 0.55}cqw` }} />
          ))}
        </span>
        <span className="flex items-baseline gap-[2.5cqw] whitespace-nowrap tabular-nums [text-shadow:0_1px_0_color-mix(in_oklab,var(--sheen)_30%,transparent),0_-1px_0_color-mix(in_oklab,var(--shade)_35%,transparent)]">
          <span className="text-[3.7cqw] tracking-[0.14em] uppercase opacity-72">No.</span>
          <span className="text-[6.35cqw] tracking-[0.04em]">{pass.tail}</span>
        </span>
        <span className="flex items-end justify-between gap-[3cqw]">
          <span className="flex min-w-0 items-end gap-[5cqw] leading-tight">
            <span className="truncate text-[4cqw]">{pass.owner}</span>
            {pass.renews ? (
              <span className="grid flex-none">
                <span className="text-[2.5cqw] opacity-72">Renews</span>
                <span className="text-[4cqw] tabular-nums">{pass.renews}</span>
              </span>
            ) : null}
          </span>
          {pass.emblem === undefined ? <Emblem /> : pass.emblem}
        </span>
      </span>
    </span>
  )
}

interface StackPassProps {
  pass: Pass
  index: number
  count: number
  active: boolean
  /** The card that is open, for its expanded state. */
  open: number | null
  /** The card that lifts out when the stack opens. It stays set while the card goes back, so closing retraces the same path. */
  lifted: number | null
  reduced: boolean
  position: MotionValue<number>
  opened: MotionValue<number>
  fan: MotionValue<number>
  light: { x: MotionValue<number>; y: MotionValue<number>; on: MotionValue<number> }
  geometry: Geometry
  label: string
  buttonRef: (node: HTMLButtonElement | null) => void
  onActivate: (index: number) => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void
  dragged: () => boolean
}

function StackPass({ pass, index, count, active, open, lifted, reduced, position, opened, fan, light, geometry, label, buttonRef, onActivate, onKeyDown, dragged }: StackPassProps) {
  const motionTokens = useMotionTokens()
  const hoverTarget = useMotionValue(0)
  const hover = useSpring(hoverTarget, motionTokens.spring.smooth)
  const tiltX = useSpring(0, motionTokens.spring.snappy)
  const tiltY = useSpring(0, motionTokens.spring.snappy)
  const layout = useTransform(() =>
    place(index, position.get(), opened.get(), fan.get(), hover.get(), lifted, count, geometry.width.get(), geometry.activity.get()),
  )
  const y = useTransform(() => layout.get().y)
  const scale = useTransform(() => layout.get().scale)
  const opacity = useTransform(() => layout.get().opacity)
  const height = useTransform(() => geometry.width.get() * RATIO)
  const radius = useTransform(() => geometry.width.get() * 0.037)
  // Shadows fade their opacity instead of animating box-shadow; the hovered card's shadow deepens.
  const shadow = useTransform(() => 0.45 + 0.55 * Math.max(hover.get(), lifted === index ? opened.get() : 0))
  const isOpen = open === index
  const front = active && !reduced
  const lightX = useTransform(() => (light.x.get() - 0.5) * geometry.width.get() * 0.8)
  const lightY = useTransform(() => (light.y.get() - 0.5) * geometry.width.get() * RATIO * 0.8)
  // The sheen rests faintly on every card and brightens on the front card under the pointer.
  const lightOpacity = useTransform(() => 0.25 + (front ? 0.75 * light.on.get() : 0))

  // The front card tilts toward the mouse and the specular light follows it.
  function move(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "mouse" || reduced) return
    if (!active) return
    const rect = event.currentTarget.getBoundingClientRect()
    const px = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    const py = clamp((event.clientY - rect.top) / rect.height, 0, 1)
    tiltX.set((0.5 - py) * TILT * 2)
    tiltY.set((px - 0.5) * TILT * 2)
    light.x.set(px)
    light.y.set(py)
    light.on.set(1)
  }
  function enter(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && !reduced && open === null) hoverTarget.set(1)
  }
  function leave() {
    hoverTarget.set(0)
    tiltX.set(0)
    tiltY.set(0)
    if (active) light.on.set(0)
  }

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      tabIndex={active ? 0 : -1}
      aria-label={label}
      aria-expanded={isOpen}
      className="absolute inset-x-0 top-0 block origin-top cursor-pointer outline-none [-webkit-tap-highlight-color:transparent]"
      style={{ y, scale, opacity, height, borderRadius: radius, zIndex: count - index, rotateX: tiltX, rotateY: tiltY, transformPerspective: 900 }}
      onClick={() => {
        if (!dragged()) onActivate(index)
      }}
      onKeyDown={event => onKeyDown(event, index)}
      onPointerEnter={enter}
      onPointerMove={move}
      onPointerLeave={leave}
    >
      {/* A tight contact shadow on a slightly smaller span, so it reads under the card rather than around it. */}
      <motion.span
        className="pointer-events-none absolute inset-x-[5%] top-[6%] bottom-[2%] rounded-[12%] shadow-[0_1px_1px_color-mix(in_oklab,var(--shade)_45%,transparent),0_3px_8px_color-mix(in_oklab,var(--shade)_45%,transparent)]"
        style={{ opacity: shadow }}
        aria-hidden="true"
      />
      <PassFace pass={pass} />
      {/* A pre-painted highlight that only moves and fades. */}
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden="true">
        <motion.span
          className="absolute top-[-40%] left-[-40%] size-[180%] bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--sheen)_32%,transparent),transparent_38%)] mix-blend-soft-light"
          style={{ x: lightX, y: lightY, opacity: lightOpacity }}
        />
      </span>
    </motion.button>
  )
}

/**
 * A deck of passes (memberships, transit, loyalty) with tactile surfaces. Hover to fan the deck, drag or use the arrow keys to
 * shuffle through, and pick one to lift it out beside its credit and recent activity.
 */
export function PassDeck({ passes, label = "Passes", currency = "USD", locale = "en-US", onOpenChange, className }: PassDeckProps) {
  const reduced = useReducedMotion() ?? false
  const motionTokens = useMotionTokens()
  const glide = useMemo(() => ({ ...motionTokens.spring.smooth, visualDuration: 0.45 }), [motionTokens.spring.smooth])
  const count = passes.length
  const headingId = useId()
  const hintId = useId()
  const [active, setActive] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [lifted, setLifted] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const position = useMotionValue(0)
  const opened = useMotionValue(0)
  const fanTarget = useMotionValue(0)
  const fan = useSpring(fanTarget, glide)
  const width = useMotionValue(296)
  const activity = useMotionValue(220)
  const geometry = useMemo(() => ({ width, activity }), [width, activity])
  const light = { x: useMotionValue(0.5), y: useMotionValue(0.3), on: useMotionValue(0) }
  const stageRef = useRef<HTMLDivElement>(null)
  const activityRef = useRef<HTMLDivElement>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const drag = useRef<{ startY: number; origin: number; from: number; moved: boolean; samples: { t: number; y: number }[]; open: boolean } | null>(null)
  const justDragged = useRef(false)
  const stageHeight = useTransform(() => {
    const { closed, open } = measure(width.get(), activity.get())
    return mix(closed, open, opened.get())
  })

  const money = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency }), [currency, locale])
  // A spaced plus or a true minus sign in front of the absolute amount.
  const signed = useMemo(() => ({ format: (value: number) => `${value > 0 ? "+" : value < 0 ? "\u2212" : ""}${value === 0 ? "" : " "}${money.format(Math.abs(value))}` }), [money])

  // Measured once before paint and again on resize; the stage height follows the card height.
  useLayoutEffect(() => {
    const stage = stageRef.current
    const panel = activityRef.current
    if (!stage || !panel) return
    width.set(stage.offsetWidth)
    activity.set(panel.offsetHeight)
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      width.set(stage.offsetWidth)
      activity.set(panel.offsetHeight)
    })
    observer.observe(stage)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [activity, width])

  // On phones that report device tilt, the light follows the device instead of a pointer.
  useEffect(() => {
    if (reduced || typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return
    const orient = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return
      light.x.set(clamp(0.5 + event.gamma / 60, 0, 1))
      light.y.set(clamp(0.5 + (event.beta - 45) / 60, 0, 1))
      light.on.set(1)
    }
    window.addEventListener("deviceorientation", orient)
    return () => window.removeEventListener("deviceorientation", orient)
  }, [light.on, light.x, light.y, reduced])

  const settle = useCallback(
    (value: MotionValue<number>, target: number, velocity?: number) => {
      if (reduced) value.jump(target)
      else animate(value, target, { ...glide, ...(velocity === undefined ? null : { velocity }) })
    },
    [glide, reduced],
  )

  const describe = (index: number) => `${passes[index].title}, pass ${index + 1} of ${count}`

  const bringToFront = useCallback(
    (index: number, velocity?: number) => {
      const next = clamp(index, 0, count - 1)
      setActive(next)
      settle(position, next, velocity)
      return next
    },
    [count, position, settle],
  )

  const open = useCallback(
    (index: number) => {
      const next = bringToFront(index)
      setSelected(next)
      setAnnouncement(`${passes[next].title} open. ${passes[next].amountLabel} ${money.format(passes[next].amount)}`)
      onOpenChange?.(passes[next])
      // Switching the open card puts the current one back quickly, then lifts the new one on the same spring.
      if (!reduced && lifted !== null && lifted !== next && opened.get() > 0.05) {
        animate(opened, 0, { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }).then(() => {
          setLifted(next)
          settle(opened, 1)
        })
        return
      }
      setLifted(next)
      settle(opened, 1)
    },
    [bringToFront, passes, lifted, money, motionTokens.duration.fast, motionTokens.ease.standard, onOpenChange, opened, reduced, settle],
  )

  const close = useCallback(
    (velocity?: number) => {
      settle(opened, 0, velocity)
      setSelected(null)
      setAnnouncement("Pass back in the deck")
      onOpenChange?.(null)
    },
    [onOpenChange, opened, settle],
  )

  function cardKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | null = null
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = index + 1
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = index - 1
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = count - 1
    else if (event.key === "Escape" && selected !== null) {
      event.preventDefault()
      close()
      buttons.current[index]?.focus()
      return
    }
    if (next === null) return
    event.preventDefault()
    next = clamp(next, 0, count - 1)
    if (next === index) return
    // While a card is open the arrows switch the open card; otherwise they cycle the front card.
    if (selected !== null) open(next)
    else {
      bringToFront(next)
      setAnnouncement(describe(next))
    }
    buttons.current[next]?.focus()
  }

  // Dragging down pushes the front card into the pocket and brings the next one forward one to one under the pointer.
  function down(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary || reduced || count === 0) return
    const isOpen = selected !== null
    drag.current = {
      startY: event.clientY,
      // Read when the drag starts moving: a press that never moves leaves the running springs alone.
      origin: 0,
      from: active,
      moved: false,
      samples: [{ t: event.timeStamp, y: event.clientY }],
      open: isOpen,
    }
  }
  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current
    if (!state) return
    // The press ended outside the stage, where its pointerup never reached us; a later hover is not a drag.
    if (!(event.buttons & 1)) {
      drag.current = null
      return
    }
    const dy = event.clientY - state.startY
    if (!state.moved) {
      if (Math.abs(dy) < 5) return
      state.moved = true
      position.stop()
      opened.stop()
      state.origin = state.open ? opened.get() : position.get()
      event.currentTarget.setPointerCapture(event.pointerId)
      fanTarget.set(0)
    }
    state.samples.push({ t: event.timeStamp, y: event.clientY })
    if (state.samples.length > 10) state.samples.shift()
    const { height, closed, front } = measure(width.get(), activity.get())
    if (state.open) {
      // Pull the open card down to put it back; upward it barely gives.
      const raw = state.origin - dy / (height * 0.9)
      opened.set(raw > 1 ? 1 + (raw - 1) * 0.05 : clamp(raw, 0, 1))
      return
    }
    position.set(rubber(state.origin + dy / (closed - front + 14), count - 1))
  }
  function up(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (!state?.moved) return
    justDragged.current = true
    window.setTimeout(() => {
      justDragged.current = false
    }, 0)
    const recent = state.samples.filter(sample => event.timeStamp - sample.t <= 90)
    const first = recent[0]
    const last = recent[recent.length - 1]
    const velocity = first && last && last !== first ? (last.y - first.y) / ((last.t - first.t) / 1000) : 0
    const { height, closed, front } = measure(width.get(), activity.get())
    if (state.open) {
      if (opened.get() < 0.65 || velocity > FLICK) close(-velocity / (height * 0.9))
      else settle(opened, 1)
      return
    }
    const travel = closed - front + 14
    const unitVelocity = velocity / travel
    // A flick lands where its momentum projects, one card at a time.
    const projected = Math.round(position.get() + unitVelocity * PROJECTION)
    const target = clamp(projected, state.from - 1, state.from + 1)
    const next = bringToFront(target, unitVelocity)
    if (next !== state.from) setAnnouncement(describe(next))
  }

  const pass = lifted === null ? null : passes[lifted]
  const activityTop = useTransform(() => measure(width.get(), activity.get()).activityTop)
  // The activity trails the lift: it only reads once the card is mostly up, and leaves first on the way back.
  const activityOpacity = useTransform(() => Math.pow(clamp(opened.get(), 0, 1), 2.5))
  const counter = useMotionValue(0)
  const amountText = useTransform(counter, value => money.format(value))
  const selectedId = selected === null ? undefined : passes[selected]?.id
  // The credit counts up each time a pass opens.
  useEffect(() => {
    const target = selected === null ? undefined : passes[selected]
    if (!target) return
    if (reduced) {
      counter.jump(target.amount)
      return
    }
    counter.jump(0)
    const controls = animate(counter, target.amount, { duration: motionTokens.duration.considered * 1.4, ease: [...motionTokens.ease.enter] })
    return () => controls.stop()
    // Only a newly opened card restarts the count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, reduced])

  const swap: { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition; transition: Transition } = {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 4, filter: `blur(${motionTokens.blur.subtle}px)` },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, transition: { duration: motionTokens.duration.instant } },
    transition: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] },
  }

  return (
    <div className={cn("grid w-[min(100%,18.5rem)] gap-2", className)}>
      <div className="flex h-8 items-center justify-between gap-3">
        <h3 id={headingId} className="m-0 min-w-0 truncate text-base leading-body font-medium">
          {label}
        </h3>
        <AnimatePresence mode="popLayout" initial={false}>
          {selected === null ? (
            <motion.span
              key="count"
              className="inline-flex h-5 min-w-[38px] flex-none items-center justify-center overflow-hidden rounded-pill bg-surface-muted px-2 text-xs leading-none text-text-secondary tabular-nums"
              aria-label={count === 1 ? "1 pass" : `${count} passes`}
              {...swap}
            >
              {/* The digit rolls when the count changes. */}
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={count}
                  aria-hidden="true"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.8em" }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: "-0.8em" }}
                  transition={motionTokens.spring.snappy}
                >
                  {count}
                </motion.span>
              </AnimatePresence>
            </motion.span>
          ) : (
            <motion.button
              key="all"
              type="button"
              className="inline-flex h-8 flex-none cursor-pointer items-center gap-1.5 rounded-pill border border-border bg-surface pr-3 pl-2.5 text-sm font-medium whitespace-nowrap text-foreground transition-colors duration-160 ease-standard pointer-fine:hover:bg-surface-muted motion-reduce:transition-none"
              onClick={() => {
                const index = selected
                close()
                buttons.current[index]?.focus()
              }}
              {...swap}
            >
              <CaretLeftIcon size={16} aria-hidden="true" className="flex-none" />
              All passes
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <span id={hintId} className="sr-only">
        Use the arrow keys to move through the passes. Press Enter to open a pass and Escape to put it back.
      </span>
      <motion.div
        ref={stageRef}
        role="group"
        aria-labelledby={headingId}
        aria-describedby={hintId}
        className={cn("relative overflow-x-visible overflow-y-clip select-none", selected === null ? "touch-pan-x" : "touch-none")}
        style={{ height: stageHeight }}
        onPointerEnter={event => {
          if (event.pointerType === "mouse" && !reduced && selected === null) fanTarget.set(1)
        }}
        onPointerLeave={() => fanTarget.set(0)}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {passes.map((item, index) => (
          <StackPass
            key={item.id}
            pass={item}
            index={index}
            count={count}
            active={index === active}
            open={selected}
            lifted={lifted}
            reduced={reduced}
            position={position}
            opened={opened}
            fan={fan}
            light={light}
            geometry={geometry}
            label={`${item.brand} ${item.title}, number ending ${item.tail}, ${index + 1} of ${count}, ${item.amountLabel.toLowerCase()} ${money.format(item.amount)}`}
            buttonRef={node => {
              buttons.current[index] = node
            }}
            onActivate={index => (selected === index ? close() : open(index))}
            onKeyDown={cardKey}
            dragged={() => justDragged.current}
          />
        ))}
        {/* The activity sits under the open card and stays inert until a card is open. */}
        <motion.div
          ref={activityRef}
          inert={selected === null}
          className="absolute inset-x-0 z-0 grid"
          style={{ top: activityTop, opacity: activityOpacity }}
        >
          <div className="flex items-baseline justify-between gap-3 px-0.5 pb-2">
            <span className="min-w-0 truncate text-sm text-text-secondary">{pass?.amountLabel ?? "Credit"}</span>
            <motion.span className="text-[22px] leading-body tabular-nums">{amountText}</motion.span>
          </div>
          <ul className="m-0 grid list-none p-0" aria-label="Recent activity">
            {(pass?.activity ?? []).slice(0, 3).map((entry, index) => (
              <motion.li
                key={`${pass?.id}-${entry.id}`}
                className="flex items-center gap-2.5 px-0.5 py-1"
                // Rows fade in place, about 50ms apart, once the lift is under way.
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35, ease: [...motionTokens.ease.standard], delay: reduced ? 0 : 0.1 + index * 0.05 }}
              >
                <span className="grid size-8 flex-none place-items-center overflow-hidden rounded-pill bg-surface-muted text-xs text-text-secondary" aria-hidden="true">
                  {entry.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatars can come from any host.
                    <img src={entry.avatar} alt="" className="size-full object-cover" />
                  ) : (
                    (entry.icon ?? entry.name.slice(0, 1))
                  )}
                </span>
                <span className="grid min-w-0 flex-1 leading-[1.3]">
                  <span className="truncate text-sm">{entry.name}</span>
                  <span className="truncate text-xs text-text-muted">{entry.detail}</span>
                </span>
                <span className={cn("text-sm tabular-nums", entry.delta > 0 ? "text-success" : "text-foreground")}>{signed.format(entry.delta)}</span>
              </motion.li>
            ))}
            {pass && pass.activity.length === 0 ? <li className="py-1.5 text-sm text-text-secondary">No activity yet</li> : null}
          </ul>
        </motion.div>
      </motion.div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  )
}

export default PassDeck
