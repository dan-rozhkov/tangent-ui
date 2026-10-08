"use client"

import { Dialog } from "@base-ui/react/dialog"
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import type { CSSProperties, HTMLAttributes, ReactNode } from "react"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import type { HTMLMotionProps, MotionProps, Transition, Variants } from "motion/react"
import { XIcon } from "@phosphor-icons/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface CardProps extends HTMLAttributes<HTMLElement> {
  title: string
  description?: string
  media?: ReactNode
  action?: ReactNode
  /** A small leading visual for the footer, such as the owner's avatar. */
  avatar?: ReactNode
  /** Who the card belongs to, such as the owner's name. */
  meta?: ReactNode
  /** A short status under the meta, such as "Updated 2 hours ago". Changed words rise in and are announced politely. */
  status?: string
  /** Content for a quick look. When set, the whole card opens and grows into a larger view; Escape or the close control morphs it back. */
  details?: ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

type Side = "card" | "panel"
type Geometry = { card?: number; panel?: number; measure?: number }
type Landing = { top: number; left: number; width: number; height: number }

const { blur, duration, ease, spring, stagger } = motionTokens
/** One critically damped spring carries the surface both ways, so it never overshoots and can reverse mid-flight. Closing is a touch quicker. */
const grow: Transition = { ...spring.smooth, visualDuration: 0.3 }
const settle: Transition = { ...spring.smooth, visualDuration: 0.26 }
const RETURN_MS = 300
const fade: Transition = { duration: duration.instant }
/** The photo drifts in slowly while the card is pointed at, and eases back a little faster. */
const ZOOM = 1.04
const zoomIn: Transition = { duration: duration.considered * 2, ease: [...ease.standard] }
const zoomOut: Transition = { duration: duration.considered, ease: [...ease.standard] }
/** Quick look extras arrive once the surface has mostly grown, so they never ride the stretch. */
const reveal: Transition = { delay: duration.instant, duration: duration.standard, ease: [...ease.enter] }
const closeIn: Transition = { delay: duration.instant, duration: duration.fast, ease: [...ease.enter] }

/** A new status replaces the whole line: the old one lifts away quickly while the new words rise in one after another. */
const lineMotion: Variants = {
  enter: {},
  center: {},
  exit: { opacity: 0, y: "-.3em", filter: `blur(${blur.subtle}px)`, transition: { duration: duration.fast, ease: [...ease.standard] } },
}
const wordMotion: Variants = {
  enter: { opacity: 0, y: ".3em", filter: `blur(${blur.soft}px)` },
  center: (order: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: duration.standard, ease: [...ease.enter], delay: order * stagger.word },
  }),
}

/* The line clips sideways only, so a status too long for its column ends in an ellipsis while its words still rise in unclipped. */
function Status({ text, reduced }: { text: string; reduced: boolean }) {
  return (
    <span className="relative overflow-x-clip overflow-y-visible whitespace-nowrap text-text-muted tabular-nums" role="status">
      <span className="sr-only">{text}</span>
      <span className="relative block" aria-hidden="true">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={text}
            className="block overflow-x-clip overflow-y-visible text-ellipsis"
            variants={lineMotion}
            initial={reduced ? false : "enter"}
            animate="center"
            exit={reduced ? undefined : "exit"}
          >
            {text.split(/(\s+)/).map((part, index) => (
              <motion.span key={index} className="inline-block whitespace-pre" custom={index / 2} variants={wordMotion}>
                {part}
              </motion.span>
            ))}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  )
}

/** Motion only scale-corrects pixel radii, so token radii are read back in pixels for the morph. */
function px(node: Element, value: string) {
  const amount = parseFloat(value)
  if (!Number.isFinite(amount)) return undefined
  return value.trim().endsWith("rem")
    ? amount * parseFloat(getComputedStyle(node.ownerDocument.documentElement).fontSize)
    : amount
}

/* Fit-content width keeps the title's box the shape of its text, so it scales evenly when it grows into the quick look. */
const titleClass = "m-0 w-fit max-w-full font-medium tracking-body leading-[1.3] text-balance"
const descriptionClass = "mt-2 mb-0 text-(length:--text-sm) leading-body text-pretty text-text-secondary"

