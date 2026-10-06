"use client"

/* eslint-disable @next/next/no-img-element -- people avatars are plain img tags from the caller's URLs, as documented. */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import type { KeyboardEvent, PointerEvent, ReactNode } from "react"
import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react"
import type { AnimationPlaybackControls, MotionValue, Transition } from "motion/react"
import {
  ALargeSmall,
  Bell,
  BellOff,
  ChevronRight,
  Moon,
  Presentation,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

export interface ControlCenterFocusMode {
  id: string
  label: string
  icon: LucideIcon
  description: string
  /** Seeds the session dial when this mode is picked. */
  defaultMinutes: number
}
export interface ControlCenterChannel {
  id: string
  label: string
  description?: string
  defaultOn?: boolean
}
export interface ControlCenterPerson {
  id: string
  name: string
  avatar: string
}
export interface ControlCenterState {
  /** `until` is the session end as an ISO string. */
  focus: { mode: string; minutes: number; until: string } | null
  notifications: boolean
  channels: Record<string, boolean>
  presenting: boolean
  volume: number
  textSize: number
}
export interface ControlCenterProps {
  focusModes: ControlCenterFocusMode[]
  channels: ControlCenterChannel[]
  people?: ControlCenterPerson[]
  defaultVolume?: number
  defaultTextSize?: number
  formatTime?: (date: Date) => string
  onStateChange?: (state: ControlCenterState) => void
  label?: string
  className?: string
}

type DetailId = "focus" | "notifications"
type Session = { mode: string; minutes: number; endsAt: number }
type Toggles = { focus: Session | null; notifications: boolean; channels: Record<string, boolean>; presenting: boolean }
type Rect = { x: number; y: number; w: number; h: number }

const { blur, duration } = motionTokens
type Bezier = [number, number, number, number]
const enter = [...motionTokens.ease.enter] as Bezier
const standard = [...motionTokens.ease.standard] as Bezier
/** Duration springs restated as stiffness and damping, so a retarget mid flight keeps the velocity it already has. */
const physical = ({ visualDuration, bounce }: { visualDuration: number; bounce: number }): Transition => {
  const root = (2 * Math.PI) / (visualDuration * 1.2)
  return { type: "spring", stiffness: root * root, damping: 2 * (1 - bounce) * root, mass: 1 }
}
const GROW = physical(motionTokens.spring.morph)
const FOLD = physical(motionTokens.spring.smooth)
/** Content changes inside an open detail follow a beat late and never overshoot. */
const RESIZE: Transition = { ...FOLD, delay: 0.04 }
const SNAP = physical(motionTokens.spring.snappy)
const TILE_RADIUS = 18
const DETAIL_RADIUS = 20
const INSET = 8
const DIAL_MIN = 5
const DIAL_MAX = 120
/** Minutes per full turn of the dial; a long session goes round twice. */
const LAP = 60
/** iOS style resistance: travel past a limit gives less and less, and never more than `limit`. */
const rubber = (distance: number, limit: number) => Math.sign(distance) * (1 - 1 / ((Math.abs(distance) * 0.55) / limit + 1)) * limit
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

const clockFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })
const defaultFormatTime = (date: Date) => clockFormat.format(date)

const subscribe = () => () => {}
function useReducedFlag() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false)
  return !!useReducedMotion() && hydrated
}

/** The current minute, refreshed while mounted, so "until" times stay honest without reading the clock during render. */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

/** Icons and status text swap with a short blur. */
function Swap({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span
        key={id}
        className={cn("inline-flex", className)}
        initial={{ opacity: 0, scale: 0.86, filter: `blur(${blur.subtle}px)` }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 0.86, filter: `blur(${blur.subtle}px)`, transition: { duration: duration.instant, ease: standard } }}
        transition={{ duration: duration.fast, ease: enter }}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  )
}

const focusMuted = "outline-none focus-visible:bg-foreground/[0.065]"

interface TileProps {
  label: string
  status: string
  icon: LucideIcon
  iconKey: string
  on: boolean
  wide?: boolean
  /** A decorative copy that rides on the morph surface. */
  ghost?: boolean
  detail?: DetailId
  expanded?: boolean
  onToggle?: () => void
  onOpen?: () => void
  chevronRef?: (node: HTMLButtonElement | null) => void
}

