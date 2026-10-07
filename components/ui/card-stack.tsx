"use client"

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react"
import type { MotionValue } from "motion/react"
import { Check, Undo, X } from "@mynaui/icons-react"
import { useMotionTokens } from "@/lib/motion-tokens-context"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export type CardDecision = "left" | "right"

/**
 * A deck of cards reviewed one at a time: drag or flick the top card left or right, or use the buttons and arrow keys.
 * Use it for quick, one-by-one triage where each item deserves a moment of attention: shortlisting destinations, candidates, or design options.
 * Use a list or table when people need to compare items side by side.
 */
export interface CardStackProps<T> {
  items: T[]
  getKey: (item: T) => string
  /** A short name for the card, used in its accessible label and announcements, such as "Lisbon". */
  getLabel: (item: T) => string
  renderCard: (item: T) => ReactNode
  onDecide?: (item: T, decision: CardDecision) => void
  onUndo?: (item: T, decision: CardDecision) => void
  onReset?: () => void
  /** Action names for each side, used on the buttons and the stamps that appear while dragging. */
  labels?: { left: string; right: string }
  /** Past tense of each action for announcements, such as "skipped" and "shortlisted". */
  outcomes?: { left: string; right: string }
  /** Accessible name for the stack. */
  label?: string
  /** Shown once every card has been decided. Receives a function that brings all cards back. */
  renderEmpty?: (reset: () => void) => ReactNode
  className?: string
}

type Point = { x: number; y: number }
type Exit = Point & { tilt: number }
type Return = Exit & { delay: number }

/* Each slot scales from its bottom edge, so the cards behind show a thin, even edge below the one in front. */
const slotClass = "pointer-events-none absolute top-0 right-0 left-0 h-(--card-height) origin-[50%_100%]"
/* Resting cards sit flat on their borders; a card in the hand or in flight floats and casts a shadow. */
const cardClass = [
  "pointer-events-auto absolute inset-0 touch-pan-y rounded-surface select-none [-webkit-tap-highlight-color:transparent] not-data-top:pointer-events-none data-top:cursor-grab data-dragging:cursor-grabbing",
  "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:opacity-0 before:shadow-floating before:content-[''] before:[transition:opacity_var(--duration-fast)_var(--ease-standard)] motion-reduce:before:transition-none",
  "data-dragging:before:opacity-100 data-flying:before:opacity-100",
  "[[data-stack-stage]:focus-visible_&[data-top]]:outline-2 [[data-stack-stage]:focus-visible_&[data-top]]:outline-offset-3 [[data-stack-stage]:focus-visible_&[data-top]]:outline-(--focus-ring)",
].join(" ")
/* Cards returning to the back of the stack carry no verdict. */
const stampClass =
  "pointer-events-none absolute top-4 inline-flex h-8 items-center gap-1.5 rounded-pill border border-border bg-surface-raised pr-3 pl-2.5 text-sm font-medium whitespace-nowrap text-foreground [[data-stack-card]:not([data-top]):not([data-flying])_&]:invisible"
const keepStampClass =
  "left-4 border-[color-mix(in_oklab,var(--success)_32%,var(--border))] bg-[color-mix(in_oklab,var(--success)_9%,var(--surface-raised))] [&_svg]:text-success"
