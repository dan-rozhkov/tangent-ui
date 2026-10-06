"use client"

import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import type { FocusEvent, HTMLAttributes, PointerEvent, ReactElement, ReactNode } from "react"
import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card"
import { useRender } from "@base-ui/react/use-render"
import { AnimatePresence, animate, motion, useMotionValue, usePresence, useReducedMotion } from "motion/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

const OPEN_DELAY = 500
const CLOSE_DELAY = 140
/** Moving to another trigger within this window opens its card almost at once. */
const SKIP_WINDOW = 300
/** Even warm, a trigger waits this long, so a pointer crossing it on the way into an open card does not steal the card. */
const INTENT = 80
/** How far the card starts toward its trigger, in px. */
const TRAVEL = 4
const enter = [...motionTokens.ease.enter] as [number, number, number, number]
const standard = [...motionTokens.ease.standard] as [number, number, number, number]

type Snapshot = { id: string | null; instant: boolean }
const IDLE: Snapshot = { id: null, instant: false }
let snapshot = IDLE
let closedAt = -Infinity
const listeners = new Set<() => void>()
/** One hover card is open at a time on the page. While one is open, or just after it closes, the next one opens without waiting and only fades. */
const cards = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  get: () => snapshot,
  server: () => IDLE,
  warm: () => snapshot.id !== null || performance.now() - closedAt < SKIP_WINDOW,
  open(id: string) {
    if (snapshot.id === id) return
    snapshot = { id, instant: cards.warm() }
    listeners.forEach((listener) => listener())
  },
  close(id: string) {
    if (snapshot.id !== id) return
    snapshot = IDLE
    closedAt = performance.now()
    listeners.forEach((listener) => listener())
  },
}

/**
 * A rich preview of a person or link that opens after a short hover or keyboard focus, for mentions, avatars, and references where a click should stay free for navigation.
 * It waits half a second, opens almost at once when moving between triggers, stays open while the pointer travels into it, and closes fast on leave or Escape.
 * On touch, a tap toggles it. Keep the content read only; anything actionable belongs behind the trigger itself.
 */
export interface HoverCardProps {
  /** The trigger, such as a mention button or a link. It must accept a ref and be focusable. */
  children: ReactElement
  /** The preview. `HoverCardProfile` covers people; any read only content works. */
  content: ReactNode
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  /** Milliseconds of hover before the first card opens. */
  openDelay?: number
  /** Milliseconds of grace after the pointer leaves, so it can travel into the card. */
  closeDelay?: number
  className?: string
}

interface SurfaceProps extends Omit<HTMLAttributes<HTMLDivElement>, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"> {
  instant: boolean
  reduced: boolean
}

/* A floating layer, so it earns the floating shadow. Transforms pivot on the placed origin, the corner nearest the trigger. */
const cardClass = [
  "box-border w-[18.5rem] max-w-[min(18.5rem,var(--available-width,calc(100vw-24px)))] rounded-panel border border-border bg-surface-raised p-4",
  "font-body tracking-body text-foreground shadow-floating origin-(--transform-origin) outline-none",
].join(" ")

/** Grows from the trigger edge: scale from .96 around the placed origin and a 4px offset toward the trigger on one smooth spring, with its own fade.
 *  Both retarget from where they are if the pointer comes back mid-exit, so the card turns around instead of jumping. */
const Surface = forwardRef<HTMLDivElement, SurfaceProps>(function Surface({ instant, reduced, className, style, children, ...props }, forwardedRef) {
  const [isPresent, safeToRemove] = usePresence()
  const node = useRef<HTMLDivElement | null>(null)
  const progress = useMotionValue(0)
  const x = useMotionValue(0),
    y = useMotionValue(0),
    scale = useMotionValue(1),
    opacity = useMotionValue(0)
  // Decided when the card mounts: a card revived mid-exit keeps the path it came in on, even though the page is now warm.
  const [still] = useState(() => instant || reduced)
  const setRef = useCallback(
    (element: HTMLDivElement | null) => {
      node.current = element
      if (typeof forwardedRef === "function") forwardedRef(element)
      else if (forwardedRef) forwardedRef.current = element
    },
    [forwardedRef],
  )

  useEffect(() => {
    let cancelled = false
    // The side is read from the placed card every frame, so a card that flips above its trigger still grows from the trigger edge.
    const apply = (value: number) => {
      const side = node.current?.dataset.side
      const travel = still ? 0 : (1 - value) * TRAVEL
      x.set(side === "left" ? travel : side === "right" ? -travel : 0)
      y.set(side === "top" ? travel : side === "bottom" ? -travel : 0)
      scale.set(still ? 1 : 0.96 + 0.04 * value)
    }
    const unsubscribe = progress.on("change", apply)
    apply(progress.get())
    const controls = isPresent
      ? animate(progress, 1, still ? { duration: 0.14, ease: enter } : motionTokens.spring.smooth)
      : animate(progress, 0, { duration: 0.12, ease: standard })
    // The fade leads the grow on the way in and runs alongside it on the way out; it starts from the current opacity either way.
    const fade = isPresent
      ? animate(opacity, 1, { duration: reduced ? 0.15 : still ? 0.09 : 0.16, ease: enter })
      : animate(opacity, 0, { duration: reduced ? 0.1 : 0.12, ease: standard })
    // Motion drives these values from JavaScript, which Base UI cannot see. A no-op animation on the card times the exit,
    // so Base UI keeps the card shown until the fade ends instead of hiding it the moment it closes.
    const timer = isPresent
      ? undefined
      : node.current?.animate?.({ "--hover-card-exit": ["0", "1"] } as PropertyIndexedKeyframes, { duration: (reduced ? 0.1 : 0.12) * 1000 })
    if (!isPresent)
      fade.then(() => {
        if (!cancelled) safeToRemove?.()
      })
    return () => {
      cancelled = true
      unsubscribe()
      controls.stop()
      fade.stop()
      timer?.cancel()
    }
  }, [isPresent, still, reduced, progress, x, y, scale, opacity, safeToRemove])

  return (
    <motion.div {...props} ref={setRef} className={cn(cardClass, className)} style={{ ...style, x, y, scale, opacity }}>
      {children}
    </motion.div>
  )
})