/** A toggle with an optional chevron. The ghost copy has the same layout and no controls, so the surface starts as an exact copy. */
function Tile({ label, status, icon: Icon, iconKey, on, wide, ghost, detail, expanded, onToggle, onOpen, chevronRef }: TileProps) {
  const ToggleTag = ghost ? "span" : "button"
  const ChevronTag = ghost ? "span" : "button"
  const iconDisc = (
    <span
      className={cn(
        "grid size-9 flex-none place-items-center rounded-full transition-[background-color,color] duration-200 ease-standard motion-reduce:transition-none [&_svg]:size-[18px]",
        on ? "bg-accent text-accent-foreground" : "bg-foreground/[0.07] text-foreground",
      )}
    >
      <Swap id={iconKey}>
        <Icon aria-hidden="true" />
      </Swap>
    </span>
  )
  const text = (
    <span className="flex min-w-0 flex-col text-left">
      <span className="truncate text-sm leading-body font-medium text-foreground">{label}</span>
      <span className="relative block h-[1.125rem] overflow-hidden text-xs leading-body text-text-secondary">
        <Swap id={status} className="truncate whitespace-nowrap">
          {status}
        </Swap>
      </span>
    </span>
  )
  return (
    <div aria-hidden={ghost || undefined} className={cn("flex size-full", wide ? "items-center" : "flex-col")}>
      <ToggleTag
        {...(ghost ? {} : { type: "button" as const, "aria-pressed": on, onClick: onToggle })}
        className={cn(
          "flex min-w-0 flex-1 cursor-pointer rounded-[inherit] [-webkit-tap-highlight-color:transparent]",
          wide ? "h-full items-center gap-3 pl-3" : "flex-col items-start justify-between gap-2 p-3",
          !ghost && focusMuted,
          !ghost && "transition-[background-color] duration-160 ease-standard pointer-fine:hover:bg-foreground/[0.035]",
        )}
      >
        {iconDisc}
        {text}
      </ToggleTag>
      {detail && (
        <ChevronTag
          {...(ghost
            ? {}
            : {
                type: "button" as const,
                ref: chevronRef,
                "aria-label": `${label} options`,
                "aria-haspopup": "dialog" as const,
                "aria-expanded": expanded,
                onClick: onOpen,
              })}
          className={cn(
            "grid size-8 flex-none cursor-pointer place-items-center rounded-full text-text-secondary [-webkit-tap-highlight-color:transparent]",
            wide ? "mr-3" : "absolute top-3 right-3",
            !ghost && focusMuted,
            !ghost && "transition-[background-color,color] duration-160 ease-standard pointer-fine:hover:bg-foreground/[0.065] pointer-fine:hover:text-foreground",
          )}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </ChevronTag>
      )}
    </div>
  )
}

/**
 * A level on a wide track. It follows the pointer 1:1 from where it was grabbed and stretches with resistance past either end;
 * a tap without a drag jumps there, and the track swells a little while held.
 */