const passStampClass = "right-4 [&_svg]:text-text-secondary"
const emptyClass = [
  "absolute top-0 right-0 left-0 grid h-(--card-height) place-content-center justify-items-center gap-3 rounded-surface border border-border bg-surface p-6 text-center",
  "[[data-stack-stage]:focus-visible_&]:outline-2 [[data-stack-stage]:focus-visible_&]:outline-offset-3 [[data-stack-stage]:focus-visible_&]:outline-(--focus-ring)",
].join(" ")
/* The approving action follows the selected accent. On the narrowest screens Undo keeps its icon and its accessible name, so all three controls stay on one row. */
const controlVariants = cva(
  [
    "inline-flex min-h-control-md cursor-pointer items-center justify-center gap-2 rounded-control border px-4 text-sm leading-body font-medium whitespace-nowrap [-webkit-tap-highlight-color:transparent] max-[26rem]:px-3 [&_svg]:flex-none",
    "[transition:background-color_var(--duration-fast)_var(--ease-standard),border-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard),opacity_var(--duration-fast)_var(--ease-standard)] motion-reduce:transition-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring) aria-disabled:cursor-default aria-disabled:opacity-42",
  ],
  {
    variants: {
      tone: {
        default:
          "border-border bg-surface text-foreground active:not-aria-disabled:bg-surface-muted pointer-fine:hover:not-aria-disabled:bg-surface-muted",
        primary:
          "border-accent bg-accent text-accent-foreground active:not-aria-disabled:border-accent-strong active:not-aria-disabled:bg-accent-strong pointer-fine:hover:not-aria-disabled:border-accent-strong pointer-fine:hover:not-aria-disabled:bg-accent-strong",
        quiet:
          "border-transparent bg-transparent text-text-secondary active:not-aria-disabled:bg-surface-muted max-[22.5rem]:w-control-md max-[22.5rem]:p-0 pointer-fine:hover:not-aria-disabled:bg-surface-muted pointer-fine:hover:not-aria-disabled:text-foreground",
      },
    },
    defaultVariants: { tone: "default" },
  }
)

/** Cards rendered in the stack. The last one waits invisibly one step behind and fades in as it rises. */
const VISIBLE = 4
/** How far each card behind peeks out below the one in front, and how much smaller it is. */
const PEEK = 12
const SHRINK = 0.05
/** How far the cards behind rise while the top card is dragged away, in stack steps. */
const LIFT = 0.4
/** Drag distance at which the cards behind have fully risen. */
const LIFT_DISTANCE = 160
/** Degrees of rotation per pixel of horizontal travel. */
const ROTATE = 0.065
/** A release faster than this (px/s) throws the card even when it has only moved a little. */
const FLICK = 500

/** Vertical travel is not a decision, so past a small free zone it resists like a rubber band. */
const FREE_Y = 48
const STRETCH_Y = 140

const noop = () => () => {}
const resistY = (raw: number) => {
  const distance = Math.abs(raw)
  return distance <= FREE_Y
    ? raw
    : Math.sign(raw) * (FREE_Y + (1 - 1 / (((distance - FREE_Y) * 0.55) / STRETCH_Y + 1)) * STRETCH_Y)
}
const unresistY = (shown: number) => {
  const distance = Math.abs(shown)
  if (distance <= FREE_Y) return shown
  const stretch = Math.min(distance - FREE_Y, STRETCH_Y - 1)
  return Math.sign(shown) * (FREE_Y + ((1 / (1 - stretch / STRETCH_Y) - 1) * STRETCH_Y) / 0.55)
}
const clampUnit = (value: number) => Math.min(1, Math.max(0, value))
const throwSpring = { type: "spring", visualDuration: 0.5, bounce: 0 } as const
const reducedFade = { duration: 0.15, ease: "linear" } as const

function velocityOf(samples: { t: number; x: number; y: number }[], now: number): Point {
  const recent = samples.filter((sample) => now - sample.t <= 80)
  const first = recent[0],
    last = recent[recent.length - 1]
  if (!first || !last || first === last || now - last.t > 60) return { x: 0, y: 0 }
  const seconds = (last.t - first.t) / 1000
  return { x: (last.x - first.x) / seconds, y: (last.y - first.y) / seconds }
}

interface CardProps {
  id: string
  depth: number
  decision: CardDecision | null
  returnFrom?: Return
  interactive: boolean
  zIndex: number
  label: string
  labels: { left: string; right: string }
  lift: MotionValue<number>
  reduced: boolean
  fling: (id: string) => Point | undefined
  onRelease: (id: string, offset: Point, velocity: Point, width: number) => boolean
  onThrown: (id: string, exit: Exit) => void
  onGone: (id: string) => void
  children: ReactNode
}

