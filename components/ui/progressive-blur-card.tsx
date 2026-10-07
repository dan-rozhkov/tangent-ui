"use client"

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import type {
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react"
import type { MotionValue, Transition, Variants } from "motion/react"
import { CheckIcon, StarIcon } from "@phosphor-icons/react"

import { useMotionTokens } from "@/lib/motion-tokens-context"
import { useReducedMotion } from "@/lib/reduced-motion"
import { cn } from "@/lib/utils"

type Bezier = [number, number, number, number]

/** Frosted fill shared by the badge and the connected button. Fixed white: it sits on photography, not on the page. */
const FROST = "bg-[oklch(1_0_0/0.2)] shadow-[inset_0_0_0_1px_oklch(1_0_0/0.22)]"
/** The blur half of the frost, only worth its cost on the front card. */
const FROST_BLUR = "backdrop-blur-md [-webkit-backdrop-filter:blur(12px)]"

/**
 * A blur that ramps from nothing to strong across one edge of its parent, with no visible seam. It stacks several
 * backdrop-filter layers whose blur doubles each step, each masked to a staggered band, so the eye reads one smooth
 * gradient of focus. Use it over imagery where text needs a calm place to sit: card footers, hero captions, sticky
 * headers over photos. Use a plain scrim when the content behind is flat color, since there is nothing to blur.
 * The parent must be positioned and clip its own overflow; the blur fills the parent, so size the parent to size the ramp.
 */
export interface ProgressiveBlurProps {
  /** Which edge gets the strongest blur. */
  side?: "bottom" | "top"
  /** Blur radius in px at the very edge. */
  strength?: number
  /** Stacked layers. More is smoother and costs more; 6 to 8 is enough. */
  layers?: number
  /** Fraction of the parent the ramp takes, from the clear edge. Past it the blur holds at full strength. */
  ramp?: number
  className?: string
}

export function ProgressiveBlur({
  side = "bottom",
  strength = 24,
  layers = 7,
  ramp = 1,
  className,
}: ProgressiveBlurProps) {
  const count = Math.max(2, Math.round(layers))
  const direction = side === "bottom" ? "to bottom" : "to top"
  const step = (100 / (count + 1)) * Math.min(1, Math.max(0.05, ramp))
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
    >
      {Array.from({ length: count }, (_, index) => {
        const blur = Math.max(0.25, strength / 2 ** (count - 1 - index))
        const from = index * step
        const stops =
          index === count - 1
            ? `transparent ${from}%, black ${from + step}%`
            : `transparent ${from}%, black ${from + step}%, black ${from + step * 2}%, transparent ${from + step * 3}%`
        const mask = `linear-gradient(${direction}, ${stops})`
        const filter = `blur(${blur.toFixed(2)}px)`
        return (
          <div
            key={index}
            className="absolute inset-0"
            style={{
              backdropFilter: filter,
              WebkitBackdropFilter: filter,
              maskImage: mask,
              WebkitMaskImage: mask,
            }}
          />
        )
      })}
    </div>
  )
}

export interface ProgressiveBlurCardStat {
  label: string
  value: string
}

/**
 * A portrait creator card: a full-bleed photo whose lower part dissolves into a progressive blur that carries the
 * creator's name, handle, and a connect button. Hover, keyboard focus, or a tap grows the blur upward and reveals a
 * short bio and stats. Use it for people or channel directories where the photo sells the profile and the details can wait.
 * Use a plain list row when people scan many profiles for text, since the photo and blur add weight.
 */
export interface ProgressiveBlurCardProps {
  image: { src: string; alt: string }
  name: string
  /** Small frosted label above the name, such as "Top creator". */
  badge?: ReactNode
  avatar: { src: string; alt?: string }
  handle: string
  /** Muted line under the handle, such as the creator's category. */
  caption: string
  /** Revealed when the card expands. */
  bio?: string
  /** Revealed with the bio. Two or three read best. */
  stats?: ProgressiveBlurCardStat[]
  connected?: boolean
  defaultConnected?: boolean
  onConnectedChange?: (connected: boolean) => void
  connectLabel?: string
  connectedLabel?: string
  /** Forces the card collapsed and out of the tab order, for cards waiting behind another. */
  inactive?: boolean
  /** Collapses the blur region while the card is dragged, so it moves as one clean slab. */
  dragging?: boolean
  className?: string
}

/** Share of the card the blur covers at rest and when open. */
const COLLAPSED = 34
const EXPANDED = 58
/** The ramp is as long as the resting blur, so opening only slides it up and extends the full-strength part below. */
const RAMP = COLLAPSED / EXPANDED
/** How far the always-expanded blur region sits down at rest, as a share of its own height. */
const REST_OFFSET = `${(((EXPANDED - COLLAPSED) / EXPANDED) * 100).toFixed(3)}%`

