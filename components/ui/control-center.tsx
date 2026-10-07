"use client"

/* eslint-disable @next/next/no-img-element -- people avatars are plain img tags from the caller's URLs, as documented. */

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import type { KeyboardEvent, PointerEvent, ReactNode } from "react"
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react"
import type { AnimationPlaybackControls, MotionValue, Transition } from "motion/react"
import { Bell, BellOff, ChevronRight, Headphones, Presentation, Type, Volume1, Volume2, VolumeX, X } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Switch } from "@/components/ui/switch"
import { motionTokens as staticTokens } from "@/lib/motion-tokens"
import { useMotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { ReducedMotionConfig, useReducedMotion } from "@/lib/reduced-motion"

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
type Toggles = {
  focus: Session | null
  notifications: boolean
  channels: Record<string, boolean>
  presenting: boolean
}
type Rect = { x: number; y: number; w: number; h: number }

type Bezier = [number, number, number, number]
const enter = [...staticTokens.ease.enter] as Bezier
const standard = [...staticTokens.ease.standard] as Bezier
/** Duration springs restated as stiffness and damping, so a retarget mid flight keeps the velocity it already has. */
const physical = ({ visualDuration, bounce }: { visualDuration: number; bounce: number }): Transition => {
  const root = (2 * Math.PI) / (visualDuration * 1.2)
  return {
    type: "spring",
    stiffness: root * root,
    damping: 2 * (1 - bounce) * root,
    mass: 1,
  }
}
/** The tile grows into its detail and folds back on the same shape spring, with its small overshoot both ways.
 *  Every small control (meter fill, track swell, dial snap, tile press) shares one quick spring. */
function useSprings() {
  const { spring } = useMotionTokens()
  return useMemo(
    () => ({
      MORPH: physical({ visualDuration: spring.morph.visualDuration ?? 0.42, bounce: spring.morph.bounce ?? 0.16 }),
      SNAP: physical({ visualDuration: spring.snappy.visualDuration ?? 0.26, bounce: spring.snappy.bounce ?? 0.12 }),
    }),
    [spring.morph, spring.snappy],
  )
}
const RADIUS = 22
/** The detail sits this far inside the panel's padding box. */
const INSET = 8
const DIAL_MIN = 5
const DIAL_MAX = 120
/** Degrees of dial per minute: 120 minutes is one full turn, back at twelve o'clock. */
const DEG = 3
const SEGMENTS = 28
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
/** Past a limit the knob gives less and less: a reciprocal curve that starts at 0.4 of the pointer's travel. */
const resist = (excess: number) => (0.4 * excess) / (1 + excess / 222)
/** A meter pulled past its end stretches at most about 6px, quickly saturating. */
const stretchOf = (excess: number) => 6 * (1 - Math.exp(-excess / 14))

const clockFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
})
const defaultFormatTime = (date: Date) => clockFormat.format(date)