function StackCard({
  id,
  depth,
  decision,
  returnFrom,
  interactive,
  zIndex,
  label,
  labels,
  lift,
  reduced,
  fling,
  onRelease,
  onThrown,
  onGone,
  children,
}: CardProps) {
  const motionTokens = useMotionTokens()
  const fadeOut = {
    duration: 0.22,
    delay: 0.12,
    ease: [...motionTokens.ease.standard],
  } as const
  const cardRef = useRef<HTMLDivElement>(null)
  // A card brought back by undo starts where it left the screen; with reduced motion it simply fades in at home.
  const travel = returnFrom && !reduced ? returnFrom : undefined
  const x = useMotionValue(travel?.x ?? 0)
  const y = useMotionValue(travel?.y ?? 0)
  const tilt = useMotionValue(travel?.tilt ?? 1)
  const opacity = useMotionValue(returnFrom ? 0 : 1)
  const rotate = useTransform([x, tilt], ([offset, sign]: number[]) => offset * ROTATE * sign)
  // Depth springs toward its slot; while the top card is dragged away, the cards behind already start to rise.
  const depthTarget = useTransform(lift, (value) => depth - (depth > 0 ? value * LIFT : 0))
  const depthSpring = useSpring(depthTarget, motionTokens.spring.smooth)
  const shown = reduced ? depthTarget : depthSpring
  const scale = useTransform(shown, (value) => 1 - value * SHRINK)
  const lower = useTransform(shown, (value) => value * PEEK)
  const presence = useTransform(shown, [VISIBLE - 2, VISIBLE - 1], [1, 0])
  const shade = useTransform(shown, [0, 2], [0, 1])
  const keep = useTransform(x, [16, 96], [0, 1])
  const pass = useTransform(x, [-96, -16], [1, 0])
  const drag = useRef<{
    ox: number
    oy: number
    samples: { t: number; x: number; y: number }[]
  } | null>(null)
  const settled = useRef(!returnFrom)
  const wasDecided = useRef(false)
  // A card flying home from undo or start over leaves the stack alone: the cards behind make room in one motion instead of
  // pausing half-risen until it lands. Grabbing it mid-flight hands the stack back to the drag.
  const homing = useRef(false)

  // The top card reports how far it has travelled, so the stack behind responds to the drag and the throw.
  useEffect(() => {
    if (!interactive) return
    const update = () => {
      if (!homing.current) lift.set(clampUnit(Math.hypot(x.get(), y.get() * 0.5) / LIFT_DISTANCE))
    }
    const offX = x.on("change", update),
      offY = y.on("change", update)
    return () => {
      offX()
      offY()
    }
  }, [interactive, lift, x, y])

  useLayoutEffect(() => {
    if (decision) {
      // A key or button can decide the card mid-drag; the throw takes over from the finger.
      drag.current = null
      homing.current = false
      cardRef.current?.removeAttribute("data-dragging")
      wasDecided.current = true
      const direction = decision === "right" ? 1 : -1
      const width = cardRef.current?.offsetWidth ?? 320
      const cx = x.get(),
        cy = y.get()
      // Buttons and keys throw with a default flick; a drag keeps the finger's velocity.
      const velocity = fling(id) ?? { x: direction * 900, y: -120 }
      const speed = Math.hypot(velocity.x, velocity.y)
      // Leave along the flick when it heads the chosen way, otherwise along the drag, otherwise straight out.
      let ux = velocity.x,
        uy = velocity.y
      if (speed < 200 || Math.sign(ux) !== direction) {
        ux = Math.abs(cx) > 8 ? cx : direction
        uy = Math.abs(cx) > 8 ? cy * 0.5 : -0.12
      }
      const length = Math.hypot(ux, uy) || 1
      ux /= length
      uy /= length
      if (Math.abs(ux) < 0.45) {
        ux = direction * 0.45
        uy = Math.sign(uy || -1) * Math.sqrt(1 - 0.45 * 0.45)
      }
      // Far enough to clear a typical preview or card column; the fade finishes before the spring does.
      const reach = width * 1.6
      const exit = { x: cx + ux * reach, y: cy + uy * reach, tilt: tilt.get() }
      onThrown(id, exit)
      if (reduced) {
        animate(opacity, 0, { ...reducedFade, onComplete: () => onGone(id) })
        return
      }
      animate(x, exit.x, { ...throwSpring, velocity: velocity.x })
      animate(y, exit.y, { ...throwSpring, velocity: velocity.y })
      animate(opacity, 0, { ...fadeOut, onComplete: () => onGone(id) })
      return
    }
    // Undo, or a first mount from where the card left: come back from there, catching any flight in progress.
    if (!wasDecided.current && settled.current) return
    wasDecided.current = false
    settled.current = true
    const delay = returnFrom?.delay ?? 0
    if (reduced) {
      x.jump(0)
      y.jump(0)
      animate(opacity, 1, { ...reducedFade, delay })
      return
    }
    homing.current = true
    animate(x, 0, {
      ...motionTokens.spring.smooth,
      delay,
      onComplete: () => {
        homing.current = false
      },
    })
    animate(y, 0, { ...motionTokens.spring.smooth, delay })
    animate(opacity, 1, {
      duration: motionTokens.duration.fast,
      delay,
      ease: [...motionTokens.ease.enter],
    })
    // Only the decision drives this effect; the return position is read once at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision])

  function down(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive || event.button !== 0 || !event.isPrimary) return
    if (event.target instanceof Element && event.target.closest("button, a, input, select, textarea, [role='button']"))
      return
    x.stop()
    y.stop()
    homing.current = false
    // Grabbing the top half tips the card the way the hand moves; grabbing the bottom half tips it the other way.
    if (Math.abs(x.get()) < 2) {
      const rect = event.currentTarget.getBoundingClientRect()
      tilt.set(event.clientY < rect.top + rect.height / 2 ? 1 : -1)
    }
    drag.current = {
      ox: event.clientX - x.get(),
      oy: event.clientY - unresistY(y.get()),
      samples: [{ t: event.timeStamp, x: event.clientX, y: event.clientY }],
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.setAttribute("data-dragging", "")
  }
  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current
    if (!state || !interactive) return
    x.set(event.clientX - state.ox)
    y.set(resistY(event.clientY - state.oy))
    state.samples.push({
      t: event.timeStamp,
      x: event.clientX,
      y: event.clientY,
    })
    if (state.samples.length > 12) state.samples.shift()
  }
  function up(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current
    drag.current = null
    event.currentTarget.removeAttribute("data-dragging")
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    if (!state || !interactive) return
    const velocity = event.type === "pointercancel" ? { x: 0, y: 0 } : velocityOf(state.samples, event.timeStamp)
    if (onRelease(id, { x: x.get(), y: y.get() }, velocity, event.currentTarget.offsetWidth)) return
    // Below the threshold the card springs home, keeping the release velocity so it settles instead of stopping dead.
    if (reduced) {
      x.jump(0)
      y.jump(0)
      return
    }
    animate(x, 0, { ...motionTokens.spring.morph, velocity: velocity.x })
    animate(y, 0, { ...motionTokens.spring.morph, velocity: velocity.y })
  }

  const flying = decision !== null
  return (
    <motion.div
      className={slotClass}
      style={{ zIndex, scale, y: lower, opacity: presence }}
      aria-hidden={interactive ? undefined : true}
      inert={!interactive}
    >
      <motion.div
        ref={cardRef}
        className={cardClass}
        data-stack-card=""
        style={{ x, y, rotate, opacity }}
        data-top={interactive ? "" : undefined}
        data-flying={flying ? "" : undefined}
        role={interactive ? "group" : undefined}
        aria-label={interactive ? label : undefined}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <div className="relative h-full overflow-hidden rounded-[inherit] border border-border bg-surface text-foreground">
          {children}
          <motion.span
            className="pointer-events-none absolute inset-0 bg-[oklch(0%_0_0/.035)] dark:bg-[oklch(0%_0_0/.22)]"
            style={{ opacity: shade }}
            aria-hidden="true"
          />
        </div>
        <motion.span
          className={cn(stampClass, keepStampClass)}
          data-side="right"
          style={{ opacity: keep }}
          aria-hidden="true"
        >
          <Check size={16} strokeWidth={2} />
          {labels.right}
        </motion.span>
        <motion.span
          className={cn(stampClass, passStampClass)}
          data-side="left"
          style={{ opacity: pass }}
          aria-hidden="true"
        >
          <X size={16} strokeWidth={2} />
          {labels.left}
        </motion.span>
      </motion.div>
    </motion.div>
  )
}

function Control({
  children,
  onClick,
  disabled,
  reduced,
  tone,
}: {
  children: ReactNode
  onClick: () => void
  disabled: boolean
  reduced: boolean
  tone?: "primary" | "quiet"
}) {
  const motionTokens = useMotionTokens()
  // aria-disabled keeps focus on the button when the stack runs out, instead of dropping it to the page.
  return (
    <motion.button
      type="button"
      className={controlVariants({ tone })}
      data-tone={tone}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onClick()
      }}
      whileTap={{ scale: reduced || disabled ? 1 : 0.97 }}
      transition={motionTokens.spring.snappy}
    >
      {children}
    </motion.button>
  )
}