export function HoverCard({
  children,
  content,
  side = "bottom",
  align = "start",
  openDelay = OPEN_DELAY,
  closeDelay = CLOSE_DELAY,
  className,
}: HoverCardProps) {
  const id = useId()
  const cardId = `${id}-card`
  const state = useSyncExternalStore(cards.subscribe, cards.get, cards.server)
  const open = state.id === id
  const reduced = useReducedMotion() ?? false
  const triggerRef = useRef<HTMLElement>(null)
  const timers = useRef({ open: 0, close: 0 })
  const inside = useRef({ trigger: false, card: false, focus: false })
  /** Set by Escape, so a pointer resting on the trigger does not reopen what was just dismissed. */
  const dismissed = useRef(false)
  const pointerType = useRef("")

  useEffect(() => {
    const pending = timers.current
    return () => {
      window.clearTimeout(pending.open)
      window.clearTimeout(pending.close)
      cards.close(id)
    }
  }, [id])

  const clearTimers = () => {
    window.clearTimeout(timers.current.open)
    window.clearTimeout(timers.current.close)
  }
  const show = () => {
    clearTimers()
    dismissed.current = false
    cards.open(id)
  }
  const hide = () => {
    clearTimers()
    cards.close(id)
  }
  const scheduleOpen = () => {
    window.clearTimeout(timers.current.close)
    if (dismissed.current || cards.get().id === id) return
    window.clearTimeout(timers.current.open)
    timers.current.open = window.setTimeout(() => cards.open(id), cards.warm() ? INTENT : openDelay)
  }
  const scheduleClose = () => {
    window.clearTimeout(timers.current.open)
    const { trigger, card, focus } = inside.current
    if (trigger || card || focus) return
    window.clearTimeout(timers.current.close)
    timers.current.close = window.setTimeout(() => cards.close(id), closeDelay)
  }
  const mouse = (event: PointerEvent) => event.pointerType !== "touch"

  // The child stays the trigger element: these handlers and attributes merge onto it, and its own handlers still run.
  const trigger = useRender({
    render: children,
    ref: triggerRef,
    props: {
      "aria-describedby": open ? cardId : undefined,
      "data-hover-card": open ? "open" : "closed",
      onPointerEnter: (event: PointerEvent) => {
        if (!mouse(event)) return
        inside.current.trigger = true
        scheduleOpen()
      },
      onPointerLeave: (event: PointerEvent) => {
        if (!mouse(event)) return
        inside.current.trigger = false
        dismissed.current = false
        scheduleClose()
      },
      onPointerDown: (event: PointerEvent) => {
        pointerType.current = event.pointerType
      },
      onClick: () => {
        // A tap toggles the card on touch; a click or Enter opens it without the wait.
        const isOpen = cards.get().id === id
        if (pointerType.current === "touch") {
          if (isOpen) hide()
          else show()
        } else if (!isOpen) show()
        pointerType.current = ""
      },
      onFocus: (event: FocusEvent<HTMLElement>) => {
        if (!event.currentTarget.matches(":focus-visible")) return
        inside.current.focus = true
        show()
      },
      onBlur: () => {
        inside.current.focus = false
        dismissed.current = false
        scheduleClose()
      },
    },
  })

  return (
    <PreviewCardPrimitive.Root
      open={open}
      onOpenChange={(next, details) => {
        if (next) return
        // A press on the trigger is handled by its own click handler, not read as a press outside the card.
        if (details.reason === "outside-press" && details.event.target instanceof Node && triggerRef.current?.contains(details.event.target)) {
          details.cancel()
          return
        }
        if (details.reason === "escape-key") dismissed.current = true
        hide()
      }}
    >
      {trigger}
      <AnimatePresence>
        {open && (
          <PreviewCardPrimitive.Portal keepMounted key="card">
            <PreviewCardPrimitive.Positioner
              className="z-60"
              anchor={triggerRef}
              side={side}
              align={align}
              sideOffset={8}
              collisionPadding={12}
            >
              <PreviewCardPrimitive.Popup
                id={cardId}
                role="tooltip"
                onPointerEnter={(event: PointerEvent) => {
                  if (!mouse(event)) return
                  inside.current.card = true
                  window.clearTimeout(timers.current.close)
                }}
                onPointerLeave={(event: PointerEvent) => {
                  if (!mouse(event)) return
                  inside.current.card = false
                  scheduleClose()
                }}
                render={<Surface instant={state.instant} reduced={reduced} className={className} />}
              >
                {content}
              </PreviewCardPrimitive.Popup>
            </PreviewCardPrimitive.Positioner>
          </PreviewCardPrimitive.Portal>
        )}
      </AnimatePresence>
    </PreviewCardPrimitive.Root>
  )
}

