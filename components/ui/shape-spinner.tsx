"use client"

import { useEffect, useMemo, useRef } from "react"
import type { CSSProperties } from "react"
import { animate, motion, useMotionValue, useSpring, useTransform } from "motion/react"
import type { MotionValue } from "motion/react"

import { useMotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export type MorphLoaderVariant = "dots" | "bars" | "ring" | "square"
export type MorphLoaderStatus = "loading" | "success" | "error"

export interface MorphLoaderProps {
  /** Loading shape. Changing it while loading morphs the strokes into the new shape. */
  variant?: MorphLoaderVariant
  /** success folds the strokes into a check, error into a cross, loading gathers them back. */
  status?: MorphLoaderStatus
  /** Rendered size in px. The drawing uses a 24 unit grid. */
  size?: number
  /** Stroke thickness in grid units for ring, square, check, and cross. */
  strokeWidth?: number
  /** Colors the check with --success and the cross with --danger. Off keeps currentColor. */
  tone?: boolean
  label?: string
  successLabel?: string
  errorLabel?: string
  /** Drops the status role and text, for loaders inside a control that announces its own state. */
  decorative?: boolean
  className?: string
  style?: CSSProperties
}

/** One stroke: a chord from its center along a direction, bent into an arc by its sagitta. Everything is in grid units. */
interface Pose {
  x: number
  y: number
  len: number
  /** Degrees. */
  dir: number
  /** Sagitta of the arc; positive bulges to the right of the direction of travel. */
  bend: number
  w: number
}

const CENTER = 12
const RING_RADIUS = 8
/** Ring stroke span in degrees at rest; the loop breathes it between about 41 and 69. */
const RING_SPAN = 55
const RING_BREATH = 14
/** Half the side of the tumbling square. */
const SQUARE_HALF = 9.5
/** Each stroke rides a spring between snappy and morph: shapes read within about 350ms with a small settle. */
const shapeSpringOf = (morph: ReturnType<typeof useMotionTokens>["spring"]["morph"]) => ({ ...morph, visualDuration: 0.35, bounce: 0.12 })
const STROKES = [0, 1, 2, 3] as const
const rad = (deg: number) => (deg * Math.PI) / 180

/** A ring arc as a stroke: the chord sits inside the circle and the sagitta carries it back out to the radius. */
function arc(theta: number, span: number, w: number): Pose {
  const half = rad(span) / 2
  const distance = RING_RADIUS * Math.cos(half)
  return {
    x: CENTER + distance * Math.cos(rad(theta)),
    y: CENTER + distance * Math.sin(rad(theta)),
    len: 2 * RING_RADIUS * Math.sin(half),
    dir: theta + 90,
    bend: RING_RADIUS * (1 - Math.cos(half)),
    w,
  }
}

/** A straight segment from one grid point to another, so marks read in the order they are drawn. */
function segment(x1: number, y1: number, x2: number, y2: number, w: number): Pose {
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2, len: Math.hypot(x2 - x1, y2 - y1), dir: (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI, bend: 0, w }
}

/** Unused strokes shrink to nothing on the end of the last visible one, so they never flash across the mark. */
const hidden = (at: Pose): Pose => ({ ...at, len: 0, bend: 0, w: 0 })

function shapeOf(variant: MorphLoaderVariant, status: MorphLoaderStatus, strokeWidth: number): Pose[] {
  if (status === "success") {
    // All four strokes fold into the check, two per arm, so it draws in order from the short arm to the long one.
    const start = { x: 5, y: 12.7 }
    const vertex = { x: 10.2, y: 17.7 }
    const end = { x: 19.3, y: 7.7 }
    const middle = (from: { x: number; y: number }, to: { x: number; y: number }) => ({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 })
    const shortMid = middle(start, vertex)
    const longMid = middle(vertex, end)
    return [
      segment(start.x, start.y, shortMid.x, shortMid.y, strokeWidth),
      segment(shortMid.x, shortMid.y, vertex.x, vertex.y, strokeWidth),
      segment(vertex.x, vertex.y, longMid.x, longMid.y, strokeWidth),
      segment(longMid.x, longMid.y, end.x, end.y, strokeWidth),
    ]
  }
  if (status === "error") {
    // Four arms reach in from the corners and stop just short of the center.
    const outer = 5.8
    const inner = 0.6
    return STROKES.map(index => {
      const sx = index === 0 || index === 3 ? -1 : 1
      const sy = index < 2 ? -1 : 1
      return segment(CENTER + sx * outer, CENTER + sy * outer, CENTER + sx * inner, CENTER + sy * inner, strokeWidth)
    })
  }
  if (variant === "dots") {
    // Three dots on the grid; the fourth stroke hides on the last one.
    const dots = [5, 12, 19].map(x => ({ x, y: CENTER, len: 0, dir: 0, bend: 0, w: 4 }))
    return [...dots, hidden(dots[2])]
  }
  return STROKES.map(index => {
    if (variant === "bars") return { x: 4.5 + index * 5, y: CENTER, len: 6, dir: 90, bend: 0, w: 3 }
    if (variant === "ring") return arc(index * 90, RING_SPAN, strokeWidth)
    return {
      x: CENTER + SQUARE_HALF * Math.cos(rad(index * 90)),
      y: CENTER + SQUARE_HALF * Math.sin(rad(index * 90)),
      len: SQUARE_HALF * 2,
      dir: index * 90 + 90,
      bend: 0,
      w: strokeWidth,
    }
  })
}

/* Loop timing in seconds. */
const DOT_PERIOD = 0.91
/** Each dot spends this long in the air, and the next one leaves this much later. */
const DOT_HOP = 0.41
const DOT_LAG = 0.12
const BAR_PERIOD = 1
const BAR_LAG = 0.125
const RING_SPEED = 320
const TUMBLE_PERIOD = 0.45
/** Share of each square cycle spent turning; the rest is a short hold. */
const TUMBLE_TURN = 0.6

const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
/** Progress of the current quarter turn, 0 while the square holds. */
const tumbleProgress = (clock: number) => Math.min(1, ((clock % TUMBLE_PERIOD) / TUMBLE_PERIOD) / TUMBLE_TURN)
/** Total square rotation at a clock time, so each frame adds only the difference and other turns are kept. */
const tumbleAngle = (clock: number) => 90 * Math.floor(clock / TUMBLE_PERIOD) + 90 * inOut(tumbleProgress(clock))

/** The loop's motion on top of the settled shape, at full strength. */
function loopOffset(variant: MorphLoaderVariant, index: number, clock: number, strokeWidth: number): Pose {
  const none = { x: 0, y: 0, len: 0, dir: 0, bend: 0, w: 0 }
  if (variant === "dots") {
    // A wave left to right: each dot hops and lands, then all three rest on the baseline until the next cycle.
    const phase = (((clock - index * DOT_LAG) % DOT_PERIOD) + DOT_PERIOD) % DOT_PERIOD
    const lift = index > 2 || phase > DOT_HOP ? 0 : Math.sin((Math.PI * phase) / DOT_HOP)
    // The dot squashes slightly wider at the top of its hop.
    return { ...none, y: -3.3 * lift, w: 0.6 * lift }
  }
  if (variant === "bars") {
    const grow = 0.5 - 0.5 * Math.cos((2 * Math.PI * (clock - index * BAR_LAG)) / BAR_PERIOD)
    return { ...none, len: -6 + 12 * grow }
  }
  if (variant === "ring") {
    // Each arc breathes its span on the circle; the offset is the exact difference, so the arcs stay round.
    const span = RING_SPAN + RING_BREATH * Math.sin((2 * Math.PI * clock) / 1.2 + index * 0.4)
    const base = arc(index * 90, RING_SPAN, strokeWidth)
    const next = arc(index * 90, span, strokeWidth)
    return { x: next.x - base.x, y: next.y - base.y, len: next.len - base.len, dir: 0, bend: next.bend - base.bend, w: 0 }
  }
  // The corners open while the square turns and close as it lands.
  return { ...none, len: -6 * Math.sin(Math.PI * tumbleProgress(clock)) }
}

function strokePath(pose: Pose, turn: number, scale: number) {
  const angle = rad(pose.dir)
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  const half = Math.max(pose.len, 0.001) / 2
  const turnRad = rad(turn)
  const cos = Math.cos(turnRad)
  const sin = Math.sin(turnRad)
  // Rotation and the completion pop are baked into the path, so the SVG never needs a CSS transform origin.
  const place = (x: number, y: number) => {
    const dx = (x - CENTER) * scale
    const dy = (y - CENTER) * scale
    return `${(CENTER + dx * cos - dy * sin).toFixed(3)} ${(CENTER + dx * sin + dy * cos).toFixed(3)}`
  }
  const start = place(pose.x - ux * half, pose.y - uy * half)
  const end = place(pose.x + ux * half, pose.y + uy * half)
  const sagitta = Math.abs(pose.bend)
  if (sagitta < 0.01 || pose.len < 0.01) return `M ${start} L ${end}`
  const chord = Math.max(pose.len, 0.001)
  const radius = ((chord * chord) / 4 + sagitta * sagitta) / (2 * sagitta)
  return `M ${start} A ${(radius * scale).toFixed(3)} ${(radius * scale).toFixed(3)} 0 ${sagitta > chord / 2 ? 1 : 0} ${pose.bend > 0 ? 1 : 0} ${end}`
}

interface StrokeProps {
  index: number
  pose: Pose
  variant: MorphLoaderVariant
  status: MorphLoaderStatus
  strokeWidth: number
  reduced: boolean
  clock: MotionValue<number>
  amp: MotionValue<number>
  turn: MotionValue<number>
  pop: MotionValue<number>
}

function Stroke({ index, pose, variant, status, strokeWidth, reduced, clock, amp, turn, pop }: StrokeProps) {
  const motionTokens = useMotionTokens()
  const shapeSpring = useMemo(() => shapeSpringOf(motionTokens.spring.morph), [motionTokens.spring.morph])
  // Each part of the stroke rides its own spring, so any shape morphs into any other and interruptions keep velocity.
  const x = useSpring(pose.x, shapeSpring)
  const y = useSpring(pose.y, shapeSpring)
  const len = useSpring(pose.len, shapeSpring)
  const dir = useSpring(pose.dir, shapeSpring)
  const bend = useSpring(pose.bend, shapeSpring)
  const width = useSpring(pose.w, shapeSpring)
  const draw = useMotionValue(1)
  const lastStatus = useRef(status)

  useEffect(() => {
    // Turn the shortest way round, so a stroke never spins a full circle to reach the same line.
    const current = dir.get()
    const target = pose.dir + 360 * Math.round((current - pose.dir) / 360)
    const parts: [MotionValue<number>, number][] = [[x, pose.x], [y, pose.y], [len, pose.len], [dir, target], [bend, pose.bend], [width, pose.w]]
    for (const [value, next] of parts) {
      if (reduced) value.jump(next)
      else value.set(next)
    }
  }, [bend, dir, len, pose, reduced, width, x, y])

  useEffect(() => {
    const previous = lastStatus.current
    lastStatus.current = status
    if (reduced) {
      draw.jump(1)
      return
    }
    // Entering a mark, its strokes draw in order after the loop has faded; going back to loading restores them at once.
    if (status !== "loading" && previous !== status) {
      draw.jump(0)
      const controls = animate(draw, 1, { duration: 0.16, delay: 0.1 + index * 0.08, ease: [...motionTokens.ease.standard] })
      return () => controls.stop()
    }
    const controls = animate(draw, 1, { duration: motionTokens.duration.fast })
    return () => controls.stop()
  }, [draw, index, reduced, status, motionTokens.ease.standard, motionTokens.duration.fast])

  const d = useTransform(() => {
    // Every value is read on each run, so Motion keeps all of them subscribed whatever the loop strength is.
    const strength = amp.get()
    const time = clock.get()
    const offset = strength > 0.0005 ? loopOffset(variant, index, time, strokeWidth) : null
    const shown: Pose = {
      x: x.get() + (offset ? offset.x * strength : 0),
      y: y.get() + (offset ? offset.y * strength : 0),
      len: Math.max(0, len.get() + (offset ? offset.len * strength : 0)),
      dir: dir.get(),
      bend: bend.get() + (offset ? offset.bend * strength : 0),
      w: 0,
    }
    return strokePath(shown, turn.get(), pop.get())
  })
  const stroke = useTransform(() => {
    // Read the clock even while the loop is off, or a render at zero strength drops its subscription and the squash freezes.
    const strength = amp.get()
    const time = clock.get()
    const squash = strength > 0.0005 ? loopOffset(variant, index, time, strokeWidth).w * strength : 0
    return Math.max(0, width.get() + squash) * pop.get()
  })
  // A stroke with no width is also fully transparent, so its round caps never leave a speck.
  const opacity = useTransform(() => (width.get() < 0.05 ? 0 : 1))

  return <motion.path d={d} style={{ strokeWidth: stroke, pathLength: draw, opacity }} />
}

/**
 * A tiny loader drawn from four strokes that morph between dots, bars, ring, and square shapes, then into a check or a cross when status changes.
 * It inherits currentColor, so it sits inside buttons and text without extra styling.
 */
export function MorphLoader({
  variant = "dots",
  status = "loading",
  size = 24,
  strokeWidth = 2.5,
  tone = true,
  label = "Loading",
  successLabel = "Done",
  errorLabel = "Failed",
  decorative = false,
  className,
  style,
}: MorphLoaderProps) {
  const motionTokens = useMotionTokens()
  const reduced = useReducedMotion() ?? false
  const clock = useMotionValue(0)
  /** Strength of the loop motion: 1 while loading, fading to 0 when the loader settles into a mark. */
  const amp = useMotionValue(reduced || status !== "loading" ? 0 : 1)
  const turn = useMotionValue(0)
  const pop = useMotionValue(1)
  const poses = shapeOf(variant, status, strokeWidth)

  // One frame loop, alive only while loading or while the loop is still fading out.
  useEffect(() => {
    if (reduced) {
      amp.jump(0)
      turn.jump(0)
      pop.jump(1)
      return
    }
    const loading = status === "loading"
    const spins = loading && (variant === "ring" || variant === "square")
    const upright = Math.ceil(turn.get() / 360 - 0.001) * 360
    const controls = [animate(amp, loading ? 1 : 0, { duration: loading ? motionTokens.duration.standard : motionTokens.duration.exit, ease: [...motionTokens.ease.standard] })]
    if (spins) turn.stop()
    // The drawing turns forward to upright rather than unwinding, for dots, bars, and every finished mark.
    // A spinning ring hands its speed to the settle, so it decelerates into upright instead of stopping and restarting.
    else if (turn.get() !== upright) {
      const velocity = variant === "ring" && amp.get() > 0.5 ? RING_SPEED : 0
      controls.push(animate(turn, upright, { ...motionTokens.spring.smooth, visualDuration: 0.55, velocity }))
    }
    if (!loading) controls.push(animate(pop, [1, 1, 1.14, 1], { duration: 0.6, times: [0, 0.55, 0.75, 1], ease: "easeOut" }))

    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const before = clock.get()
      const after = before + dt
      clock.set(after)
      if (spins && variant === "ring") turn.set(turn.get() + dt * RING_SPEED)
      if (spins && variant === "square") turn.set(turn.get() + tumbleAngle(after) - tumbleAngle(before))
      if (!loading && amp.get() < 0.0005) return
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      for (const control of controls) control.stop()
    }
  }, [amp, clock, pop, reduced, status, turn, variant, motionTokens])

  const text = status === "success" ? successLabel : status === "error" ? errorLabel : label
  const color = tone && status === "success" ? "var(--success)" : tone && status === "error" ? "var(--danger)" : undefined

  return (
    <span
      role={decorative ? undefined : "status"}
      aria-hidden={decorative ? true : undefined}
      className={cn("relative inline-grid flex-none place-items-center align-middle", className)}
      style={{ width: size, height: size, ...style }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="block overflow-visible transition-[color] duration-240 ease-standard motion-reduce:transition-none"
        style={{ color }}
      >
        {STROKES.map(index => (
          <Stroke
            key={index}
            index={index}
            pose={poses[index]}
            variant={variant}
            status={status}
            strokeWidth={strokeWidth}
            reduced={reduced}
            clock={clock}
            amp={amp}
            turn={turn}
            pop={pop}
          />
        ))}
      </svg>
      {decorative ? null : <span className="sr-only">{text}</span>}
    </span>
  )
}

export default MorphLoader