function Meter({
  label,
  min,
  max,
  step,
  defaultValue,
  format,
  icon,
  onChange,
  reduced,
}: {
  label: string
  min: number
  max: number
  step: number
  defaultValue: number
  format: (value: number) => string
  icon: (value: number) => { Icon: LucideIcon; key: string }
  onChange: (value: number) => void
  reduced: boolean
}) {
  const labelId = useId()
  const [value, setValue] = useState(() => clamp(Math.round(defaultValue / step) * step, min, max))
  const span = max - min
  const fill = useMotionValue((value - min) / span)
  const stretch = useMotionValue(1)
  const swell = useMotionValue(1)
  const origin = useMotionValue("0% 50%")
  const clip = useTransform(fill, f => `inset(0 ${((1 - clamp(f, 0, 1)) * 100).toFixed(3)}% 0 0 round 16px)`)
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x: number; from: number; moved: boolean } | null>(null)
  const latest = useRef(value)
  const fillAnim = useRef<AnimationPlaybackControls | null>(null)

  const commit = (next: number) => {
    if (next === latest.current) return
    latest.current = next
    setValue(next)
    onChange(next)
  }
  const stepped = (fraction: number) => clamp(Math.round((min + fraction * span) / step) * step, min, max)
  const glideTo = (next: number) => {
    fillAnim.current?.stop()
    const target = (next - min) / span
    if (reduced) fill.jump(target)
    else fillAnim.current = animate(fill, target, SNAP)
  }
  const settleStretch = () => {
    if (reduced) {
      stretch.jump(1)
      swell.jump(1)
      return
    }
    animate(stretch, 1, physical(motionTokens.spring.morph))
    animate(swell, 1, SNAP)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return
    event.currentTarget.setPointerCapture(event.pointerId)
    fillAnim.current?.stop()
    drag.current = { id: event.pointerId, x: event.clientX, from: fill.get(), moved: false }
    if (!reduced) animate(swell, 1.06, SNAP)
    trackRef.current?.focus({ preventScroll: true })
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    const width = trackRef.current?.offsetWidth || 1
    const dx = event.clientX - state.x
    if (!state.moved && Math.abs(dx) < 3) return
    state.moved = true
    const raw = state.from + dx / width
    const kept = clamp(raw, 0, 1)
    fill.set(kept)
    // Past an end the whole track gives a little, anchored at the far side, so the limit reads as elastic rather than a wall.
    const over = (raw - kept) * width
    if (!reduced) {
      const give = rubber(over, 14)
      origin.set(give >= 0 ? "0% 50%" : "100% 50%")
      stretch.set(1 + Math.abs(give) / width)
    }
    commit(stepped(kept))
  }
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    drag.current = null
    if (!state.moved && event.type === "pointerup") {
      const rect = trackRef.current?.getBoundingClientRect()
      if (rect) {
        const next = stepped(clamp((event.clientX - rect.left) / (rect.width || 1), 0, 1))
        commit(next)
        glideTo(next)
      }
    } else glideTo(latest.current)
    settleStretch()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: step,
      ArrowUp: step,
      ArrowLeft: -step,
      ArrowDown: -step,
      PageUp: step * 4,
      PageDown: -step * 4,
    }
    let next: number
    if (event.key === "Home") next = min
    else if (event.key === "End") next = max
    else if (event.key in keys) next = clamp(latest.current + keys[event.key], min, max)
    else return
    event.preventDefault()
    // A key pressed at a limit nudges the track instead of doing nothing.
    if (next === latest.current && !reduced && event.key in keys) {
      origin.set(keys[event.key] > 0 ? "0% 50%" : "100% 50%")
      animate(stretch, [1, 1.025, 1], { duration: 0.32, ease: standard })
    }
    commit(next)
    glideTo(next)
  }

  const { Icon, key } = icon(value)
  const overlay = (inverse: boolean) => (
    <span
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-between px-3.5 text-sm leading-body font-medium tabular-nums [&_svg]:size-[18px]",
        inverse ? "text-background" : "text-foreground",
      )}
      aria-hidden="true"
    >
      <Swap id={key}>
        <Icon />
      </Swap>
      <span>{format(value)}</span>
    </span>
  )

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="pl-1 text-xs leading-body text-text-secondary">
        {label}
      </span>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className="group/meter relative h-11 cursor-pointer touch-pan-y outline-none select-none [-webkit-tap-highlight-color:transparent]"
      >
        <motion.span
          className="absolute inset-0 block rounded-[16px] bg-foreground/[0.07] transition-[background-color] duration-160 ease-standard group-focus-visible/meter:bg-foreground/[0.11]"
          style={{ scaleX: stretch, scaleY: swell, transformOrigin: origin }}
          aria-hidden="true"
        >
          <motion.span className="absolute inset-0 block rounded-[16px] bg-foreground" style={{ clipPath: clip }} />
          {overlay(false)}
          <motion.span className="absolute inset-0 block" style={{ clipPath: clip }}>
            {overlay(true)}
          </motion.span>
        </motion.span>
      </div>
    </div>
  )
}

/**
 * The session length. The knob counts minutes as it travels, keeps counting across twelve o'clock into a second lap,
 * resists past 5 and 120 minutes, and springs to 5 minute steps on release.
 */
