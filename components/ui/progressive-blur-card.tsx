"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react"
import { AnimatePresence, motion } from "motion/react"
import type { Transition, Variants } from "motion/react"
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
  const expanded = !inactive && (hovered || focused || pinned)
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
 * stepped edge. Click a card behind it, or press the arrow keys, to bring it forward; the cards swap places on springs.
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

export function ProgressiveBlurCardStack({
  items,
  label = "Creators",
  className,
}: ProgressiveBlurCardStackProps) {
  const tokens = useMotionTokens()
  const reduced = useReducedMotion()
  const shown = useMemo(() => items.slice(0, MAX), [items])
  const count = shown.length
  const offset = Math.max(0, count - 1) * STEP
  const [rawOrder, setOrder] = useState(() => shown.map((item) => item.id))
  const [leaving, setLeaving] = useState<string | null>(null)
  const [nudged, setNudged] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Keep the order in step if the items change: drop what is gone, append what is new.
  const order = useMemo(() => {
    const current = shown.map((item) => item.id)
    const kept = rawOrder.filter((id) => current.includes(id))
    return [...kept, ...current.filter((id) => !kept.includes(id))]
  }, [rawOrder, shown])

  // A lift whose card has left the items can never complete, so drop it.
  if (leaving !== null && !shown.some((item) => item.id === leaving))
    setLeaving(null)

  const reorder = (next: string[]) => {
    if (next[0] === order[0]) return
    // The old front card lifts out first; its lift animation clears this when it ends, so it follows the gallery speed.
    // Clear any stale lift first, in case the last animation was cut off.
    setLeaving(reduced ? null : order[0])
    setOrder(next)
    setNudged(null)
    // Keep the keys working after a click, but never pull focus away from something else the viewer is using.
    const root = rootRef.current
    const active = document.activeElement
    if (root && (!active || active === document.body || root.contains(active)))
      root.focus({ preventScroll: true })
  }

  const bringToFront = (id: string) =>
    reorder([id, ...order.filter((other) => other !== id)])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
    if ((event.target as Element).closest("[data-pbc-card]")) return
    event.preventDefault()
    if (order.length < 2) return
    // Both keys cycle the whole stack: right sends the front card to the back, left brings the back card forward.
    reorder(
      event.key === "ArrowRight"
        ? order.slice(1).concat(order[0])
        : [order[order.length - 1], ...order.slice(0, -1)]
    )
  }

  const move: Transition = reduced
    ? { duration: 0.01 }
    : { ...tokens.spring.morph, bounce: 0.1 }
  const byId = new Map(shown.map((item) => [item.id, item]))
  const wrapperWidth = `calc(${CARD_WIDTH_REM}rem + ${offset}px)`

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label}
      aria-roledescription="card stack"
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
      {order.map((id, slot) => {
        const item = byId.get(id)
        if (!item) return null
        const { id: itemId, ...card } = item
        const front = slot === 0
        const lifted = leaving === id
        const nudge = !front && nudged === id && !reduced ? 6 : 0
        const dim = Math.min(0.34, 0.14 + slot * 0.06)
        const style: CSSProperties = { width: `calc(100% - ${offset}px)` }
        return (
          <motion.div
            key={itemId}
            data-pbc-slot={slot}
            className="absolute top-0 left-0 will-change-transform"
            style={style}
            initial={false}
            animate={{
              x: slot * STEP + (lifted ? 34 : 0) + nudge,
              y: slot * STEP + (lifted ? -8 : 0) + nudge,
              scale: lifted ? 1.02 : 1,
              zIndex: lifted ? count + 1 : count - slot,
            }}
            transition={{
              ...(lifted
                ? {
                    duration: tokens.duration.fast,
                    ease: [...tokens.ease.enter] as Bezier,
                  }
                : move),
              zIndex: { duration: 0 },
            }}
            onAnimationComplete={() => {
              if (lifted)
                setLeaving((current) => (current === id ? null : current))
            }}
          >
            <ProgressiveBlurCard {...card} inactive={!front} />
            {!front ? (
              <>
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-surface bg-black"
                  initial={false}
                  animate={{ opacity: dim }}
                  transition={{ duration: tokens.duration.standard }}
                />
                <button
                  type="button"
                  data-pbc-back=""
                  aria-label={`Bring ${card.name} to front`}
                  onClick={() => bringToFront(itemId)}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") setNudged(itemId)
                  }}
                  onPointerLeave={() =>
                    setNudged((current) =>
                      current === itemId ? null : current
                    )
                  }
                  className={cn(
                    "absolute inset-0 cursor-pointer rounded-surface",
                    lifted && "pointer-events-none"
                  )}
                />
              </>
            ) : null}
          </motion.div>
        )
      })}
    </div>
  )
}