/** Renders a custom empty state; the reset handler travels as a prop so render never touches the stack's refs. */
function EmptySlot({ render, onReset }: { render: (reset: () => void) => ReactNode; onReset: () => void }) {
  return <>{render(onReset)}</>
}

export function CardStack<T>({
  items,
  getKey,
  getLabel,
  renderCard,
  onDecide,
  onUndo,
  onReset,
  labels = { left: "Pass", right: "Keep" },
  outcomes,
  label = "Cards",
  renderEmpty,
  className,
}: CardStackProps<T>) {
  const motionTokens = useMotionTokens()
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false
  )
  const reduced = !!useReducedMotion() && hydrated
  const hintId = useId()
  const [position, setPosition] = useState(0)
  const [history, setHistory] = useState<{ key: string; decision: CardDecision }[]>([])
  const [flying, setFlying] = useState<string[]>([])
  const [returning, setReturning] = useState<Record<string, Return>>({})
  const [message, setMessage] = useState("")
  const lift = useMotionValue(0)
  // Where each thrown card left the screen, so undo and start over can bring it back from there. Only those handlers read it,
  // so it lives in a ref: recording an exit must not re-render the stack in the very frame the throw starts.
  const exits = useRef<Record<string, Exit>>({})
  const flings = useRef(new Map<string, Point>())
  const top = items[position]
  const remaining = Math.max(0, items.length - position)

  function decide(decision: CardDecision) {
    if (!top) return
    const key = getKey(top)
    lift.set(0)
    setPosition(position + 1)
    setHistory([...history, { key, decision }])
    setFlying((current) => [...current, key])
    setReturning({})
    const left = remaining - 1
    setMessage(
      `${getLabel(top)}${outcomes ? ` ${outcomes[decision]}` : `: ${labels[decision]}`}. ${left ? `${left} left.` : "All cards reviewed."}`
    )
    onDecide?.(top, decision)
  }

  function undo() {
    const last = history[history.length - 1]
    const item = last && items.find((entry) => getKey(entry) === last.key)
    if (!last || !item) return
    const exit = exits.current[last.key]
    setPosition(position - 1)
    setHistory(history.slice(0, -1))
    setFlying((current) => current.filter((key) => key !== last.key))
    setReturning(exit ? { [last.key]: { ...exit, delay: 0 } } : {})
    setMessage(`${getLabel(item)} restored.`)
    onUndo?.(item, last.decision)
  }

  function reset() {
    if (!history.length) return
    // The deck deals itself back: the card that will sit deepest returns first, the top card last.
    const count = Math.min(VISIBLE, items.length)
    const back: Record<string, Return> = {}
    items.slice(0, count).forEach((item, index) => {
      const key = getKey(item),
        exit = exits.current[key]
      if (exit && index < position) back[key] = { ...exit, delay: (count - 1 - index) * 0.06 }
    })
    setPosition(0)
    setHistory([])
    setFlying([])
    setReturning(back)
    setMessage("All cards are back in the stack.")
    onReset?.()
  }

  function release(key: string, offset: Point, velocity: Point, width: number) {
    const direction = Math.sign(offset.x)
    if (!direction || !top || getKey(top) !== key) return false
    const flick = Math.abs(velocity.x) > FLICK && Math.sign(velocity.x) === direction && Math.abs(offset.x) > 12
    const far =
      Math.abs(offset.x) > Math.min(width * 0.35, 140) &&
      !(Math.sign(velocity.x) === -direction && Math.abs(velocity.x) > 300)
    if (!flick && !far) return false
    flings.current.set(key, velocity)
    decide(direction > 0 ? "right" : "left")
    return true
  }

  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault()
      decide(event.key === "ArrowRight" ? "right" : "left")
    } else if (event.key === "Backspace" || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z")) {
      event.preventDefault()
      undo()
    }
  }

  const decided = new Map(history.map((entry) => [entry.key, entry.decision]))
  const windowKeys = new Set(items.slice(position, position + VISIBLE).map(getKey))
  const rendered = items.filter((item) => windowKeys.has(getKey(item)) || flying.includes(getKey(item)))
  const empty = position >= items.length && flying.length === 0

  return (
    <div
      className={cn(
        "grid w-full justify-items-center gap-5 font-body tracking-body [--card-height:19rem] [--stack-peek:24px] max-[26rem]:gap-4 max-[26rem]:[--card-height:17.5rem]",
        className
      )}
    >
      {/* The stage reserves the top card plus the edges peeking out below it, so nothing reflows as cards come and go. */}
      <div
        className="relative isolate h-[calc(var(--card-height)+var(--stack-peek))] w-[min(100%,20rem)] outline-none"
        data-stack-stage=""
        role="group"
        aria-roledescription="card stack"
        aria-label={label}
        aria-describedby={hintId}
        tabIndex={0}
        onKeyDown={key}
      >
        {rendered.map((item) => {
          const id = getKey(item),
            index = items.indexOf(item),
            decision = decided.get(id) ?? null
          const depth = decision ? 0 : index - position
          return (
            <StackCard
              key={id}
              id={id}
              depth={depth}
              decision={decision}
              returnFrom={returning[id]}
              interactive={!decision && depth === 0}
              zIndex={decision ? 20 + flying.indexOf(id) : VISIBLE - depth}
              label={`${getLabel(item)}, ${index + 1} of ${items.length}`}
              labels={labels}
              lift={lift}
              reduced={reduced}
              fling={(cardKey) => {
                const velocity = flings.current.get(cardKey)
                flings.current.delete(cardKey)
                return velocity
              }}
              onRelease={release}
              onThrown={(cardKey, exit) => {
                exits.current[cardKey] = exit
              }}
              onGone={(cardKey) => setFlying((current) => current.filter((entry) => entry !== cardKey))}
            >
              {renderCard(item)}
            </StackCard>
          )
        })}
        <AnimatePresence initial={false}>
          {empty && (
            <motion.div
              key="empty"
              className={emptyClass}
              initial={
                reduced
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      y: 8,
                      filter: `blur(${motionTokens.blur.soft}px)`,
                    }
              }
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{
                opacity: 0,
                transition: { duration: motionTokens.duration.instant },
              }}
              transition={
                reduced
                  ? reducedFade
                  : {
                      duration: motionTokens.duration.standard,
                      ease: [...motionTokens.ease.enter],
                    }
              }
            >
              {renderEmpty ? (
                <EmptySlot render={renderEmpty} onReset={reset} />
              ) : (
                <>
                  <p className="m-0 text-base font-medium">All cards reviewed</p>
                  <button type="button" className={controlVariants()} onClick={reset}>
                    <Undo size={16} strokeWidth={1.75} aria-hidden="true" />
                    Start over
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex flex-wrap justify-center gap-2 max-[26rem]:flex-nowrap">
        <Control onClick={() => decide("left")} disabled={!top} reduced={reduced}>
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
          {labels.left}
        </Control>
        <Control onClick={undo} disabled={!history.length} reduced={reduced} tone="quiet">
          <Undo size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className="max-[22.5rem]:sr-only">Undo</span>
        </Control>
        <Control onClick={() => decide("right")} disabled={!top} reduced={reduced} tone="primary">
          <Check size={16} strokeWidth={1.75} aria-hidden="true" />
          {labels.right}
        </Control>
      </div>
      <p id={hintId} className="sr-only">
        Drag the top card, or use the left and right arrow keys to {labels.left.toLowerCase()} or{" "}
        {labels.right.toLowerCase()} it. Backspace undoes the last decision.
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  )
}

export default CardStack