function DurationDial({
  value,
  onChange,
  untilText,
  reduced,
}: {
  value: number
  onChange: (minutes: number) => void
  untilText: (minutes: number) => string
  reduced: boolean
}) {
  const minutes = useMotionValue(value)
  const [count, setCount] = useState(value)
  const drag = useRef<{ id: number; angle: number; raw: number } | null>(null)
  const anim = useRef<AnimationPlaybackControls | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const R = 42
  const C = 2 * Math.PI * R
  const lap1 = useTransform(minutes, m => `${(clamp(m / LAP, 0, 1) * C).toFixed(2)} ${C}`)
  const lap2 = useTransform(minutes, m => `${(clamp((m - LAP) / LAP, 0, 1) * C).toFixed(2)} ${C}`)
  /* A zero length dash with a round cap would still draw a dot, so the second lap shows only once it starts. */
  const lap2Opacity = useTransform(minutes, m => (m > LAP + 0.05 ? 1 : 0))
  const knobX = useTransform(minutes, m => 50 + R * Math.sin((m / LAP) * 2 * Math.PI))
  const knobY = useTransform(minutes, m => 50 - R * Math.cos((m / LAP) * 2 * Math.PI))

  const glide = useCallback(
    (to: number) => {
      anim.current?.stop()
      if (reduced) minutes.jump(to)
      else anim.current = animate(minutes, to, SNAP)
    },
    [minutes, reduced],
  )

  // A new seed from outside (a different mode) glides the knob over.
  const seen = useRef(value)
  useEffect(() => {
    if (seen.current === value || drag.current) return
    seen.current = value
    setCount(value)
    glide(value)
  }, [glide, value])

  const angleAt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = ref.current!.getBoundingClientRect()
    return Math.atan2(event.clientX - (rect.left + rect.width / 2), -(event.clientY - (rect.top + rect.height / 2)))
  }
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return
    event.currentTarget.setPointerCapture(event.pointerId)
    anim.current?.stop()
    ref.current?.focus({ preventScroll: true })
    drag.current = { id: event.pointerId, angle: angleAt(event), raw: clamp(minutes.get(), DIAL_MIN, DIAL_MAX) }
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    const angle = angleAt(event)
    let delta = angle - state.angle
    // Unwrap across twelve o'clock so the count keeps going instead of jumping a lap.
    if (delta > Math.PI) delta -= 2 * Math.PI
    if (delta < -Math.PI) delta += 2 * Math.PI
    state.angle = angle
    state.raw += (delta / (2 * Math.PI)) * LAP
    // Past the limits the knob still moves, but less and less; the raw angle is kept so turning back feels anchored.
    const raw = state.raw
    const shown = raw < DIAL_MIN ? DIAL_MIN + rubber(raw - DIAL_MIN, 4) : raw > DIAL_MAX ? DIAL_MAX + rubber(raw - DIAL_MAX, 4) : raw
    minutes.set(reduced ? clamp(raw, DIAL_MIN, DIAL_MAX) : shown)
    // Without travel to follow, the reduced dial moves in the same 5 minute steps it lands on.
    if (reduced) minutes.set(clamp(Math.round(raw / 5) * 5, DIAL_MIN, DIAL_MAX))
    setCount(clamp(Math.round(raw), DIAL_MIN, DIAL_MAX))
  }
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    drag.current = null
    const snapped = clamp(Math.round(state.raw / 5) * 5, DIAL_MIN, DIAL_MAX)
    seen.current = snapped
    setCount(snapped)
    glide(snapped)
    onChange(snapped)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 15, PageDown: -15 }
    let next: number
    if (event.key === "Home") next = DIAL_MIN
    else if (event.key === "End") next = DIAL_MAX
    else if (event.key in steps) next = clamp(count + steps[event.key], DIAL_MIN, DIAL_MAX)
    else return
    event.preventDefault()
    seen.current = next
    setCount(next)
    glide(next)
    onChange(next)
  }

  const until = untilText(count)
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Session length"
      aria-valuemin={DIAL_MIN}
      aria-valuemax={DIAL_MAX}
      aria-valuenow={count}
      aria-valuetext={`${count} minutes, until ${until}`}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      className="group/dial relative mx-auto size-[164px] flex-none cursor-grab touch-none rounded-full outline-none select-none active:cursor-grabbing max-[359px]:size-[150px]"
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          strokeWidth="7"
          className="stroke-foreground/[0.07] transition-[stroke] duration-160 group-focus-visible/dial:stroke-foreground/[0.12]"
        />
        <g transform="rotate(-90 50 50)">
          <motion.circle cx="50" cy="50" r={R} fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-accent/45" style={{ strokeDasharray: lap1 }} />
          <motion.circle cx="50" cy="50" r={R} fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-accent" style={{ strokeDasharray: lap2, opacity: lap2Opacity }} />
        </g>
        <motion.circle cx={knobX} cy={knobY} r="6.4" className="fill-control-thumb stroke-border-strong" strokeWidth="0.6" style={{ filter: "drop-shadow(0 1px 1.5px rgb(0 0 0 / .18))" }} />
      </svg>
      <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="flex items-baseline gap-1">
          <span className="font-display text-[2rem] leading-none font-medium tracking-display text-foreground tabular-nums">{count}</span>
          <span className="text-xs leading-body text-text-secondary">min</span>
        </span>
        <span className="mt-1 text-xs leading-body text-text-secondary tabular-nums">until {until}</span>
      </span>
    </div>
  )
}