const subscribe = () => () => {}
function useReducedFlag() {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
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

/** Icons swap with a short blur. */
function Swap({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const { blur, duration } = useMotionTokens()
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span
        key={id}
        className={cn("inline-flex", className)}
        initial={{ opacity: 0, scale: 0.86, filter: `blur(${blur.subtle}px)` }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={{
          opacity: 0,
          scale: 0.86,
          filter: `blur(${blur.subtle}px)`,
          transition: { duration: duration.instant, ease: standard },
        }}
        transition={{ duration: duration.fast, ease: enter }}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  )
}

/** A line of status text that rolls: the old line leaves upward as the new one rises in from below, both with a slight blur. */
function Roll({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const { blur } = useMotionTokens()
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span
        key={id}
        className={cn("block", className)}
        initial={{ opacity: 0, y: 8, filter: `blur(${blur.subtle}px)` }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{
          opacity: 0,
          y: -8,
          filter: `blur(${blur.subtle}px)`,
          transition: { duration: 0.1, ease: standard },
        }}
        transition={{ duration: 0.15, ease: enter }}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  )
}

const hoverFill = "outline-none focus-visible:bg-foreground/[0.06] pointer-fine:hover:bg-foreground/[0.06] pointer-fine:hover:text-foreground"

interface TileProps {
  label: string
  status: string
  icon: LucideIcon
  iconKey: string
  on: boolean
  wide?: boolean
  detail?: DetailId
  /** The chevron's name, which says what the detail holds. */
  detailLabel?: string
  expanded?: boolean
  onToggle?: () => void
  onOpen?: () => void
}

/** A toggle that fills the tile, with an optional chevron that opens its detail. */
function Tile({
  label,
  status,
  icon: Icon,
  iconKey,
  on,
  wide,
  detail,
  detailLabel,
  expanded,
  onToggle,
  onOpen,
  hidden,
  reduced,
  className,
  tileRef,
}: TileProps & {
  hidden?: boolean
  reduced?: boolean
  className?: string
  tileRef?: (node: HTMLDivElement | null) => void
}) {
  const { SNAP } = useSprings()
  return (
    <div ref={tileRef} className={cn("relative", hidden && "opacity-0", className)}>
      {/* A press sinks the whole tile slightly; the buttons inside stay flat. */}
      <motion.div
        whileTap={reduced ? undefined : { scale: 0.978 }}
        transition={SNAP}
        className={cn(
          "absolute inset-0 rounded-[22px] transition-[background-color] duration-240 ease-standard motion-reduce:transition-none",
          on ? "bg-[color-mix(in_oklab,var(--foreground)_7%,var(--surface-muted))]" : "bg-surface-muted"
        )}
      >
        <button
          type="button"
          aria-pressed={on}
          onClick={onToggle}
          className={cn(
            "absolute inset-0 flex min-w-0 cursor-pointer rounded-[inherit] text-left outline-none [-webkit-tap-highlight-color:transparent]",
            wide ? "items-center gap-3 py-3 pr-14 pl-3.5" : "flex-col items-start justify-between px-3.5 py-3"
          )}
        >
          <span
            className={cn(
              "grid size-9 flex-none place-items-center rounded-full transition-[background-color,color,box-shadow] duration-240 ease-standard motion-reduce:transition-none [&_svg]:size-[18px]",
              on ? "bg-accent text-accent-foreground" : "bg-surface-raised text-text-secondary shadow-resting"
            )}
          >
            <Swap id={iconKey}>
              <Icon aria-hidden="true" />
            </Swap>
          </span>
          <span className="flex w-full min-w-0 flex-col">
            <span className="truncate text-sm leading-[1.4] font-medium text-foreground">{label}</span>
            <span className="relative block h-[16.8px] overflow-hidden text-xs leading-[1.4] text-text-secondary">
              <Roll id={status} className="truncate whitespace-nowrap">
                {status}
              </Roll>
            </span>
          </span>
        </button>
        {detail && (
          <button
            type="button"
            aria-label={detailLabel}
            aria-haspopup="dialog"
            aria-expanded={expanded}
            onClick={onOpen}
            className={cn(
              "absolute grid size-8 cursor-pointer place-items-center rounded-full text-text-secondary [-webkit-tap-highlight-color:transparent]",
              "transition-[background-color,color] duration-160 ease-standard",
              hoverFill,
              wide ? "top-1/2 right-3.5 -translate-y-1/2" : "top-2 right-2"
            )}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        )}
      </motion.div>
    </div>
  )
}

/**
 * A level drawn as 28 bars. The filled layer is clipped at the exact fractional value, not at bar edges. A drag follows the pointer 1:1
 * from where it was grabbed and stretches a few pixels past either end; a tap without a drag jumps there on release, and the track swells
 * while held.
 */
function Meter({
  label,
  min,
  max,
  step,
  defaultValue,
  icon,
  preview,
  onChange,
  reduced,
}: {
  label: string
  min: number
  max: number
  step: number
  defaultValue: number
  icon: (value: number) => ReactNode
  preview?: (value: number) => ReactNode
  onChange: (value: number) => void
  reduced: boolean
}) {
  const { SNAP } = useSprings()
  const labelId = useId()
  const [value, setValue] = useState(() => clamp(Math.round(defaultValue / step) * step, min, max))
  const span = max - min
  const fill = useMotionValue((value - min) / span)
  const stretch = useMotionValue(1)
  const swell = useMotionValue(1)
  const origin = useMotionValue("0% 50%")
  const clip = useTransform(fill, f => `inset(0 ${((1 - clamp(f, 0, 1)) * 100).toFixed(3)}% 0 0)`)
  // The number follows the animated fill, so a tap counts its way over; the slider's own value is final at once.
  const shown = useTransform(fill, f => `${clamp(Math.round((min + f * span) / step) * step, min, max)}%`)
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    id: number
    x: number
    from: number
    moved: boolean
  } | null>(null)
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
  const settle = () => {
    if (reduced) {
      stretch.jump(1)
      swell.jump(1)
      return
    }
    animate(stretch, 1, SNAP)
    animate(swell, 1, SNAP)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return
    event.currentTarget.setPointerCapture(event.pointerId)
    // A fill still gliding from a tap is picked up where it is.
    fillAnim.current?.stop()
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      from: fill.get(),
      moved: false,
    }
    if (!reduced) animate(swell, 1.18, SNAP)
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
    // Past an end the track gives a few pixels, anchored at the far side, so the limit reads as elastic rather than a wall.
    if (!reduced) {
      const over = (raw - kept) * width
      origin.set(over >= 0 ? "0% 50%" : "100% 50%")
      stretch.set(1 + stretchOf(Math.abs(over)) / width)
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
    } else if (state.moved) fill.set((latest.current - min) / span)
    settle()
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
    commit(next)
    glideTo(next)
  }

  const bars = (filled: boolean) =>
    Array.from({ length: SEGMENTS }, (_, index) => (
      <span
        key={index}
        className={cn("h-full min-w-0 flex-1 rounded-[2px]", filled ? "bg-foreground" : "bg-foreground/[0.11]")}
        // The filled ink thins slightly toward the far end.
        style={filled ? { opacity: 1 - (0.12 * index) / (SEGMENTS - 1) } : undefined}
      />
    ))

  return (
    <div className="flex flex-col gap-[11px]">
      <div className="flex h-[18px] items-center gap-2 text-foreground">
        <span className="flex-none [&_svg]:size-4" aria-hidden="true">
          {icon(value)}
        </span>
        <span id={labelId} className="min-w-0 flex-1 truncate text-sm leading-[1.4]">
          {label}
        </span>
        {preview?.(value)}
        <motion.span className="min-w-[2.6em] text-right text-xs leading-[1.4] text-text-secondary tabular-nums" aria-hidden="true">
          {shown}
        </motion.span>
      </div>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value}%`}
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className="relative h-[30px] cursor-ew-resize touch-pan-y outline-none select-none [-webkit-tap-highlight-color:transparent]"
      >
        <motion.span className="absolute inset-0 block" style={{ scaleX: stretch, scaleY: swell, transformOrigin: origin }} aria-hidden="true">
          <span className="absolute inset-0 flex gap-[3px]">{bars(false)}</span>
          <motion.span className="absolute inset-0 flex gap-[3px]" style={{ clipPath: clip }}>
            {bars(true)}
          </motion.span>
        </motion.span>
      </div>
    </div>
  )
}

/**
 * The session length: 3 degrees per minute clockwise from twelve o'clock, so 120 minutes is a full turn. The knob follows the pointer's
 * angle, counting whole minutes as it goes; it clamps at 5 and 120 minutes with a reciprocal give, and springs to 5 minute steps on release.
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
  const { SNAP } = useSprings()
  const angle = useMotionValue(value * DEG)
  const [count, setCount] = useState(value)
  const drag = useRef<{ id: number; last: number; raw: number } | null>(null)
  const anim = useRef<AnimationPlaybackControls | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const dash = useTransform(angle, a => `${clamp(a / 360, 0, 1).toFixed(4)} 1`)
  const arm = useTransform(angle, a => `rotate(${a.toFixed(2)}deg)`)

  const glide = useCallback(
    (to: number) => {
      anim.current?.stop()
      if (reduced) angle.jump(to)
      else anim.current = animate(angle, to, SNAP)
    },
    [SNAP, angle, reduced]
  )

  // A new seed from outside (a different mode) glides the knob over.
  const seen = useRef(value)
  useEffect(() => {
    if (seen.current === value || drag.current) return
    seen.current = value
    setCount(value)
    glide(value * DEG)
  }, [glide, value])

  /** The pointer's angle in degrees, clockwise from twelve o'clock, 0 to 360. */
  const angleAt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = ref.current!.getBoundingClientRect()
    const deg = (Math.atan2(event.clientX - (rect.left + rect.width / 2), -(event.clientY - (rect.top + rect.height / 2))) * 180) / Math.PI
    return (deg + 360) % 360
  }
  const lo = DIAL_MIN * DEG
  const hi = DIAL_MAX * DEG
  const follow = (raw: number) => {
    const kept = clamp(raw, lo, hi)
    const shown = raw > hi ? hi + resist(raw - hi) : raw < lo ? lo - resist(lo - raw) : raw
    const minutes = Math.round(kept / DEG)
    if (reduced) angle.jump(clamp(Math.round(minutes / 5) * 5, DIAL_MIN, DIAL_MAX) * DEG)
    else if (anim.current?.state === "running") anim.current = animate(angle, shown, SNAP)
    else angle.set(shown)
    setCount(minutes)
  }
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return
    event.currentTarget.setPointerCapture(event.pointerId)
    ref.current?.focus({ preventScroll: true })
    const pointer = angleAt(event)
    // Of the turns that land on the pointer, take the one nearest the knob, so a press near twelve o'clock stays on its side.
    const current = angle.get()
    const raw = [pointer - 360, pointer, pointer + 360].reduce((best, option) =>
      Math.abs(option - current) < Math.abs(best - current) ? option : best
    )
    drag.current = { id: event.pointerId, last: pointer, raw }
    anim.current?.stop()
    if (!reduced) anim.current = animate(angle, clamp(raw, lo, hi), SNAP)
    follow(raw)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    const pointer = angleAt(event)
    // Unwrapped across twelve o'clock, so the limit is a wall to push against rather than a jump to the other end.
    let delta = pointer - state.last
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    state.last = pointer
    state.raw += delta
    follow(state.raw)
  }
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    drag.current = null
    const snapped = clamp(Math.round(clamp(state.raw, lo, hi) / DEG / 5) * 5, DIAL_MIN, DIAL_MAX)
    seen.current = snapped
    setCount(snapped)
    glide(snapped * DEG)
    onChange(snapped)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = {
      ArrowRight: 5,
      ArrowUp: 5,
      ArrowLeft: -5,
      ArrowDown: -5,
      PageUp: 15,
      PageDown: -15,
    }
    const base = clamp(Math.round(count / 5) * 5, DIAL_MIN, DIAL_MAX)
    let next: number
    if (event.key === "Home") next = DIAL_MIN
    else if (event.key === "End") next = DIAL_MAX
    else if (event.key in steps) next = clamp(base + steps[event.key], DIAL_MIN, DIAL_MAX)
    else return
    event.preventDefault()
    seen.current = next
    setCount(next)
    glide(next * DEG)
    onChange(next)
  }

  // The count reads whole minutes while dragging; the value and its end time use the 5 minute step it will land on.
  const quantized = clamp(Math.round(count / 5) * 5, DIAL_MIN, DIAL_MAX)
  const until = untilText(quantized)
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Session length"
      aria-valuemin={DIAL_MIN}
      aria-valuemax={DIAL_MAX}
      aria-valuenow={quantized}
      aria-valuetext={`${quantized} minutes, until ${until}`}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      className="relative mx-auto size-[164px] flex-none cursor-grab touch-none rounded-full outline-none select-none active:cursor-grabbing max-[359px]:size-[150px]"
    >
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
        {Array.from({ length: 24 }, (_, index) => {
          const major = index % 6 === 0
          return (
            <line
              key={index}
              x1="100"
              y1="22"
              x2="100"
              y2="32"
              transform={`rotate(${index * 15} 100 100)`}
              strokeWidth={major ? 2 : 1.5}
              className={major ? "stroke-foreground/[0.36]" : "stroke-foreground/[0.16]"}
            />
          )
        })}
        <circle cx="100" cy="100" r="94" fill="none" strokeWidth="4" className="stroke-foreground/[0.08]" />
        <motion.circle
          cx="100"
          cy="100"
          r="94"
          fill="none"
          strokeWidth="4"
          pathLength={1}
          transform="rotate(-90 100 100)"
          className="stroke-accent"
          style={{ strokeDasharray: dash }}
        />
      </svg>
      <motion.span className="pointer-events-none absolute inset-0 block" style={{ transform: arm }} aria-hidden="true">
        <span className="absolute top-[calc(3%-8px)] left-[calc(50%-8px)] size-4 rounded-full bg-surface-raised shadow-raised" />
      </motion.span>
      <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="flex items-baseline gap-0.5">
          <span className="text-[36px] leading-9 text-foreground tabular-nums">{count}</span>
          <span className="text-sm leading-[1.4] text-text-secondary">min</span>
        </span>
        <span className="mt-0.5 text-xs leading-[1.4] text-text-secondary tabular-nums">Until {until}</span>
      </span>
    </div>
  )
}

/** The detail's header: the tile's icon on the accent disc, the title, and a close button. It rides on the surface from the first frame. */
function DetailHead({ titleId, title, icon: Icon, onClose }: { titleId: string; title: string; icon: LucideIcon; onClose: () => void }) {
  return (
    <div className="flex h-[52px] flex-none items-center gap-3 pr-3 pl-3.5">
      <span className="grid size-9 flex-none place-items-center rounded-full bg-accent text-accent-foreground [&_svg]:size-[18px]">
        <Icon aria-hidden="true" />
      </span>
      <h3 id={titleId} className="min-w-0 flex-1 truncate text-sm leading-[1.1] font-medium">
        {title}
      </h3>
      <button
        type="button"
        aria-label="Close"
        data-autofocus=""
        onClick={onClose}
        className="grid size-8 flex-none cursor-pointer place-items-center rounded-full bg-surface-raised text-foreground shadow-resting outline-none [-webkit-tap-highlight-color:transparent] focus-visible:bg-foreground/[0.06]"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

function FocusDetail({
  modes,
  session,
  now,
  formatTime,
  reduced,
  layoutKey,
  onStart,
  onEnd,
}: {
  modes: ControlCenterFocusMode[]
  session: Session | null
  now: number
  formatTime: (date: Date) => string
  reduced: boolean
  layoutKey: string
  onStart: (mode: string, minutes: number) => void
  onEnd: () => void
}) {
  const { MORPH } = useSprings()
  const descId = useId()
  const [mode, setMode] = useState(session?.mode ?? modes[0]?.id ?? "")
  const [minutes, setMinutes] = useState(() => session?.minutes ?? clamp(modes[0]?.defaultMinutes ?? 25, DIAL_MIN, DIAL_MAX))
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
    <div className="flex min-h-full flex-col gap-2.5 px-3.5 pt-2 pb-3.5">
      <div
        role="radiogroup"
        aria-label="Mode"
        aria-describedby={descId}
        onKeyDown={onRadioKey}
        className="flex flex-none rounded-full bg-foreground/[0.06] p-0.5"
      >
        {modes.map(item => {
          const on = item.id === mode
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              data-mode={item.id}
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => pick(item)}
              className={cn(
                "relative isolate h-[30px] min-w-0 flex-1 cursor-pointer truncate rounded-full px-2 text-xs leading-none font-medium whitespace-nowrap outline-none",
                "transition-[color] duration-160 ease-standard",
                on ? "text-foreground" : "text-text-secondary focus-visible:text-foreground pointer-fine:hover:text-foreground"
              )}
            >
              {on && (
                <motion.span
                  layoutId={`${layoutKey}-mode`}
                  className="absolute inset-0 -z-10 rounded-full bg-surface-raised shadow-resting"
                  transition={reduced ? { duration: 0 } : MORPH}
                  aria-hidden="true"
                />
              )}
              {item.label}
            </button>
          )
        })}
      </div>
      <p id={descId} className="relative h-[16.8px] flex-none overflow-hidden text-center text-xs leading-[1.4] text-text-secondary">
        <Roll id={picked?.id ?? ""}>{picked?.description}</Roll>
      </p>
      <DurationDial value={minutes} onChange={setMinutes} untilText={untilText} reduced={reduced} />
      <div className="mt-auto flex flex-none gap-2 pt-2">
        {session && (
          <button
            type="button"
            onClick={onEnd}
            className="h-[38px] flex-1 cursor-pointer rounded-full bg-foreground/[0.06] text-sm font-medium text-foreground transition-[background-color] duration-160 ease-standard outline-none focus-visible:bg-foreground/[0.1] pointer-fine:hover:bg-foreground/[0.1]"
          >
            End session
          </button>
        )}
        <button
          type="button"
          onClick={() => onStart(mode, minutes)}
          className="h-[38px] flex-1 cursor-pointer rounded-full bg-foreground text-sm font-medium text-background transition-opacity duration-160 ease-standard outline-none focus-visible:opacity-85 pointer-fine:hover:opacity-90"
        >
          {session ? "Update session" : "Start session"}
        </button>
      </div>
    </div>
  )
}

function SwitchRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3 py-[7px]">
      <span className="flex min-w-0 flex-1 flex-col">
        <span id={id} className="truncate text-sm leading-[1.4]">
          {label}
        </span>
        {description && (
          <span id={`${id}-d`} className="truncate text-xs leading-[1.4] text-text-secondary">
            {description}
          </span>
        )}
      </span>
      <Switch
        aria-labelledby={id}
        aria-describedby={description ? `${id}-d` : undefined}
        checked={checked}
        onCheckedChange={onChange}
        className="min-h-0"
      />
    </div>
  )
}

function NotificationsDetail({
  channels,
  people,
  on,
  channelOn,
  onMaster,
  onChannel,
}: {
  channels: ControlCenterChannel[]
  people: ControlCenterPerson[]
  on: boolean
  channelOn: Record<string, boolean>
  onMaster: (on: boolean) => void
  onChannel: (id: string, on: boolean) => void
}) {
  const uid = useId()
  const shown = people.slice(0, 3)
  const names = shown.map(person => person.name.split(" ")[0]).join(", ")
  return (
    <div className="flex min-h-full flex-col gap-2.5 px-3.5 pt-2 pb-3.5">
      <div className="border-b border-border pb-1.5">
        <SwitchRow id={`${uid}-all`} label="All notifications" description="Delivered as they arrive" checked={on} onChange={onMaster} />
      </div>
      <ul className="flex flex-col" aria-label="Channels">
        {channels.map(channel => (
          <li key={channel.id}>
            <SwitchRow
              id={`${uid}-${channel.id}`}
              label={channel.label}
              description={channel.description}
              checked={!!channelOn[channel.id]}
              onChange={next => onChannel(channel.id, next)}
            />
          </li>
        ))}
      </ul>
      {shown.length > 0 && (
        <div className="mt-auto flex items-center gap-3 border-t border-border pt-3">
          <ul className="flex flex-none" aria-label={`${names} can reach you`}>
            {shown.map((person, index) => (
              <li key={person.id} className={cn("rounded-full ring-2 ring-surface-muted", index > 0 && "-ml-2")}>
                <img src={person.avatar} alt={person.name} title={person.name} className="size-7 rounded-full object-cover" />
              </li>
            ))}
          </ul>
          <span className="min-w-0 text-xs leading-[1.4] text-text-secondary" aria-hidden="true">
            {names} can reach you
          </span>
        </div>
      )}
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
  const { MORPH } = useSprings()
  const reduced = useReducedFlag()
  const uid = useId()
  const now = useNow()

  const [focus, setFocus] = useState<Session | null>(null)
  const [notifications, setNotifications] = useState(true)
  const [channelOn, setChannelOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(channels.map(channel => [channel.id, !!channel.defaultOn]))
  )
  const [presenting, setPresenting] = useState(false)
  // Meters keep their own state, so a drag re-renders only the meter; the panel reads their levels from here.
  const initialVolume = clamp(Math.round(defaultVolume), 0, 100)
  const initialTextSize = clamp(Math.round(defaultTextSize / 5) * 5, 85, 130)
  const levels = useRef({ volume: initialVolume, textSize: initialTextSize })
  const toggles = useRef<Toggles>({
    focus: null,
    notifications: true,
    channels: channelOn,
    presenting: false,
  })

  const emit = (patch: Partial<Toggles> = {}) => {
    const next = { ...toggles.current, ...patch }
    toggles.current = next
    onStateChange?.({
      focus: next.focus
        ? {
            mode: next.focus.mode,
            minutes: next.focus.minutes,
            until: new Date(next.focus.endsAt).toISOString(),
          }
        : null,
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
  const panelRef = useRef<HTMLElement>(null)
  const tileRefs = useRef<Record<DetailId, HTMLDivElement | null>>({
    focus: null,
    notifications: null,
  })
  const [open, setOpen] = useState<DetailId | null>(null)
  const [shown, setShown] = useState<DetailId | null>(null)
  const openRef = useRef<DetailId | null>(null)
  const shownRef = useRef<DetailId | null>(null)
  const focusBack = useRef<DetailId | null>(null)
  const runs = useRef<AnimationPlaybackControls[]>([])
  const [box, setBox] = useState({ w: 0, h: 0 })
  const sx = useMotionValue(0)
  const sy = useMotionValue(0)
  const sw = useMotionValue(0)
  const sh = useMotionValue(0)

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const report = () =>
      setBox(current =>
        current.w === panel.clientWidth && current.h === panel.clientHeight ? current : { w: panel.clientWidth, h: panel.clientHeight }
      )
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
    // Measured from the padding box, which is what the absolute surface is placed in.
    return {
      x: a.left - b.left - panel.clientLeft,
      y: a.top - b.top - panel.clientTop,
      w: a.width,
      h: a.height,
    }
  }
  const drive = (rect: Rect, spring: Transition | null, onDone?: () => void, from?: Rect) => {
    runs.current.forEach(run => run.stop())
    runs.current = []
    if (from) {
      sx.jump(from.x)
      sy.jump(from.y)
      sw.jump(from.w)
      sh.jump(from.h)
    }
    const pairs: [MotionValue<number>, number][] = [
      [sx, rect.x],
      [sy, rect.y],
      [sw, rect.w],
      [sh, rect.h],
    ]
    if (!spring) {
      pairs.forEach(([value, to]) => value.jump(to))
      onDone?.()
      return
    }
    runs.current = pairs.map(([value, to], index) =>
      animate(value, to, {
        ...spring,
        onComplete: index === 0 ? onDone : undefined,
      })
    )
  }

  const openDetail = useCallback(
    (id: DetailId) => {
      const panel = panelRef.current
      const rect = rectOf(id)
      if (openRef.current || !rect || !panel) return
      // Reopening during a fold picks the surface up where it is.
      const from = shownRef.current === id ? undefined : rect
      openRef.current = id
      shownRef.current = id
      setShown(id)
      setOpen(id)
      drive(
        {
          x: INSET,
          y: INSET,
          w: panel.clientWidth - INSET * 2,
          h: panel.clientHeight - INSET * 2,
        },
        reduced ? null : MORPH,
        undefined,
        from
      )
    },
    // drive and rectOf only touch stable motion values and refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reduced]
  )
  const closeDetail = useCallback(
    (focusChevron: boolean) => {
      const id = openRef.current
      if (!id) return
      openRef.current = null
      setOpen(null)
      // The grid is inert until this close renders, so the chevron takes focus in an effect.
      if (focusChevron) focusBack.current = id
      const finish = () => {
        if (openRef.current) return
        shownRef.current = null
        setShown(null)
      }
      const rect = rectOf(id)
      if (!rect) return finish()
      drive(rect, reduced ? null : MORPH, finish)
    },
    // drive and rectOf only touch stable motion values and refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reduced]
  )

  // A panel that changes size while a detail is open keeps the detail filling it.
  useEffect(() => {
    if (!openRef.current) return
    drive(
      {
        x: INSET,
        y: INSET,
        w: Math.max(0, box.w - INSET * 2),
        h: Math.max(0, box.h - INSET * 2),
      },
      null
    )
    // Only a size change re-lays the open detail.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box])

  // Focus moves into the detail once it mounts, and back to the chevron once the grid is live again.
  useEffect(() => {
    if (!open) {
      const id = focusBack.current
      focusBack.current = null
      if (id) tileRefs.current[id]?.querySelector<HTMLElement>("[aria-haspopup]")?.focus({ preventScroll: true })
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
      event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])')
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
  const tiles: Record<DetailId | "presenting", Omit<TileProps, "onToggle" | "onOpen">> = {
    focus: {
      label: mode?.label ?? "Focus",
      status: focus ? `Until ${formatTime(new Date(focus.endsAt))}` : "Off",
      icon: mode?.icon ?? Headphones,
      iconKey: mode?.id ?? "off",
      on: !!focus,
      wide: true,
      detail: "focus",
      detailLabel: "Focus session settings",
    },
    notifications: {
      label: "Notifications",
      status: notificationStatus,
      icon: notifications ? Bell : BellOff,
      iconKey: notifications ? "on" : "off",
      on: notifications,
      detail: "notifications",
      detailLabel: "Notification channels",
    },
    presenting: {
      label: "Presenting",
      status: presenting ? "Previews hidden" : "Off",
      icon: Presentation,
      iconKey: "presenting",
      on: presenting,
    },
  }

  const slot = (id: DetailId | "presenting", extra?: string) => {
    const detail = id === "presenting" ? undefined : id
    return {
      ...tiles[id],
      expanded: open === detail,
      hidden: !!detail && shown === detail,
      reduced,
      className: extra,
    }
  }

  const titleId = `${uid}-detail-title`
  const detailOpen = open !== null && open === shown
  const headIcon = shown === "focus" ? tiles.focus.icon : tiles.notifications.icon

  return (
    <ReducedMotionConfig>
      <section
        ref={panelRef}
        aria-label={label}
        className={cn(
          "relative isolate box-border flex min-h-[396px] w-[min(100%,360px)] flex-col overflow-hidden rounded-[30px] border border-border bg-surface-raised p-2.5 text-foreground shadow-floating max-[359px]:p-1.5",
          className
        )}
      >
        <div inert={!!open || undefined} aria-hidden={!!open || undefined} className="grid flex-1 grid-cols-2 grid-rows-[84px_104px_1fr] gap-2">
          <Tile
            {...slot("focus", "col-span-2")}
            tileRef={node => void (tileRefs.current.focus = node)}
            onOpen={() => openDetail("focus")}
            onToggle={() => {
              if (focus) return endSession()
              const first = focusModes[0]
              if (first) startSession(first.id, clamp(first.defaultMinutes, DIAL_MIN, DIAL_MAX))
            }}
          />
          <Tile
            {...slot("notifications")}
            tileRef={node => void (tileRefs.current.notifications = node)}
            onOpen={() => openDetail("notifications")}
            onToggle={() => {
              setNotifications(!notifications)
              emit({ notifications: !notifications })
            }}
          />
          <Tile
            {...slot("presenting")}
            onToggle={() => {
              setPresenting(!presenting)
              emit({ presenting: !presenting })
            }}
          />
          <div className="col-span-2 flex flex-col justify-center gap-3.5 px-1.5 pt-1 pb-1.5">
            <Meter
              label="Alert volume"
              min={0}
              max={100}
              step={1}
              defaultValue={initialVolume}
              icon={value => (value === 0 ? <VolumeX /> : value < 34 ? <Volume1 /> : <Volume2 />)}
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
              icon={() => <Type />}
              preview={value => (
                <span className="grid h-[18px] w-[26px] flex-none place-items-center overflow-visible" aria-hidden="true">
                  <span className="leading-none font-medium" style={{ fontSize: `${(15 * value) / 100}px` }}>
                    Aa
                  </span>
                </span>
              )}
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
              className="absolute inset-0 z-10 bg-surface-raised/55 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                transition: { duration: 0.37, ease: standard, delay: 0.025 },
              }}
              exit={{
                opacity: 0,
                transition: { duration: 0.26, ease: standard },
              }}
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
            className="absolute top-0 left-0 z-20 flex flex-col overflow-hidden bg-surface-muted"
            style={{
              x: sx,
              y: sy,
              width: sw,
              height: sh,
              borderRadius: RADIUS,
            }}
          >
            {/* The header is opaque from the first frame and rides with the surface; the body fades in a beat later. */}
            <DetailHead titleId={titleId} title={shown === "focus" ? "Focus" : "Notifications"} icon={headIcon} onClose={() => closeDetail(true)} />
            <motion.div
              className="min-h-0 flex-1 [scrollbar-width:none] overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:hidden"
              style={{
                width: Math.max(0, box.w - INSET * 2),
                minWidth: Math.max(0, box.w - INSET * 2),
              }}
              initial={{ opacity: 0 }}
              animate={
                detailOpen
                  ? {
                      opacity: 1,
                      transition: {
                        duration: 0.25,
                        ease: standard,
                        delay: 0.06,
                      },
                    }
                  : {
                      opacity: 0,
                      transition: { duration: 0.095, ease: "linear" },
                    }
              }
              inert={!detailOpen || undefined}
            >
              {shown === "focus" ? (
                <FocusDetail
                  modes={focusModes}
                  session={focus}
                  now={now}
                  formatTime={formatTime}
                  reduced={reduced}
                  layoutKey={uid}
                  onStart={(id, minutes) => {
                    startSession(id, minutes)
                    closeDetail(true)
                  }}
                  onEnd={() => {
                    endSession()
                    closeDetail(true)
                  }}
                />
              ) : (
                <NotificationsDetail
                  channels={channels}
                  people={people}
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
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </section>
    </ReducedMotionConfig>
  )
}

export default ControlCenter