export function ProgressiveBlurCard({
  image,
  name,
  badge,
  avatar,
  handle,
  caption,
  bio,
  stats,
  connected: connectedProp,
  defaultConnected = false,
  onConnectedChange,
  connectLabel = "Connect",
  connectedLabel = "Connected",
  inactive = false,
  dragging = false,
  className,
}: ProgressiveBlurCardProps) {
  const tokens = useMotionTokens()
  const reduced = useReducedMotion()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [inner, setInner] = useState(defaultConnected)
  const connected = connectedProp ?? inner
  const lastPointer = useRef<string>("mouse")
  const cardRef = useRef<HTMLDivElement>(null)
  const handleId = useId()
  const expanded = !inactive && !dragging && (hovered || focused || pinned)
  const hasDetails = !!bio || !!stats?.length

  // Going to the back clears every way of being open, so coming forward later starts closed.
  const [wasInactive, setWasInactive] = useState(inactive)
  if (wasInactive !== inactive) {
    setWasInactive(inactive)
    if (inactive) {
      setHovered(false)
      setFocused(false)
      setPinned(false)
    }
  }

  // A tap-pinned card also closes on a press anywhere outside it; the listener lives only while pinned.
  useEffect(() => {
    if (!pinned) return
    const close = (event: PointerEvent) => {
      if (!cardRef.current?.contains(event.target as Node | null))
        setPinned(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [pinned])

  const toggleConnected = () => {
    const next = !connected
    if (connectedProp === undefined) setInner(next)
    onConnectedChange?.(next)
  }

  const grow: Transition = reduced
    ? { duration: 0 }
    : { ...tokens.spring.smooth }
  const spring: Transition = reduced
    ? { duration: 0 }
    : { ...tokens.spring.morph }

  const enterEase = useMemo(() => [...tokens.ease.enter] as Bezier, [tokens])

  /** The Connect and Connected labels blur and fade through the same motion. */
  const labelMotion = {
    initial: reduced
      ? { opacity: 0 }
      : { opacity: 0, filter: `blur(${tokens.blur.soft}px)` },
    animate: { opacity: 1, filter: "blur(0px)" },
    exit: { opacity: 0, transition: { duration: tokens.duration.instant } },
    transition: { duration: tokens.duration.fast, ease: enterEase },
  }

  const details: Variants = useMemo(
    () => ({
      closed: {
        opacity: 0,
        y: reduced ? 0 : 6,
        filter: reduced ? "blur(0px)" : `blur(${tokens.blur.soft}px)`,
        transition: { duration: tokens.duration.instant },
      },
      open: {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        transition: {
          duration: reduced ? tokens.duration.fast : tokens.duration.standard,
          ease: enterEase,
        },
      },
    }),
    [reduced, tokens, enterEase]
  )
  const group: Variants = useMemo(
    () => ({
      closed: {},
      open: {
        transition: {
          delayChildren: reduced ? 0 : 0.08,
          staggerChildren: reduced ? 0 : tokens.stagger.item * 2,
        },
      },
    }),
    [reduced, tokens]
  )

  const onPointerDown = (event: ReactPointerEvent) => {
    lastPointer.current = event.pointerType
  }

  return (
    <div
      ref={cardRef}
      data-pbc-card=""
      data-expanded={expanded || undefined}
      inert={inactive || undefined}
      onPointerDown={onPointerDown}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" && !inactive) setHovered(true)
      }}
      onPointerMove={(event) => {
        // A card brought forward under a still mouse never gets an enter, so the first move opens it.
        if (event.pointerType === "mouse" && !inactive && !hovered)
          setHovered(true)
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setHovered(false)
      }}
      onFocus={(event) => {
        if (
          event.target instanceof Element &&
          event.target.matches(":focus-visible")
        )
          setFocused(true)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setFocused(false)
      }}
      onClick={(event) => {
        if (lastPointer.current === "mouse" || !hasDetails) return
        if ((event.target as Element).closest("button")) return
        setPinned((value) => !value)
      }}
      className={cn(
        "relative isolate aspect-[3/4] w-full rounded-surface bg-surface-muted text-white shadow-floating",
        className
      )}
    >
      {/* clip-path makes this a backdrop root, so the blur layers never sample the page around the card and its corners stay clean. */}
      <div className="absolute inset-0 [clip-path:inset(0_round_var(--radius-surface))]">
        {/* The photo gets its own composited layer, so scaling it never re-rasters against the rounded clip. */}
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 will-change-transform"
          style={{ transformOrigin: "50% 30%" }}
          initial={false}
          animate={{ scale: expanded && !reduced ? 1.05 : 1 }}
          transition={grow}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.src}
            alt=""
            draggable={false}
            className="size-full object-cover"
          />
        </motion.div>
        <span className="sr-only">{image.alt}</span>

        {/* Top: a short blur and scrim so the badge and name stay legible over bright skies. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[34%]">
          <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0_0_0/0.34)] to-transparent" />
          {inactive ? null : (
            <ProgressiveBlur side="top" strength={10} layers={6} />
          )}
        </div>
        <div className="absolute inset-x-0 top-0 flex flex-col items-center gap-2 px-4 pt-4 text-center">
          {badge ? (
            <span
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-pill px-2.5 text-[0.6875rem] leading-none font-medium text-white",
                FROST,
                !inactive && FROST_BLUR
              )}
            >
              <StarIcon aria-hidden="true" className="size-3" />
              {badge}
            </span>
          ) : null}
          <p className="m-0 max-w-full truncate text-lg leading-tight font-medium text-white [text-shadow:0_1px_14px_oklch(0_0_0/0.4)]">
            {name}
          </p>
        </div>

        {/* Bottom: the blur region is always full height and slides up on the compositor to open; the footer is not inside it, so it stays put. */}
        <motion.div
          aria-hidden="true"
          data-pbc-region=""
          className="pointer-events-none absolute inset-x-0 bottom-0 will-change-transform"
          style={{ height: `${EXPANDED}%` }}
          initial={false}
          animate={{ y: expanded ? "0%" : REST_OFFSET }}
          transition={grow}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(to bottom, transparent 0%, oklch(0 0 0 / 0.1) ${(RAMP * 55).toFixed(1)}%, oklch(0 0 0 / 0.4) ${(RAMP * 100).toFixed(1)}%)`,
            }}
          />
          {/* Only the front card pays for the blur; cards behind keep the scrim. */}
          {inactive ? null : (
            <ProgressiveBlur
              side="bottom"
              strength={30}
              layers={8}
              ramp={RAMP}
            />
          )}
        </motion.div>

        <motion.div
          className={cn(
            "absolute inset-x-0 bottom-0 flex flex-col gap-3 px-3.5 pb-3.5 transition-opacity duration-[var(--duration-standard)]",
            inactive && "opacity-0"
          )}
          initial={false}
          animate={expanded ? "open" : "closed"}
          variants={group}
        >
          {hasDetails ? (
            <div
              className={cn(
                "flex flex-col gap-2.5",
                !expanded && "pointer-events-none select-none"
              )}
            >
              {bio ? (
                <motion.p
                  variants={details}
                  className="m-0 text-xs leading-[1.45] [text-wrap:pretty] text-[oklch(1_0_0/0.9)] [text-shadow:0_1px_8px_oklch(0_0_0/0.35)]"
                >
                  {bio}
                </motion.p>
              ) : null}
              {stats?.length ? (
                <motion.dl variants={details} className="m-0 flex gap-5">
                  {stats.map((stat) => (
                    <div key={stat.label} className="flex flex-col gap-0.5">
                      <dt className="text-[0.6875rem] leading-none text-[oklch(1_0_0/0.7)]">
                        {stat.label}
                      </dt>
                      <dd className="m-0 text-sm leading-none font-medium tabular-nums">
                        {stat.value}
                      </dd>
                    </div>
                  ))}
                </motion.dl>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatar.src}
              alt={avatar.alt ?? ""}
              draggable={false}
              className="size-[2.125rem] shrink-0 rounded-full object-cover ring-1 ring-[oklch(1_0_0/0.85)]"
            />
            <div className="min-w-0 flex-1">
              <p
                id={handleId}
                className="m-0 truncate text-[0.8125rem] leading-[1.3] font-medium text-white [text-shadow:0_1px_8px_oklch(0_0_0/0.35)]"
              >
                {handle}
              </p>
              <p className="m-0 truncate text-xs leading-[1.3] text-[oklch(1_0_0/0.78)] [text-shadow:0_1px_8px_oklch(0_0_0/0.35)]">
                {caption}
              </p>
            </div>
            <motion.button
              type="button"
              data-pbc-connect=""
              aria-describedby={handleId}
              layout
              transition={spring}
              onClick={toggleConnected}
              style={{ borderRadius: 9999 }}
              className={cn(
                "relative inline-flex h-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden px-3 text-xs leading-none font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-[var(--duration-fast)] ease-standard active:scale-[0.97]",
                connected
                  ? cn(FROST, !inactive && FROST_BLUR, "text-white")
                  : "bg-white text-[oklch(0.2_0_0)]"
              )}
            >
              <AnimatePresence initial={false} mode="popLayout">
                {connected ? (
                  <motion.span
                    key="connected"
                    className="inline-flex items-center gap-1"
                    {...labelMotion}
                  >
                    <motion.span
                      className="inline-flex"
                      initial={
                        reduced ? false : { x: -8, scale: 0.5, opacity: 0 }
                      }
                      animate={{ x: 0, scale: 1, opacity: 1 }}
                      transition={spring}
                    >
                      <CheckIcon aria-hidden="true" className="size-3.5" />
                    </motion.span>
                    {connectedLabel}
                  </motion.span>
                ) : (
                  <motion.span key="idle" {...labelMotion}>
                    {connectLabel}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export interface ProgressiveBlurCardStackItem extends ProgressiveBlurCardProps {
  id: string
}

/**
 * A diagonal cascade of progressive blur cards: the front card is live, the others peek out from behind it as a
 * stepped edge. Swipe or flick the front card either way and it flies off and slips to the back of the deck, so the
 * deck never runs out. Click a card behind it, or press the arrow keys, to bring it forward instead.
 * Use it to browse a handful of profiles in a small space. Use a grid when people need to compare many at once.
 * Shows up to five cards.
 */
export interface ProgressiveBlurCardStackProps {
  items: ProgressiveBlurCardStackItem[]
  /** Accessible name for the stack. */
  label?: string
  className?: string
}

/** Distance between cascade steps, in px, on both axes. */
const STEP = 20
const MAX = 5
const CARD_WIDTH_REM = 16
/** Degrees of rotation per pixel of horizontal travel. */
const ROTATE = 0.065
/** A release faster than this (px/s) throws the card even when it has only moved a little. */
const FLICK = 500
/** A release past this share of the card width throws it. */
const THROW_SHARE = 0.35
/** Movement under this many px is still a tap. */
const TAP_SLOP = 4
/** Vertical travel is not a choice, so past a small free zone it resists like a rubber band. */
const FREE_Y = 48
const STRETCH_Y = 140

const resistY = (raw: number) => {
  const distance = Math.abs(raw)
  return distance <= FREE_Y
    ? raw
    : Math.sign(raw) *
        (FREE_Y +
          (1 - 1 / (((distance - FREE_Y) * 0.55) / STRETCH_Y + 1)) * STRETCH_Y)
}
const unresistY = (shown: number) => {
  const distance = Math.abs(shown)
  if (distance <= FREE_Y) return shown
  const stretch = Math.min(distance - FREE_Y, STRETCH_Y - 1)
  return (
    Math.sign(shown) *
    (FREE_Y + ((1 / (1 - stretch / STRETCH_Y) - 1) * STRETCH_Y) / 0.55)
  )
}
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const dimFor = (slot: number) => Math.min(0.34, 0.14 + slot * 0.06)

interface Sample {
  t: number
  x: number
  y: number
}

function velocityOf(samples: Sample[], now: number) {
  const recent = samples.filter((sample) => now - sample.t <= 80)
  const first = recent[0]
  const last = recent[recent.length - 1]
  if (!first || !last || first === last || now - last.t > 60)
    return { x: 0, y: 0 }
  const seconds = Math.max(0.008, (last.t - first.t) / 1000)
  return {
    x: (last.x - first.x) / seconds,
    y: (last.y - first.y) / seconds,
  }
}

interface StackSlotProps {
  item: ProgressiveBlurCardStackItem
  slot: number
  count: number
  /** The card is flying out after a swipe: it stays live and above the others until it clears the stack. */
  out: boolean
  lifted: boolean
  nudged: boolean
  /** 0 to 1: how far the front card has been dragged, eased. Cards behind rise by it. */
  lift: MotionValue<number>
  /** The same value, unsmoothed, written while dragging. */
  rawLift: MotionValue<number>
  /** Returns whether the stack took the swipe; a card it refuses springs back. */
  onSwipe: (id: string, trusted: boolean) => boolean
  onCleared: (id: string) => void
  onLiftDone: (id: string) => void
  onBring: (id: string, trusted: boolean) => void
  onNudge: (id: string | null) => void
}

function StackSlot({
  item,
  slot,
  count,
  out,
  lifted,
  nudged,
  lift,
  rawLift,
  onSwipe,
  onCleared,
  onLiftDone,
  onBring,
  onNudge,
}: StackSlotProps) {
  const tokens = useMotionTokens()
  const reduced = useReducedMotion()
  const { id, ...card } = item
  const front = slot === 0
  const live = front || out
  const nudge = !live && nudged && !reduced ? 6 : 0

  // Where the slot sits, animated by hand so a reorder can start from where the card is seen, not where it was.
  const sx = useMotionValue(slot * STEP)
  const sy = useMotionValue(slot * STEP)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const tilt = useMotionValue(1)
  const opacity = useMotionValue(1)
  const shadow = useMotionValue(0)
  const rotate = useTransform([x, tilt], ([offset, sign]: number[]) =>
    reduced ? 0 : offset * ROTATE * sign
  )
  // Cards behind ease toward the slot in front of them as the front card is pulled away.
  const rise = useTransform(lift, (value) => -value * STEP)
  const dimBase = useMotionValue(live ? 0 : dimFor(slot))
  const nextDim = useMotionValue(slot <= 1 ? 0 : dimFor(slot - 1))
  const dimNow = useTransform(
    [dimBase, nextDim, lift],
    ([base, next, amount]: number[]) => base - (base - next) * amount
  )

  const [dragging, setDragging] = useState(false)
  const el = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    pointerId: number
    startX: number
    startY: number
    ox: number
    oy: number
    moved: boolean
    width: number
    /** Velocity of the card at the moment it was grabbed, so a tap during a spring-back can resume it. */
    vx: number
    vy: number
    samples: Sample[]
  } | null>(null)
  const suppressClick = useRef(false)
  const clearTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const flight = useRef<(() => void) | null>(null)
  const home = useRef<ReturnType<typeof animate>[]>([])
  const frontRef = useRef(front)
  const latest = useRef({ onCleared, onLiftDone })
  const prev = useRef({ slot, live })

  useLayoutEffect(() => {
    frontRef.current = front
    latest.current = { onCleared, onLiftDone }
  })

  // When the slot changes, fold what the card is currently showing (the rise and the dim) into the values that
  // animate on, so the stack's own lift reset can't make the card jump. Runs before the stack resets the lift.
  useLayoutEffect(() => {
    const was = prev.current
    prev.current = { slot, live }
    if (was.slot === slot) return
    const shown = was.live ? 0 : -lift.get() * STEP
    if (shown) {
      sx.set(sx.get() + shown)
      sy.set(sy.get() + shown)
    }
    dimBase.set(was.live ? dimBase.get() : dimNow.get())
  }, [slot, live, lift, sx, sy, dimBase, dimNow])

  useEffect(() => {
    const transition: Transition = lifted
      ? { duration: tokens.duration.fast, ease: [...tokens.ease.enter] as Bezier }
      : reduced
        ? { duration: 0.01 }
        : { ...tokens.spring.morph, bounce: 0.1 }
    const runs = [
      animate(sx, slot * STEP + (lifted ? 34 : 0) + nudge, {
        ...transition,
        onComplete: () => {
          if (lifted) latest.current.onLiftDone(id)
        },
      }),
      animate(sy, slot * STEP + (lifted ? -8 : 0) + nudge, transition),
    ]
    return () => runs.forEach((run) => run.stop())
  }, [slot, lifted, nudge, reduced, tokens, id, sx, sy])

  useEffect(() => {
    const target = live ? 0 : dimFor(slot)
    const run = animate(dimBase, target, {
      duration: reduced ? 0 : tokens.duration.standard,
    })
    nextDim.set(slot <= 1 ? 0 : dimFor(slot - 1))
    return () => run.stop()
  }, [live, slot, reduced, tokens, dimBase, nextDim])

  useEffect(
    () => () => {
      clearTimeout(clearTimer.current)
      home.current.forEach((run) => run.stop())
      flight.current?.()
    },
    []
  )

  // Only the front card's motion drives the shared lift.
  const syncLift = () => {
    if (reduced || !frontRef.current) return
    const width = el.current?.offsetWidth ?? 1
    rawLift.set(clamp(Math.hypot(x.get(), y.get() * 0.5) / (width * 0.55), 0, 1))
  }

  const settle = () => {
    setDragging(false)
    animate(shadow, 0, { duration: tokens.duration.fast })
  }

  const stopHome = () => {
    home.current.forEach((run) => run.stop())
    home.current = []
  }

  // Every way a card comes back to rest goes through here, so a stopped animation is always resumed or settled.
  const springHome = (vx: number, vy: number) => {
    stopHome()
    if (reduced) {
      x.jump(0)
      y.jump(0)
      if (frontRef.current) rawLift.set(0)
      settle()
      return
    }
    let pending = 2
    const finish = () => {
      if (--pending > 0) return
      home.current = []
      settle()
    }
    home.current = [
      animate(x, 0, {
        ...tokens.spring.morph,
        velocity: vx,
        onUpdate: syncLift,
        onComplete: finish,
      }),
      animate(y, 0, {
        ...tokens.spring.morph,
        velocity: vy,
        onUpdate: syncLift,
        onComplete: finish,
      }),
    ]
  }

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!front || out || event.button !== 0 || !event.isPrimary) return
    if (
      event.target instanceof Element &&
      event.target.closest("button, a, input, select, textarea, [role='button']")
    )
      return
    clearTimeout(clearTimer.current)
    suppressClick.current = false
    const vx = x.getVelocity()
    const vy = y.getVelocity()
    stopHome()
    x.stop()
    y.stop()
    if (Math.abs(x.get()) < 2) {
      // Grabbing the top half tips the card the way the hand moves; the bottom half tips it the other way.
      const rect = event.currentTarget.getBoundingClientRect()
      tilt.set(event.clientY < rect.top + rect.height / 2 ? 1 : -1)
    }
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      ox: event.clientX - x.get(),
      oy: event.clientY - unresistY(y.get()),
      moved: false,
      width: event.currentTarget.offsetWidth,
      vx,
      vy,
      samples: [{ t: event.timeStamp, x: event.clientX, y: event.clientY }],
    }
  }

  const release = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const state = drag.current
    if (!state || event.pointerId !== state.pointerId) return
    drag.current = null
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {}
    if (!state.moved) {
      // A tap. If it landed on a card still springing home, the grab stopped that spring, so resume it.
      if (Math.abs(x.get()) > 0.5 || Math.abs(y.get()) > 0.5)
        springHome(state.vx, state.vy)
      else settle()
      return
    }
    // The click that follows a drag must not reach Connect or the tap-to-expand.
    clearTimer.current = setTimeout(() => {
      suppressClick.current = false
    }, 80)
    const velocity = cancelled
      ? { x: 0, y: 0 }
      : velocityOf(state.samples, event.timeStamp)
    const offset = x.get()
    const direction = Math.sign(offset)
    const flick =
      Math.abs(velocity.x) > FLICK &&
      Math.sign(velocity.x) === direction &&
      Math.abs(offset) > 12
    const far =
      Math.abs(offset) > state.width * THROW_SHARE &&
      !(Math.sign(velocity.x) === -direction && Math.abs(velocity.x) > 300)
    if (
      !cancelled &&
      direction &&
      (flick || far) &&
      onSwipe(id, event.nativeEvent.isTrusted)
    ) {
      throwCard(direction, velocity, state.width)
      return
    }
    // Below the threshold, or when the stack refuses the swipe, the card springs home with the speed it has.
    springHome(cancelled ? 0 : x.getVelocity(), cancelled ? 0 : y.getVelocity())
  }

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || event.pointerId !== state.pointerId) return
    // The button was let go somewhere we never heard about: the press is over.
    if (event.buttons === 0) {
      release(event, true)
      return
    }
    if (!state.moved) {
      if (
        Math.hypot(event.clientX - state.startX, event.clientY - state.startY) <
        TAP_SLOP
      )
        return
      // Only now does this become a drag: capturing earlier would retarget a plain tap's click away from its button.
      state.moved = true
      suppressClick.current = true
      state.ox = event.clientX - x.get()
      state.oy = event.clientY - unresistY(y.get())
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {}
      setDragging(true)
      animate(shadow, 1, { duration: tokens.duration.fast })
    }
    x.set(event.clientX - state.ox)
    y.set(resistY(event.clientY - state.oy))
    syncLift()
    state.samples.push({ t: event.timeStamp, x: event.clientX, y: event.clientY })
    if (state.samples.length > 12) state.samples.shift()
  }

  const throwCard = (
    direction: number,
    velocity: { x: number; y: number },
    width: number
  ) => {
    if (reduced) {
      // No flight: the card fades out where it is and back in at the end of the deck.
      x.jump(0)
      y.jump(0)
      opacity.set(0)
      animate(opacity, 1, { duration: 0.15, ease: "linear" })
      onCleared(id)
      settle()
      return
    }
    const reach = width + (count - 1) * STEP + 60
    const exit = { type: "spring", visualDuration: 0.5, bounce: 0 } as const
    const fromY = y.get()
    const throwY = y.getVelocity()
    const outX = animate(x, direction * reach, { ...exit, velocity: velocity.x })
    const outY = animate(y, fromY + clamp(throwY * 0.1, -70, 70), {
      ...exit,
      velocity: throwY,
    })
    // Where x must reach for the card to be off the stack's footprint, worked out once rather than per frame.
    let clearAt = direction * reach
    const stack = el.current?.closest("[data-pbc-stack]")
    if (stack && el.current) {
      const box = el.current.getBoundingClientRect()
      const bounds = stack.getBoundingClientRect()
      const travel = Math.max(
        0,
        direction > 0 ? bounds.right - box.left : box.right - bounds.left
      )
      // The tilt grows with travel and swings the leading corner further out.
      const sine = (distance: number) =>
        Math.sin((Math.min(60, Math.abs(distance) * ROTATE) * Math.PI) / 180)
      const now = x.get()
      const margin = Math.max(
        0,
        (box.height / 2) * (sine(now + direction * travel) - sine(now))
      )
      clearAt = now + direction * (travel + margin)
    }
    let cleared = false
    let watch: () => void = () => {}
    const clear = () => {
      if (cleared) return
      cleared = true
      watch()
      flight.current = null
      outX.stop()
      outY.stop()
      // Off the stack's footprint: drop to the back, then slide home underneath the others.
      onCleared(id)
      animate(shadow, 0, { duration: tokens.duration.standard })
      springHome(x.getVelocity(), y.getVelocity())
    }
    flight.current = () => {
      // The slot went away mid-flight: stop, and let the stack forget the card.
      cleared = true
      watch()
      outX.stop()
      outY.stop()
      flight.current = null
      latest.current.onCleared(id)
    }
    watch = x.on("change", (value) => {
      if (direction > 0 ? value >= clearAt : value <= clearAt) clear()
    })
    outX.then(clear)
  }

  return (
    <motion.div
      data-pbc-slot={slot}
      className="absolute top-0 left-0 will-change-transform"
      style={{ width: "100%", x: sx, y: sy }}
      initial={false}
      animate={{
        scale: lifted ? 1.02 : 1,
        zIndex: out ? count + 2 : lifted ? count + 1 : count - slot,
      }}
      transition={{
        ...(lifted
          ? {
              duration: tokens.duration.fast,
              ease: [...tokens.ease.enter] as Bezier,
            }
          : reduced
            ? { duration: 0.01 }
            : { ...tokens.spring.morph, bounce: 0.1 }),
        zIndex: { duration: 0 },
      }}
    >
      <motion.div style={{ x: live ? 0 : rise, y: live ? 0 : rise }}>
        <motion.div
          ref={el}
          className={cn(
            "relative touch-pan-y select-none [-webkit-tap-highlight-color:transparent]",
            front && "pointer-fine:cursor-grab",
            dragging && "pointer-fine:cursor-grabbing"
          )}
          style={{ x, y, rotate, opacity }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={(event) => release(event, false)}
          onPointerCancel={(event) => release(event, true)}
          onLostPointerCapture={(event) => {
            // Touch capture held by a child is handed to the card on the first move; that bubbles here and is not a cancel.
            if (event.target === event.currentTarget) release(event, true)
          }}
          onClickCapture={(event) => {
            if (!suppressClick.current) return
            event.preventDefault()
            event.stopPropagation()
          }}
        >
          {/* Resting cards sit on the standard shadow; a card in the hand or in flight floats on a deeper one. */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-surface shadow-[0_28px_56px_-14px_oklch(0_0_0/0.4),0_10px_20px_-10px_oklch(0_0_0/0.28)]"
            style={{ opacity: shadow }}
          />
          <ProgressiveBlurCard
            {...card}
            inactive={!live}
            dragging={dragging}
          />
          {/* A live card (in hand or in flight) is never dimmed, whatever the lift. */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-surface bg-black"
            style={{ opacity: live ? dimBase : dimNow }}
          />
          {!live ? (
            <button
              type="button"
              data-pbc-back=""
              aria-label={`Bring ${card.name} to front`}
              onClick={(event) => onBring(id, event.nativeEvent.isTrusted)}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") onNudge(id)
              }}
              onPointerLeave={() => onNudge(null)}
              className={cn(
                "absolute inset-0 cursor-pointer rounded-surface",
                lifted && "pointer-events-none"
              )}
            />
          ) : null}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

export function ProgressiveBlurCardStack({
  items,
  label = "Creators",
  className,
}: ProgressiveBlurCardStackProps) {
  const reduced = useReducedMotion()
  const tokens = useMotionTokens()
  const hintId = useId()
  const shown = useMemo(() => items.slice(0, MAX), [items])
  const count = shown.length
  const offset = Math.max(0, count - 1) * STEP
  const [rawOrder, setOrder] = useState(() => shown.map((item) => item.id))
  const [leaving, setLeaving] = useState<string | null>(null)
  const [nudged, setNudged] = useState<string | null>(null)
  const [out, setOut] = useState<string[]>([])
  const [message, setMessage] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)
  const rawLift = useMotionValue(0)
  const lift = useSpring(rawLift, tokens.spring.smooth)

  // Keep the order in step if the items change: drop what is gone, append what is new.
  const order = useMemo(() => {
    const current = shown.map((item) => item.id)
    const kept = rawOrder.filter((id) => current.includes(id))
    return [...kept, ...current.filter((id) => !kept.includes(id))]
  }, [rawOrder, shown])

  // A lift whose card has left the items can never complete, so drop it.
  if (leaving !== null && !shown.some((item) => item.id === leaving))
    setLeaving(null)

  // The lift belongs to whoever was in front. When the front changes it resets, after the cards have folded
  // what they were showing into their own motion (children's layout effects run first).
  const frontId = order[0]
  useLayoutEffect(() => {
    rawLift.set(0)
    lift.jump(0)
  }, [frontId, rawLift, lift])

  // Only reorders the viewer caused are announced: autoplay's synthetic events are not trusted.
  const reorder = (next: string[], trusted: boolean, swiped = false) => {
    if (next[0] === order[0]) return
    // The old front card lifts out first; its lift animation clears this when it ends, so it follows the gallery speed.
    // A swiped card has already flown out, so it needs no lift.
    setLeaving(reduced || swiped ? null : order[0])
    setOrder(next)
    setNudged(null)
    const front = shown.find((item) => item.id === next[0])
    if (front && trusted)
      setMessage(
        `${front.name}, card ${shown.indexOf(front) + 1} of ${count}, is now in front.`
      )
    // Keep the keys working after a click, but never pull focus away from something else the viewer is using.
    const root = rootRef.current
    const active = document.activeElement
    if (root && (!active || active === document.body || root.contains(active)))
      root.focus({ preventScroll: true })
  }

  const cycle = () => order.slice(1).concat(order[0])

  const swipe = (id: string, trusted: boolean) => {
    if (id !== order[0] || order.length < 2) return false
    setOut((current) => [...current, id])
    reorder(cycle(), trusted, true)
    return true
  }

  const bringToFront = (id: string, trusted: boolean) =>
    reorder([id, ...order.filter((other) => other !== id)], trusted)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
    if ((event.target as Element).closest("[data-pbc-card]")) return
    event.preventDefault()
    if (order.length < 2) return
    // Both keys cycle the whole stack: right sends the front card to the back, left brings the back card forward.
    reorder(
      event.key === "ArrowRight"
        ? cycle()
        : [order[order.length - 1], ...order.slice(0, -1)],
      event.nativeEvent.isTrusted
    )
  }

  const byId = new Map(shown.map((item) => [item.id, item]))
  const wrapperWidth = `calc(${CARD_WIDTH_REM}rem + ${offset}px)`

  return (
    <div
      ref={rootRef}
      data-pbc-stack=""
      role="group"
      aria-label={label}
      aria-roledescription="card stack"
      aria-describedby={hintId}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={cn("relative w-full outline-none", className)}
      style={{ maxWidth: wrapperWidth }}
    >
      {/* Sizes the box: the front card's footprint plus the cascade offset. */}
      <div
        aria-hidden="true"
        style={{
          width: `calc(100% - ${offset}px)`,
          aspectRatio: "3 / 4",
          marginBottom: offset,
        }}
      />
      {/* Each slot is as wide as a card, not the whole box. */}
      <div
        className="absolute top-0 left-0"
        style={{ width: `calc(100% - ${offset}px)` }}
      >
        {order.map((id, slot) => {
          const item = byId.get(id)
          if (!item) return null
          return (
            <StackSlot
              key={id}
              item={item}
              slot={slot}
              count={count}
              out={out.includes(id)}
              lifted={leaving === id}
              nudged={nudged === id}
              lift={lift}
              rawLift={rawLift}
              onSwipe={swipe}
              onCleared={(cleared) =>
                setOut((current) => current.filter((other) => other !== cleared))
              }
              onLiftDone={(done) =>
                setLeaving((current) => (current === done ? null : current))
              }
              onBring={bringToFront}
              onNudge={(next) =>
                setNudged((current) =>
                  next === null ? (current === id ? null : current) : next
                )
              }
            />
          )
        })}
      </div>
      <p id={hintId} className="sr-only">
        Swipe or drag the front card left or right, or press the left and right
        arrow keys, to cycle through the cards. Activate a card behind it to
        bring it forward.
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  )
}