function FocusDetail({
  titleId,
  modes,
  people,
  session,
  now,
  formatTime,
  reduced,
  onStart,
  onEnd,
  onClose,
}: {
  titleId: string
  modes: ControlCenterFocusMode[]
  people: ControlCenterPerson[]
  session: Session | null
  now: number
  formatTime: (date: Date) => string
  reduced: boolean
  onStart: (mode: string, minutes: number) => void
  onEnd: () => void
  onClose: () => void
}) {
  const descId = useId()
  const [mode, setMode] = useState(session?.mode ?? modes[0]?.id ?? "")
  const [minutes, setMinutes] = useState(() => session?.minutes ?? modes[0]?.defaultMinutes ?? 25)
  const picked = modes.find(item => item.id === mode) ?? modes[0]
  const pick = (next: ControlCenterFocusMode, focus = false, group?: HTMLElement) => {
    setMode(next.id)
    setMinutes(clamp(next.defaultMinutes, DIAL_MIN, DIAL_MAX))
    if (focus) group?.querySelector<HTMLElement>(`[data-mode="${CSS.escape(next.id)}"]`)?.focus()
  }
  const onRadioKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = modes.findIndex(item => item.id === mode)
    const last = modes.length - 1
    const map: Record<string, number> = {
      ArrowRight: index >= last ? 0 : index + 1,
      ArrowDown: index >= last ? 0 : index + 1,
      ArrowLeft: index <= 0 ? last : index - 1,
      ArrowUp: index <= 0 ? last : index - 1,
      Home: 0,
      End: last,
    }
    if (!(event.key in map)) return
    event.preventDefault()
    pick(modes[map[event.key]], true, event.currentTarget)
  }
  const untilText = (value: number) => formatTime(new Date(now + value * 60_000))

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex h-8 items-center gap-2 pl-1">
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-base leading-body font-medium">
          Focus
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className={cn("grid size-8 flex-none cursor-pointer place-items-center rounded-full text-text-secondary pointer-fine:hover:bg-foreground/[0.065]", focusMuted)}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div role="radiogroup" aria-label="Focus mode" aria-describedby={descId} onKeyDown={onRadioKey} className="flex gap-1">
        {modes.map(item => {
          const on = item.id === mode
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              data-mode={item.id}
              data-autofocus={on ? "" : undefined}
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => pick(item)}
              className={cn(
                "relative inline-flex h-9 min-w-0 flex-auto cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 text-sm leading-body font-medium whitespace-nowrap",
                "transition-[color] duration-160 ease-standard",
                on ? "text-background" : "text-foreground pointer-fine:hover:bg-foreground/[0.065] focus-visible:bg-foreground/[0.065]",
                "outline-none",
              )}
            >
              {on && (
                <motion.span
                  layoutId={`${titleId}-mode`}
                  className="absolute inset-0 -z-0 rounded-full bg-foreground"
                  transition={reduced ? { duration: 0 } : motionTokens.spring.morph}
                  aria-hidden="true"
                />
              )}
              <Icon className="relative size-4 flex-none" aria-hidden="true" />
              <span className="relative truncate">{item.label}</span>
            </button>
          )
        })}
      </div>
      <p id={descId} className="-mt-1 h-[1.125rem] overflow-hidden text-center text-xs leading-body text-text-secondary">
        <Swap id={picked?.id ?? ""}>{picked?.description}</Swap>
      </p>
      <DurationDial value={minutes} onChange={setMinutes} untilText={untilText} reduced={reduced} />
      {people.length > 0 && (
        <div className="flex items-center justify-center gap-2">
          <ul className="flex -space-x-1.5" aria-label="Can still reach you">
            {people.map(person => (
              <li key={person.id} className="rounded-full ring-2 ring-surface-raised">
                <img src={person.avatar} alt={person.name} title={person.name} className="size-6 rounded-full object-cover" />
              </li>
            ))}
          </ul>
          <span className="text-xs leading-body text-text-secondary" aria-hidden="true">
            can still reach you
          </span>
        </div>
      )}
      <div className="flex gap-2">
        {session && (
          <Button variant="secondary" className="min-h-10 flex-1 rounded-full" onClick={onEnd}>
            End session
          </Button>
        )}
        <Button className="min-h-10 flex-1 rounded-full" onClick={() => onStart(mode, minutes)}>
          {session ? "Update session" : "Start session"}
        </Button>
      </div>
    </div>
  )
}

