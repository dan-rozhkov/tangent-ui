"use client"

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { ComponentPropsWithoutRef, CSSProperties, KeyboardEvent, ReactNode } from "react"
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react"
import type { Transition, Variants } from "motion/react"
import { CaretDownIcon } from "@phosphor-icons/react"

import { useMotionTokens, type MotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface ExpandableCardProps
  extends Omit<
    ComponentPropsWithoutRef<"article">,
    | "title"
    | "children"
    | "onAnimationStart"
    | "onAnimationEnd"
    | "onAnimationIteration"
    | "onDrag"
    | "onDragStart"
    | "onDragEnd"
    | "onDragOver"
    | "onDragLeave"
    | "onDragEnter"
    | "onDragExit"
    | "onDrop"
  > {
  title: string
  description?: string
  children: ReactNode
  defaultExpanded?: boolean
  /** Collapsed width cap in px. The card is centered and never wider than its container. Fills the container when omitted. */
  width?: number
  /** Expanded width cap in px, so the card can grow sideways into more room. Defaults to `width`. */
  expandedWidth?: number
}

/**
 * One morph: the box grows in width and height on the same spring, which never overshoots, so close is the exact mirror of open.
 * Size is animated for real (not with a scale), so the text, border, and corner radius never stretch.
 */
/** On close the details fade out first, then the box starts to shrink; on open they fade in once the box has made room. */
const closeHold = 0.06
/** A close that reverses an open still in flight skips the hold, so the spring turns around with its velocity instead of stalling. */
const settleMargin = 50
const boxTransition = (morph: Transition, expanded: boolean, hold: boolean): Transition =>
  expanded || !hold ? morph : { ...morph, delay: closeHold }
const contentTransition = (motionTokens: MotionTokens, expanded: boolean): Transition =>
  expanded
    ? { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard], delay: 0.12 }
    : { duration: 0.1, ease: [...motionTokens.ease.standard] }
const still: Transition = { duration: 0 }

/** Changed words in the summary rise in; unchanged words hold still. */
const wordMotionFor = (motionTokens: MotionTokens): Variants => ({
  enter: { opacity: 0, y: ".35em", filter: `blur(${motionTokens.blur.soft}px)` },
  center: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] },
  },
  exit: {
    opacity: 0,
    y: "-.3em",
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
  },
})

function RollingText({ text, reduced }: { text: string; reduced: boolean }) {
  const motionTokens = useMotionTokens()
  const wordMotion = useMemo(() => wordMotionFor(motionTokens), [motionTokens])
  return (
    <span className="relative block">
      <span className="absolute size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]">{text}</span>
      <span aria-hidden="true">
        <AnimatePresence mode="popLayout" initial={false}>
          {text.split(/(\s+)/).map((word, index) => (
            <motion.span
              key={`${index}:${word}`}
              className="inline-block whitespace-pre"
              variants={wordMotion}
              initial={reduced ? false : "enter"}
              animate="center"
              exit={reduced ? undefined : "exit"}
            >
              {word}
            </motion.span>
          ))}
        </AnimatePresence>
      </span>
    </span>
  )
}