export interface HoverCardStat {
  label: string
  value: string | number
}

/** A person preview for `HoverCard`: portrait, name, role, a short bio, a couple of numbers, and a quiet footer line. Its rows settle in with a tiny stagger. */
export interface HoverCardProfileProps {
  name: string
  /** Role and team, such as "Product designer, Payments". */
  role?: string
  /** A portrait URL, or your own image element such as next/image. Initials show when it is missing. */
  avatar?: string | ReactNode
  bio?: string
  stats?: HoverCardStat[]
  /** A footer line, such as a location and local time. */
  meta?: ReactNode
}

function Portrait({ src }: { src: string }) {
  const image = useRef<HTMLImageElement>(null)
  // A cached portrait shows at once; one still downloading fades in from a soft blur.
  useLayoutEffect(() => {
    const node = image.current
    if (node && !node.complete) node.dataset.loading = ""
  }, [src])
  return (
    // eslint-disable-next-line @next/next/no-img-element -- registry components stay framework agnostic; pass next/image through `avatar` instead.
    <img
      ref={image}
      src={src}
      alt=""
      width={48}
      height={48}
      decoding="async"
      className={[
        "block size-full object-cover [transition:opacity_var(--duration-standard)_var(--ease-enter),filter_var(--duration-standard)_var(--ease-enter)]",
        "data-loading:opacity-0 data-loading:blur-[4px] data-loading:transition-none",
        "motion-reduce:transition-none motion-reduce:data-loading:filter-none",
      ].join(" ")}
      onLoad={(event) => {
        delete event.currentTarget.dataset.loading
      }}
    />
  )
}

const ellipsis = "overflow-hidden text-ellipsis whitespace-nowrap"

export function HoverCardProfile({ name, role, avatar, bio, stats = [], meta }: HoverCardProfileProps) {
  const reduced = useReducedMotion() ?? false
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
  const settle = (order: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 4 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: motionTokens.duration.standard, ease: enter, delay: 0.04 + order * motionTokens.stagger.item },
        }
  return (
    <div className="grid gap-3">
      <motion.div className="flex min-w-0 items-center gap-3" {...settle(0)}>
        <span
          className="relative grid size-12 flex-none place-items-center overflow-hidden rounded-pill border border-border bg-surface-muted text-sm font-medium text-foreground"
          aria-hidden="true"
        >
          {typeof avatar === "string" ? <Portrait src={avatar} /> : (avatar ?? <span>{initials}</span>)}
        </span>
        <span className="grid min-w-0">
          <span className={cn(ellipsis, "text-base leading-body font-medium text-foreground")}>{name}</span>
          {role && <span className={cn(ellipsis, "text-sm leading-body text-text-secondary")}>{role}</span>}
        </span>
      </motion.div>
      {bio && (
        <motion.p className="m-0 text-sm leading-body text-text-secondary" {...settle(1)}>
          {bio}
        </motion.p>
      )}
      {stats.length > 0 && (
        // Numbers lead and labels follow, while the markup keeps label then value for screen readers.
        <motion.dl className="m-0 flex flex-wrap gap-x-6 gap-y-2 border-t border-border-subtle pt-3" {...settle(2)}>
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse">
              <dt className="text-xs leading-body text-text-muted">{stat.label}</dt>
              <dd className="m-0 text-base leading-body font-medium text-foreground tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </motion.dl>
      )}
      {meta && (
        <motion.div className="flex items-center gap-1.5 text-xs leading-body text-text-muted [&_svg]:flex-none" {...settle(3)}>
          {meta}
        </motion.div>
      )}
    </div>
  )
}

export default HoverCard