function NotificationsDetail({
  titleId,
  channels,
  on,
  channelOn,
  onMaster,
  onChannel,
  onClose,
}: {
  titleId: string
  channels: ControlCenterChannel[]
  on: boolean
  channelOn: Record<string, boolean>
  onMaster: (on: boolean) => void
  onChannel: (id: string, on: boolean) => void
  onClose: () => void
}) {
  const uid = useId()
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex h-8 items-center gap-2 pl-1">
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-base leading-body font-medium">
          Notifications
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className={cn("grid size-8 flex-none cursor-pointer place-items-center rounded-full text-text-secondary pointer-fine:hover:bg-foreground/[0.065]", focusMuted)}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex items-center gap-3 rounded-[14px] bg-foreground/[0.04] px-3 py-2.5">
        <span id={`${uid}-all`} className="min-w-0 flex-1 text-sm leading-body font-medium">
          Allow notifications
        </span>
        <Switch data-autofocus="" aria-labelledby={`${uid}-all`} checked={on} onCheckedChange={onMaster} className="min-h-0" />
      </div>
      <ul className="flex flex-col" aria-label="Channels">
        {channels.map(channel => (
          <li key={channel.id} className="flex items-center gap-3 border-b border-border-subtle px-3 py-2.5 last:border-b-0">
            <span className={cn("flex min-w-0 flex-1 flex-col transition-opacity duration-200", !on && "opacity-55")}>
              <span id={`${uid}-${channel.id}`} className="truncate text-sm leading-body">
                {channel.label}
              </span>
              {channel.description && (
                <span id={`${uid}-${channel.id}-d`} className="truncate text-xs leading-body text-text-secondary">
                  {channel.description}
                </span>
              )}
            </span>
            <Switch
              aria-labelledby={`${uid}-${channel.id}`}
              aria-describedby={channel.description ? `${uid}-${channel.id}-d` : undefined}
              checked={!!channelOn[channel.id]}
              onCheckedChange={next => onChannel(channel.id, next)}
              className="min-h-0"
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Quick settings for a web workspace: focus sessions, notification channels, presenting mode, alert volume, and text size.
 * It is uncontrolled; seed it with defaults and persist through onStateChange.
 */
export function ControlCenter({
  focusModes,
  channels,
  people = [],
  defaultVolume = 60,
  defaultTextSize = 100,
  formatTime = defaultFormatTime,
  onStateChange,
  label = "Quick settings",
  className,
}: ControlCenterProps) {
  const reduced = useReducedFlag()
  const uid = useId()
  const now = useNow()

  const [focus, setFocus] = useState<Session | null>(null)
  const [notifications, setNotifications] = useState(true)
  const [channelOn, setChannelOn] = useState<Record<string, boolean>>(() => Object.fromEntries(channels.map(channel => [channel.id, !!channel.defaultOn])))
  const [presenting, setPresenting] = useState(false)
  // Meters keep their own state, so a drag re-renders only the meter; the panel reads their levels from here.
  const initialVolume = clamp(Math.round(defaultVolume), 0, 100)
  const initialTextSize = clamp(Math.round(defaultTextSize / 5) * 5, 85, 130)
  const levels = useRef({ volume: initialVolume, textSize: initialTextSize })
  const toggles = useRef<Toggles>({ focus: null, notifications: true, channels: channelOn, presenting: false })

  const emit = (patch: Partial<Toggles> = {}) => {
    const next = { ...toggles.current, ...patch }
    toggles.current = next
    onStateChange?.({
      focus: next.focus ? { mode: next.focus.mode, minutes: next.focus.minutes, until: new Date(next.focus.endsAt).toISOString() } : null,
      notifications: next.notifications,
      channels: { ...next.channels },
      presenting: next.presenting,
      volume: levels.current.volume,
      textSize: levels.current.textSize,
    })
  }

  const startSession = (mode: string, minutes: number) => {
    const session = { mode, minutes, endsAt: Date.now() + minutes * 60_000 }
    setFocus(session)
    emit({ focus: session })
  }
  const endSession = () => {
    setFocus(null)
    emit({ focus: null })
  }
  // A finished session turns itself off.
  useEffect(() => {
    if (focus && now >= focus.endsAt) {
      const timer = window.setTimeout(() => {
        setFocus(null)
        const next = { ...toggles.current, focus: null }
        toggles.current = next
      }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [focus, now])

  /* ---------- One surface that grows out of a tile ---------- */
  const panelRef = useRef<HTMLDivElement>(null)
  const tileRefs = useRef<Record<DetailId, HTMLDivElement | null>>({ focus: null, notifications: null })
  const chevronRefs = useRef<Record<DetailId, HTMLButtonElement | null>>({ focus: null, notifications: null })
  const [open, setOpen] = useState<DetailId | null>(null)
  const [shown, setShown] = useState<DetailId | null>(null)
  const openRef = useRef<DetailId | null>(null)
  const focusBack = useRef<DetailId | null>(null)
  const grown = useRef(false)
  const runs = useRef<AnimationPlaybackControls[]>([])
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [tileSize, setTileSize] = useState({ w: 0, h: 0 })
  const sx = useMotionValue(0)
  const sy = useMotionValue(0)
  const sw = useMotionValue(0)
  const sh = useMotionValue(0)
  const sr = useMotionValue(TILE_RADIUS)

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const report = () => setBox(current => (current.w === panel.clientWidth && current.h === panel.clientHeight ? current : { w: panel.clientWidth, h: panel.clientHeight }))
    report()
    const observer = new ResizeObserver(report)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [])

  const rectOf = (id: DetailId): Rect | null => {
    const tile = tileRefs.current[id]
    const panel = panelRef.current
    if (!tile || !panel) return null
    const a = tile.getBoundingClientRect()
    const b = panel.getBoundingClientRect()
    return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }
  }
  const drive = (rect: Rect, radius: number, spring: Transition | null, onDone?: () => void) => {
    runs.current.forEach(run => run.stop())
    runs.current = []
    const pairs: [MotionValue<number>, number][] = [
      [sx, rect.x],
      [sy, rect.y],
      [sw, rect.w],
      [sh, rect.h],
      [sr, radius],
    ]
    if (!spring) {
      pairs.forEach(([value, to]) => value.jump(to))
      onDone?.()
      return
    }
    runs.current = pairs.map(([value, to], index) => animate(value, to, { ...spring, onComplete: index === 0 ? onDone : undefined }))
  }

  const openDetail = (id: DetailId) => {
    if (openRef.current) return
    const rect = rectOf(id)
    if (!rect) return
    // Reopening during a fold picks the surface up where it is.
    if (shown !== id) drive(rect, TILE_RADIUS, null)
    openRef.current = id
    grown.current = false
    setTileSize({ w: rect.w, h: rect.h })
    setShown(id)
    setOpen(id)
  }
  const closeDetail = useCallback(
    (focusChevron: boolean) => {
      const id = openRef.current
      if (!id) return
      openRef.current = null
      setOpen(null)
      // The grid is inert until this close renders, so the chevron takes focus in an effect.
      if (focusChevron) focusBack.current = id
      const tile = tileRefs.current[id]
      const panel = panelRef.current
      const finish = () => {
        if (!openRef.current) setShown(null)
      }
      if (!tile || !panel) return finish()
      const a = tile.getBoundingClientRect()
      const b = panel.getBoundingClientRect()
      drive({ x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }, TILE_RADIUS, reduced ? null : FOLD, finish)
    },
    // drive only touches stable motion values and refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reduced],
  )
  /** The detail reports its natural height; the surface grows to it, centered in the panel and capped to fit. */
  const onDetailSize = (height: number) => {
    const panel = panelRef.current
    if (!openRef.current || !panel) return
    const W = panel.clientWidth
    const H = panel.clientHeight
    const h = Math.min(height, H - INSET * 2)
    const target = { x: INSET, y: Math.max(INSET, (H - h) / 2), w: W - INSET * 2, h }
    const spring = reduced ? null : grown.current ? RESIZE : GROW
    grown.current = true
    drive(target, DETAIL_RADIUS, spring)
  }

  // Focus moves into the detail once it mounts, and back to the chevron once the grid is live again.
  useEffect(() => {
    if (!open) {
      const id = focusBack.current
      focusBack.current = null
      if (id) chevronRefs.current[id]?.focus({ preventScroll: true })
      return
    }
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-cc-surface="${CSS.escape(uid)}"] [data-autofocus]`)?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [open, uid])

  const onSurfaceKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      closeDetail(true)
      return
    }
    if (event.key !== "Tab") return
    // Tab cycles inside the open detail.
    const nodes = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])'),
    ).filter(node => !node.closest("[aria-hidden='true']") && node.tabIndex >= 0)
    if (!nodes.length) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  /* ---------- Tiles ---------- */
  const mode = focusModes.find(item => item.id === focus?.mode)
  const enabledCount = channels.filter(channel => channelOn[channel.id]).length
  const notificationStatus = !notifications
    ? "Off"
    : presenting
      ? "Held while presenting"
      : enabledCount === channels.length
        ? "All channels"
        : enabledCount === 0
          ? "No channels"
          : `${enabledCount} of ${channels.length} channels`
  const tiles: Record<DetailId | "presenting", TileProps> = {
    focus: {
      label: mode?.label ?? "Focus",
      status: focus ? `Until ${formatTime(new Date(focus.endsAt))}` : "Off",
      icon: mode?.icon ?? Moon,
      iconKey: mode?.id ?? "off",
      on: !!focus,
      wide: true,
      detail: "focus",
      onToggle: () => {
        if (focus) return endSession()
        const first = focusModes[0]
        if (first) startSession(first.id, clamp(first.defaultMinutes, DIAL_MIN, DIAL_MAX))
      },
    },
    notifications: {
      label: "Notifications",
      status: notificationStatus,
      icon: notifications ? Bell : BellOff,
      iconKey: notifications ? "on" : "off",
      on: notifications,
      detail: "notifications",
      onToggle: () => {
        setNotifications(!notifications)
        emit({ notifications: !notifications })
      },
    },
    presenting: {
      label: "Presenting",
      status: presenting ? "Alerts held" : "Off",
      icon: Presentation,
      iconKey: "presenting",
      on: presenting,
      onToggle: () => {
        setPresenting(!presenting)
        emit({ presenting: !presenting })
      },
    },
  }

  const tile = (id: DetailId | "presenting", extra?: string) => {
    const props = tiles[id]
    const detail = id === "presenting" ? undefined : id
    return (
      <div
        ref={detail ? node => void (tileRefs.current[detail] = node) : undefined}
        className={cn(
          "relative rounded-[18px] bg-surface-raised shadow-resting ring-1 ring-border-subtle",
          detail && shown === detail && "opacity-0",
          extra,
        )}
      >
        <Tile
          {...props}
          expanded={open === detail}
          onOpen={detail ? () => openDetail(detail) : undefined}
          chevronRef={detail ? node => void (chevronRefs.current[detail] = node) : undefined}
        />
      </div>
    )
  }

  const titleId = `${uid}-detail-title`
  const detailOpen = open !== null && open === shown

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={panelRef}
        role="group"
        aria-label={label}
        className={cn(
          "relative isolate h-[26rem] w-[min(100%,22.5rem)] overflow-hidden rounded-[28px] bg-surface-muted text-foreground shadow-floating ring-1 ring-border",
          className,
        )}
      >
        <div inert={!!open || undefined} className="flex h-full flex-col gap-2 p-3 max-[359px]:p-2">
          <div className="flex h-7 items-center justify-between px-1">
            <span className="text-sm leading-body font-medium">{label}</span>
          </div>
          {tile("focus", "h-16")}
          <div className="grid grid-cols-2 gap-2">
            {tile("notifications", "h-[84px]")}
            {tile("presenting", "h-[84px]")}
          </div>
          <div className="mt-auto flex flex-col gap-3">
            <Meter
              label="Alert volume"
              min={0}
              max={100}
              step={1}
              defaultValue={initialVolume}
              format={value => `${value}%`}
              icon={value => (value === 0 ? { Icon: VolumeX, key: "mute" } : value < 34 ? { Icon: Volume1, key: "low" } : { Icon: Volume2, key: "high" })}
              onChange={value => {
                levels.current.volume = value
                emit()
              }}
              reduced={reduced}
            />
            <Meter
              label="Text size"
              min={85}
              max={130}
              step={5}
              defaultValue={initialTextSize}
              format={value => `${value}%`}
              icon={() => ({ Icon: ALargeSmall, key: "text" })}
              onChange={value => {
                levels.current.textSize = value
                emit()
              }}
              reduced={reduced}
            />
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              key="scrim"
              className="absolute inset-0 z-10 bg-background/45 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: duration.standard, ease: standard } }}
              exit={{ opacity: 0, transition: { duration: duration.exit, ease: standard } }}
              onClick={() => closeDetail(true)}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>

        {shown && (
          <motion.div
            data-cc-surface={uid}
            role={detailOpen ? "dialog" : undefined}
            aria-modal={detailOpen || undefined}
            aria-labelledby={detailOpen ? titleId : undefined}
            onKeyDown={onSurfaceKey}
            className="absolute top-0 left-0 z-20 overflow-hidden bg-surface-raised shadow-floating ring-1 ring-border-subtle"
            style={{ x: sx, y: sy, width: sw, height: sh, borderRadius: sr }}
          >
            {/* The tile's own face rides along and fades as the detail comes in, so the eye reads one shape changing. */}
            <motion.div
              className="absolute top-0 left-0"
              style={{ width: tileSize.w, height: tileSize.h }}
              initial={false}
              animate={
                detailOpen
                  ? { opacity: 0, filter: `blur(${blur.subtle}px)`, transition: { duration: duration.instant, ease: standard } }
                  : { opacity: 1, filter: "blur(0px)", transition: { duration: duration.fast, ease: enter, delay: 0.1 } }
              }
            >
              <Tile {...tiles[shown]} ghost />
            </motion.div>
            <DetailFace
              width={box.w - INSET * 2}
              maxHeight={box.h - INSET * 2}
              visible={detailOpen}
              onSize={onDetailSize}
            >
              {shown === "focus" ? (
                <FocusDetail
                  titleId={titleId}
                  modes={focusModes}
                  people={people}
                  session={focus}
                  now={now}
                  formatTime={formatTime}
                  reduced={reduced}
                  onStart={(id, minutes) => {
                    startSession(id, minutes)
                    closeDetail(true)
                  }}
                  onEnd={() => {
                    endSession()
                    closeDetail(true)
                  }}
                  onClose={() => closeDetail(true)}
                />
              ) : (
                <NotificationsDetail
                  titleId={titleId}
                  channels={channels}
                  on={notifications}
                  channelOn={channelOn}
                  onMaster={next => {
                    setNotifications(next)
                    emit({ notifications: next })
                  }}
                  onChannel={(id, next) => {
                    const all = { ...toggles.current.channels, [id]: next }
                    setChannelOn(all)
                    emit({ channels: all })
                  }}
                  onClose={() => closeDetail(true)}
                />
              )}
            </DetailFace>
          </motion.div>
        )}
      </div>
    </MotionConfig>
  )
}

/** The detail keeps its own natural height, which the surface follows; it crossfades in with a small blur. */
function DetailFace({
  width,
  maxHeight,
  visible,
  onSize,
  children,
}: {
  width: number
  maxHeight: number
  visible: boolean
  onSize: (height: number) => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const report = useRef(onSize)
  useLayoutEffect(() => {
    report.current = onSize
  })
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => report.current(node.scrollHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node.firstElementChild ?? node)
    return () => observer.disconnect()
  }, [])
  return (
    <motion.div
      ref={ref}
      className="absolute top-0 left-0 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ width: Math.max(0, width), maxHeight: Math.max(0, maxHeight) }}
      initial={{ opacity: 0, filter: `blur(${blur.soft}px)` }}
      animate={
        visible
          ? { opacity: 1, filter: "blur(0px)", transition: { duration: 0.22, ease: enter, delay: 0.06 } }
          : { opacity: 0, filter: `blur(${blur.soft}px)`, transition: { duration: duration.instant, ease: standard } }
      }
      inert={!visible || undefined}
    >
      {children}
    </motion.div>
  )
}

export default ControlCenter