export function Card({
  title,
  description,
  media,
  action,
  avatar,
  meta,
  status,
  details,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
  className,
  style,
  ...props
}: CardProps) {
  const reduced = useReducedMotion() ?? false
  const group = useId()
  const cardRef = useRef<HTMLElement>(null)
  const descriptionRef = useRef<HTMLParagraphElement>(null)
  const [uncontrolled, setUncontrolled] = useState(defaultOpen)
  const [hovered, setHovered] = useState(false)
  const [geometry, setGeometry] = useState<Geometry>({})
  /** Where the quick look lands when it closes: the card's box on screen. The panel travels there above the page, then hands back to the card. */
  const [landing, setLanding] = useState<Landing | null>(null)
  const open = details ? (openProp ?? uncontrolled) : false
  const morph = Boolean(details) && !reduced
  const returning = !open && landing !== null
  const hasDescription = Boolean(description)
  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setUncontrolled(next)
      onOpenChange?.(next)
    },
    [openProp, onOpenChange],
  )

  // The quick look keeps the card's line length, so the description never rewraps while it travels.
  useEffect(() => {
    const node = cardRef.current,
      text = descriptionRef.current
    if (!morph || !node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      const computed = getComputedStyle(node)
      const radius = px(node, computed.borderTopLeftRadius),
        surface = px(node, computed.getPropertyValue("--radius-surface")),
        measure = text?.offsetWidth || undefined
      setGeometry(current =>
        current.card !== undefined && current.measure === measure
          ? current
          : { card: current.card ?? radius, panel: current.panel ?? surface, measure },
      )
    })
    observer.observe(node)
    if (text) observer.observe(text)
    return () => observer.disconnect()
  }, [morph, hasDescription])

  // Closing keeps the quick look mounted and sends it back to the card's box, so the surface never drops behind the page or a clipped preview.
  const wasOpen = useRef(open)
  useLayoutEffect(() => {
    const closed = wasOpen.current && !open
    wasOpen.current = open
    const node = cardRef.current
    if (open) setLanding(null) // eslint-disable-line react-hooks/set-state-in-effect -- reopening mid-return cancels the landing
    else if (closed && morph && node) {
      const box = node.getBoundingClientRect()
      setLanding({ top: box.top, left: box.left, width: box.width, height: box.height })
    }
  }, [open, morph])
  // Once the surface has visually landed, the card takes over. Any last sub-pixel of travel carries on in the card itself, so the handoff has no seam.
  useEffect(() => {
    if (!returning) return
    const timer = window.setTimeout(() => setLanding(null), RETURN_MS)
    return () => window.clearTimeout(timer)
  }, [returning])

  /** The same pieces live in the card and in the quick look; a shared id lets each one travel between them.
      Crossfade is off: the arriving piece takes over at full opacity and the other hides, so one solid surface moves instead of two translucent copies. */
  const shared = (id: string, side: Side, layout: true | "position" = true): MotionProps =>
    morph
      ? {
          layoutId: id,
          layout,
          layoutCrossfade: false,
          layoutDependency: side === "card" ? open : returning ? "return" : "panel",
          transition: { layout: side === "card" ? settle : grow },
        }
      : {}

  const footer = (side: Side) =>
    avatar || meta || status || action ? (
      <div className="mt-5 flex items-center justify-between gap-3">
        {avatar || meta || status ? (
          <motion.div className="flex min-w-0 flex-auto items-center gap-3" {...shared("byline", side, "position")}>
            {avatar ? (
              <span className="grid size-8 flex-none overflow-hidden rounded-pill bg-surface-muted *:size-full *:object-cover">
                {avatar}
              </span>
            ) : null}
            {/* A shrinkable column, so a narrow footer truncates the byline instead of sliding it under the action. */}
            <span className="grid min-w-0 grid-cols-[minmax(0,1fr)] text-(length:--text-xs) leading-body">
              {meta ? <span className="overflow-hidden font-medium text-ellipsis whitespace-nowrap text-foreground">{meta}</span> : null}
              {status ? <Status text={status} reduced={reduced} /> : null}
            </span>
          </motion.div>
        ) : null}
        {action ? (
          <motion.div className="relative z-1 flex flex-none flex-wrap gap-3" {...shared("action", side, "position")}>
            {action}
          </motion.div>
        ) : null}
      </div>
    ) : null

  /* Isolation keeps the rounded clip on the media while the card lifts on its own layer (Safari drops it otherwise).
     Motion drives the lift and the quick look morph, so transform never gets a CSS transition here.
     A pointed-at card floats a little, so the shadow arrives with the lift. Touch and pen never lift. */
  const card = (
    <motion.article
      {...(props as HTMLMotionProps<"article">)}
      ref={cardRef}
      className={cn(
        "relative isolate min-w-0 overflow-hidden rounded-panel border border-border bg-surface text-foreground",
        "[transition:border-color_var(--duration-fast)_var(--ease-standard),box-shadow_var(--duration-standard)_var(--ease-standard)] motion-reduce:duration-120",
        "data-hover:border-border-strong data-hover:shadow-raised has-[[data-card-trigger]:focus-visible]:border-border-strong",
        className,
      )}
      style={{ ...style, borderRadius: geometry.card ?? style?.borderRadius }}
      data-hover={hovered || undefined}
      whileHover={reduced ? undefined : { y: -2 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      {...shared("card", "card")}
      transition={{ default: spring.snappy, layout: settle }}
    >
      {media ? (
        <motion.div className="relative overflow-hidden bg-surface-muted" {...shared("media", "card")}>
          <motion.div
            className="grid min-h-28 place-items-center"
            initial={false}
            animate={{ scale: hovered && !reduced ? ZOOM : 1 }}
            transition={hovered ? zoomIn : zoomOut}
          >
            {media}
          </motion.div>
        </motion.div>
      ) : null}
      <div className="p-5">
        <motion.h3 className={cn("text-(length:--text-lg)", titleClass)} {...shared("title", "card")}>
          {details ? (
            // The title's hit area stretches over the whole card, so pointing anywhere opens the quick look while the action stays on top.
            <Dialog.Trigger
              data-card-trigger=""
              className={cn(
                "cursor-pointer border-0 bg-transparent p-0 [font:inherit] tracking-[inherit] text-inherit [text-align:inherit] [-webkit-tap-highlight-color:transparent]",
                "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none",
              )}
            >
              {title}
            </Dialog.Trigger>
          ) : (
            title
          )}
        </motion.h3>
        {description ? (
          <motion.p ref={descriptionRef} className={cn(descriptionClass, "max-w-[34ch]")} {...shared("description", "card", "position")}>
            {description}
          </motion.p>
        ) : null}
        {children}
        {footer("card")}
      </div>
    </motion.article>
  )

  if (!details) return card

  // The quick look grows out of the card: the surface, photo, and copy travel on one spring while the details settle in beneath them.
  // Base UI parts stay mounted (keepMounted, hidden={false}) while presence plays the exit, so motion decides when they leave.
  return (
    <Dialog.Root open={open} onOpenChange={next => setOpen(next)}>
      <LayoutGroup id={group}>
        {card}
        <AnimatePresence>
          {(open || returning) && (
            <Dialog.Portal key="quick-look" keepMounted>
              <AnimatePresence>
                {open && (
                  <Dialog.Backdrop
                    key="overlay"
                    hidden={false}
                    className="fixed inset-0 z-50 bg-shade/46 backdrop-blur-[7px]"
                    render={
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: reduced ? fade : { duration: duration.exit, ease: [...ease.standard] } }}
                        transition={reduced ? fade : { duration: duration.standard, ease: [...ease.enter] }}
                      />
                    }
                  />
                )}
              </AnimatePresence>
              {/* Centered with auto margins, so transform stays free for the morph.
                  Closing: the panel takes the card's box and look, so it lands exactly where the card sits and hands back without a seam. */}
              <Dialog.Popup
                hidden={false}
                className={cn(
                  "group/panel fixed inset-0 z-51 m-auto h-fit max-h-[calc(100dvh_-_var(--space-8))] w-[min(calc(100vw_-_var(--space-8)),30rem)] overflow-x-hidden overflow-y-auto overscroll-contain",
                  "rounded-surface border border-border bg-surface-raised text-foreground shadow-floating focus:outline-none",
                  "transition-[background-color,box-shadow] duration-240 ease-standard",
                  "data-returning:pointer-events-none data-returning:inset-auto data-returning:top-(--landing-top) data-returning:left-(--landing-left) data-returning:m-0",
                  "data-returning:h-(--landing-height) data-returning:max-h-none data-returning:w-(--landing-width) data-returning:overflow-hidden",
                  "data-returning:border-border data-returning:bg-surface data-returning:shadow-none",
                )}
                render={
                  <motion.div
                    data-framer-portal-id={group}
                    data-returning={returning || undefined}
                    layoutScroll
                    style={
                      {
                        borderRadius: geometry.panel,
                        "--card-measure": geometry.measure ? `${geometry.measure}px` : undefined,
                        ...(landing && returning
                          ? {
                              "--landing-top": `${landing.top}px`,
                              "--landing-left": `${landing.left}px`,
                              "--landing-width": `${landing.width}px`,
                              "--landing-height": `${landing.height}px`,
                            }
                          : {}),
                      } as CSSProperties
                    }
                    {...(morph
                      ? {
                          ...shared("card", "panel"),
                          initial: false,
                          animate:
                            geometry.card !== undefined && geometry.panel !== undefined
                              ? { borderRadius: returning ? geometry.card : geometry.panel }
                              : undefined,
                          transition: { layout: returning ? settle : grow, borderRadius: returning ? settle : grow },
                          exit: { opacity: 0, transition: { duration: 0 } },
                        }
                      : {
                          initial: { opacity: 0 },
                          animate: { opacity: 1 },
                          exit: { opacity: 0, transition: fade },
                          transition: fade,
                        })}
                  />
                }
              >
                {media ? (
                  <motion.div className="relative overflow-hidden bg-surface-muted" {...shared("media", "panel")}>
                    <motion.div
                      className="grid min-h-28 place-items-center"
                      initial={{ scale: hovered && !reduced ? ZOOM : 1 }}
                      animate={{ scale: 1 }}
                      transition={grow}
                    >
                      {media}
                    </motion.div>
                  </motion.div>
                ) : null}
                {/* The slot carries the entrance, so the button's own press answers instantly. */}
                <motion.span
                  className="absolute top-4 right-4 z-2 grid"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                  animate={returning ? { opacity: 0, scale: 0.9 } : { opacity: 1, scale: 1 }}
                  transition={returning ? fade : reduced ? fade : closeIn}
                >
                  <Dialog.Close
                    className={cn(
                      "grid size-8 cursor-pointer place-items-center rounded-pill border border-[color-mix(in_oklab,var(--border)_70%,transparent)] p-0",
                      "bg-[color-mix(in_oklab,var(--surface-raised)_74%,transparent)] text-foreground backdrop-blur-[12px] [-webkit-tap-highlight-color:transparent]",
                      "transition-[background-color] duration-160 ease-standard motion-reduce:duration-120 pointer-fine:hover:bg-surface-raised",
                    )}
                    aria-label="Close quick look"
                    render={<motion.button type="button" whileTap={reduced ? undefined : { scale: 0.94 }} transition={spring.snappy} />}
                  >
                    <XIcon size={16} aria-hidden="true" />
                  </Dialog.Close>
                </motion.span>
                <div className="p-6 group-data-returning/panel:p-5">
                  <Dialog.Title
                    className={cn("text-(length:--text-xl)", titleClass, "group-data-returning/panel:text-(length:--text-lg)")}
                    render={<motion.h2 {...shared("title", "panel")} />}
                  >
                    {title}
                  </Dialog.Title>
                  {description ? (
                    <Dialog.Description
                      className={cn(descriptionClass, "max-w-[var(--card-measure,34ch)]")}
                      render={<motion.p {...shared("description", "panel", "position")} />}
                    >
                      {description}
                    </Dialog.Description>
                  ) : null}
                  {children}
                  {footer("panel")}
                  <motion.div
                    className="mt-6 border-t border-border pt-5 text-(length:--text-sm) leading-body text-text-secondary"
                    initial={reduced ? false : { opacity: 0, y: 6 }}
                    animate={returning ? { opacity: 0, y: 0 } : { opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: fade }}
                    transition={returning || reduced ? fade : reveal}
                  >
                    {details}
                  </motion.div>
                </div>
              </Dialog.Popup>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </Dialog.Root>
  )
}

export default Card