export function ExpandableCard({
  title,
  description,
  children,
  defaultExpanded = false,
  width,
  expandedWidth,
  className,
  style,
  onKeyDown,
  ...rest
}: ExpandableCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [hold, setHold] = useState(true)
  const lastToggle = useRef(0)
  // The room the card can use, measured from its centering track. Until it is known, CSS caps the width.
  const [room, setRoom] = useState<number | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const reduceMotion = useReducedMotion() ?? false
  const motionTokens = useMotionTokens()
  const morph: Transition = motionTokens.spring.smooth

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    const measure = () => setRoom(track.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => observer.disconnect()
  }, [])

  const openCap = expandedWidth ?? width
  const fit = (cap: number | undefined) => (room === null ? undefined : Math.min(room, cap ?? room))
  const boxWidth = fit(expanded ? openCap : width)
  // The details are laid out at their final width the whole time, so nothing reflows while the box changes size.
  const innerWidth = fit(openCap)

  // The width lives in a motion value: the first measurement lands without motion, later changes spring from the current width and velocity.
  const boxWidthValue = useMotionValue<number | string>("100%")
  const placed = useRef(false)
  const widthTransition = reduceMotion ? still : boxTransition(morph, expanded, hold)
  useLayoutEffect(() => {
    if (boxWidth === undefined) return
    if (!placed.current) {
      placed.current = true
      boxWidthValue.jump(boxWidth)
      return
    }
    const controls = animate(boxWidthValue, boxWidth, widthTransition)
    return () => controls.stop()
  }, [boxWidth, boxWidthValue]) // eslint-disable-line react-hooks/exhaustive-deps

  // Caps for the first paint, before the room is measured.
  const capVars = {
    "--expandable-card-width": width ? `${width}px` : undefined,
    "--expandable-card-expanded-width": openCap ? `${openCap}px` : undefined,
  } as CSSProperties

  const toggle = (next: boolean) => {
    const now = performance.now()
    // The box settles about one visual duration after a toggle, so the window follows the tuned spring (450ms by default).
    const settleTime = (motionTokens.spring.smooth.visualDuration ?? 0.4) * 1000 + settleMargin
    setHold(now - lastToggle.current > settleTime)
    lastToggle.current = now
    setExpanded(next)
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented || event.key !== "Escape" || !expanded) return
    event.preventDefault()
    toggle(false)
    triggerRef.current?.focus()
  }

  return (
    /* The track centers the card and measures the room it may grow into. */
    <div ref={trackRef} className="flex w-full min-w-0 justify-center">
      <motion.article
        {...rest}
        className={cn(
          "group/card w-full max-w-(--expandable-card-width,100%) overflow-hidden rounded-surface border border-border bg-surface shadow-resting",
          "data-[expanded=true]:max-w-(--expandable-card-expanded-width,var(--expandable-card-width,100%))",
          // Once measured, the width is animated in px, so the CSS cap steps aside and never clamps the morph.
          "data-measured:max-w-full",
          className,
        )}
        data-expanded={expanded}
        data-measured={room === null ? undefined : ""}
        style={{ ...style, ...capVars, width: boxWidthValue }}
        onKeyDown={handleKeyDown}
      >
        {/* The card clips the header to its corners, so the header's hover fill never changes shape while the card opens or closes. */}
        <button
          ref={triggerRef}
          type="button"
          className={cn(
            "group/trigger flex min-h-16 w-full cursor-pointer items-center justify-between gap-5 border-0 bg-transparent px-5 py-4 text-left text-foreground [-webkit-tap-highlight-color:transparent]",
            "[transition:background-color_var(--duration-fast)_var(--ease-standard)] motion-reduce:transition-none",
            "pointer-fine:hover:bg-surface-muted active:bg-surface-muted",
          )}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => toggle(!expanded)}
        >
          <span className="min-w-0">
            <strong className="block text-sm leading-body font-medium">{title}</strong>
            {description && (
              <span className="mt-1 block text-xs leading-body text-text-muted tabular-nums">
                <RollingText text={description} reduced={reduceMotion} />
              </span>
            )}
          </span>
          <motion.span
            className={cn(
              "inline-flex flex-none items-center justify-center text-text-muted [transition:color_var(--duration-fast)_var(--ease-standard)] motion-reduce:transition-none",
              "pointer-fine:group-hover/trigger:text-foreground group-data-[expanded=true]/card:text-foreground",
            )}
            initial={false}
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={reduceMotion ? still : boxTransition(morph, expanded, hold)}
          >
            <CaretDownIcon size={18} aria-hidden="true" />
          </motion.span>
        </button>
        {/* The panel stays mounted so a second click mid-animation reverses from where it is; inert keeps closed details out of reach.
            The divider is an inset line rather than a border, so a collapsed panel is truly zero height and nothing pops at the end of the close. */}
        <motion.div
          id={panelId}
          className="overflow-hidden bg-surface-muted text-sm leading-body text-text-secondary shadow-[inset_0_1px_0_var(--border)]"
          inert={!expanded}
          initial={false}
          animate={{ height: expanded ? "auto" : 0 }}
          transition={reduceMotion ? still : boxTransition(morph, expanded, hold)}
        >
          <motion.div
            className="max-w-none px-5 pt-4 pb-5"
            style={innerWidth === undefined ? undefined : { width: innerWidth - 2 }}
            initial={false}
            animate={{ opacity: expanded ? 1 : 0 }}
            transition={reduceMotion ? still : contentTransition(motionTokens, expanded)}
          >
            {children}
          </motion.div>
        </motion.div>
      </motion.article>
    </div>
  )
}

export default ExpandableCard
