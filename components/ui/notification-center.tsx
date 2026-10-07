"use client"

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  type AnimationPlaybackControls,
  type HTMLMotionProps,
  type TargetAndTransition,
  type Transition,
  type Variants,
} from "motion/react"
import { Bell, Check, CheckCircle, DangerTriangle, Message, Record, X } from "@mynaui/icons-react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { Avatar } from "@/components/ui/avatar"
import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface NotificationItem {
  id: string
  title: string
  description?: string
  time: string
  read?: boolean
  tone?: "info" | "success" | "warning"
  /** A local portrait asset for person-generated updates. */
  actor?: { name: string; photo: string }
}

export interface NotificationCenterProps {
  notifications: NotificationItem[]
  label?: string
  onReadChange?: (notification: NotificationItem, read: boolean) => void
  onDismiss?: (notification: NotificationItem) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  avoidCollisions?: boolean
}

type View = "all" | "unread"

const enter: Transition = { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }
const exitFast: Transition = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }
const instant: Transition = { duration: 0 }
const textIn: TargetAndTransition = { opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.soft}px)` }
const textOut: TargetAndTransition = { opacity: 0, y: "-0.3em", filter: `blur(${motionTokens.blur.subtle}px)`, transition: exitFast }
const iconIn: TargetAndTransition = { opacity: 0, scale: 0.6, filter: `blur(${motionTokens.blur.subtle}px)` }
const shown: TargetAndTransition = { opacity: 1, y: "0em", scale: 1, filter: "blur(0px)" }
const fadeOut: TargetAndTransition = { opacity: 0, transition: { duration: motionTokens.duration.instant } }
/** Bulk actions cascade down the list, capped so the whole sweep stays under a quarter second. */
const cascade = (index: number) => Math.min(index * motionTokens.stagger.item, 0.2)

/* Quick press, spring release: the resting transition carries the spring back, the pressed state swaps in a short one. */
const springPress =
  "active:duration-120 active:ease-standard motion-reduce:duration-0 motion-reduce:active:scale-100"

/* The panel grows out of the bell: it starts a few pixels toward the trigger on whichever side it was placed, and leaves faster than it arrives.
   Transitions on Base UI's starting and ending styles stand in for the original open and close keyframes. */
const panelClass = cn(
  "z-90 flex w-[min(424px,calc(100vw-24px))] max-h-[min(590px,calc(100vh-24px))] flex-col overflow-hidden rounded-panel border border-border bg-surface-raised font-body tracking-body text-foreground shadow-floating outline-none",
  "origin-(--transform-origin) [--panel-x:0px] [--panel-y:-6px] data-[side='top']:[--panel-y:6px]",
  "data-[side='left']:[--panel-x:6px] data-[side='left']:[--panel-y:0px] data-[side='right']:[--panel-x:-6px] data-[side='right']:[--panel-y:0px]",
  "[transition:opacity_var(--duration-standard)_var(--ease-enter),transform_var(--duration-standard)_var(--ease-enter)]",
  "data-starting-style:opacity-0 data-starting-style:[transform:translate(var(--panel-x),var(--panel-y))_scale(.97)]",
  "data-ending-style:opacity-0 data-ending-style:[transform:translate(calc(var(--panel-x)/2),calc(var(--panel-y)/2))_scale(.98)]",
  "data-ending-style:[transition:opacity_var(--duration-instant)_var(--ease-standard),transform_var(--duration-instant)_var(--ease-standard)]",
  "motion-reduce:[transition:none]!",
)

/** Outgoing copies are hidden from assistive tech while they fade, so live text reads only the current value. */
function Swap(props: HTMLMotionProps<"span">) {
  const present = useIsPresent()
  return <motion.span {...props} aria-hidden={present ? props["aria-hidden"] : true} />
}

function SwapText({ children, reduce }: { children: string; reduce: boolean | null }) {
  return (
    <span className="relative inline-block max-w-full align-top">
      <AnimatePresence mode="popLayout" initial={false}>
        <Swap
          key={children}
          className="block"
          initial={reduce ? { opacity: 0 } : textIn}
          animate={shown}
          exit={reduce ? fadeOut : textOut}
          transition={reduce ? instant : enter}
        >
          {children}
        </Swap>
      </AnimatePresence>
    </span>
  )
}

const rollVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    y: direction >= 0 ? "0.7em" : "-0.7em",
    filter: `blur(${motionTokens.blur.subtle}px)`,
  }),
  center: { opacity: 1, y: "0em", filter: "blur(0px)" },
  exit: (direction: number) => ({
    opacity: 0,
    y: direction >= 0 ? "-0.7em" : "0.7em",
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: exitFast,
  }),
}

/** Counts roll like an odometer: a higher number rises from below, a lower one drops from above. */
function RollingCount({ value, display = String(value), reduce }: { value: number; display?: string; reduce: boolean | null }) {
  const [previous, setPrevious] = useState(value)
  const [direction, setDirection] = useState(0)
  if (value !== previous) {
    setDirection(value > previous ? 1 : -1)
    setPrevious(value)
  }
  return (
    <span className="relative inline-grid align-top">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <Swap
          key={display}
          className="block"
          custom={direction}
          variants={reduce ? undefined : rollVariants}
          initial={reduce ? { opacity: 0 } : "enter"}
          animate={reduce ? { opacity: 1 } : "center"}
          exit={reduce ? fadeOut : "exit"}
          transition={reduce ? instant : { y: motionTokens.spring.snappy, opacity: exitFast, filter: exitFast }}
        >
          {display}
        </Swap>
      </AnimatePresence>
    </span>
  )
}

/** Follows the width of its content. After `morphKey` changes the width springs from the old size to the new one, then returns to auto, so a longer label grows the control instead of snapping it. */
function MorphWidth({ reduce, morphKey, children }: { reduce: boolean | null; morphKey: string; children: ReactNode }) {
  const frame = useRef<HTMLSpanElement>(null)
  const content = useRef<HTMLSpanElement>(null)
  const width = useMotionValue<number | "auto">("auto")
  const changedAt = useRef(0)
  useLayoutEffect(() => {
    changedAt.current = performance.now()
  }, [morphKey])
  useEffect(() => {
    const node = content.current
    if (!node || typeof ResizeObserver === "undefined") return
    let last: number | undefined
    let controls: AnimationPlaybackControls | undefined
    const settle = () => {
      width.jump("auto")
      if (frame.current) frame.current.style.width = "auto"
    }
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.borderBoxSize?.[0]?.inlineSize ?? node.offsetWidth
      const current = width.get()
      const from = typeof current === "number" ? current : last
      last = next
      controls?.stop()
      if (reduce || from === undefined || from === next || performance.now() - changedAt.current > 120) return settle()
      // Pin the old width before this frame paints, then spring to the new one.
      if (frame.current) frame.current.style.width = `${from}px`
      controls = animate(width, [from, next], { ...motionTokens.spring.morph, onComplete: settle })
    })
    observer.observe(node)
    return () => {
      observer.disconnect()
      controls?.stop()
    }
  }, [width, reduce])
  return (
    <motion.span ref={frame} className="inline-flex items-center" style={{ width }}>
      <span ref={content} className="relative inline-flex w-max items-center gap-[5px]">
        {children}
      </span>
    </motion.span>
  )
}

function NotificationVisual({ item }: { item: NotificationItem }) {
  if (item.actor) return <Avatar name={item.actor.name} src={item.actor.photo} size="md" />
  return (
    <span
      className={cn(
        "grid size-9 flex-none place-items-center",
        item.tone === "success" ? "text-success" : item.tone === "warning" ? "text-warning" : "text-accent",
      )}
      aria-hidden="true"
    >
      {item.tone === "warning" ? (
        <DangerTriangle size={18} strokeWidth={1.7} />
      ) : item.tone === "success" ? (
        <CheckCircle size={18} strokeWidth={1.7} />
      ) : (
        <Message size={18} strokeWidth={1.7} />
      )}
    </span>
  )
}

export function NotificationCenter({
  notifications: initial,
  label = "Notifications",
  onReadChange,
  onDismiss,
  open,
  onOpenChange,
  avoidCollisions = true,
}: NotificationCenterProps) {
  const reduce = useReducedMotion()
  const layoutId = useId()
  const [internalOpen, setInternalOpen] = useState(false)
  const [items, setItems] = useState(initial)
  const [view, setView] = useState<View>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [bulk, setBulk] = useState(false)
  const itemRefs = useRef(new Map<string, HTMLButtonElement>())
  const allTabRef = useRef<HTMLButtonElement>(null)
  const unreadTabRef = useRef<HTMLButtonElement>(null)
  const isOpen = open ?? internalOpen
  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items])
  const readCount = items.length - unreadCount
  const visible = view === "unread" ? items.filter((item) => !item.read) : items
  const summary = unreadCount ? `${unreadCount} update${unreadCount === 1 ? "" : "s"} waiting for you` : "You’re all caught up"

  function setOpen(next: boolean) {
    if (open === undefined) setInternalOpen(next)
    onOpenChange?.(next)
  }

  function toggleRead(item: NotificationItem) {
    const next = !item.read
    if (next && view === "unread") {
      const index = visible.findIndex((entry) => entry.id === item.id)
      const nextId = visible[index + 1]?.id ?? visible[index - 1]?.id
      requestAnimationFrame(() => (nextId ? itemRefs.current.get(nextId)?.focus() : unreadTabRef.current?.focus()))
    }
    setBulk(false)
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, read: next } : entry)))
    if (next && view === "unread") setExpandedId(null)
    onReadChange?.(item, next)
  }

  function markAllRead() {
    items.filter((item) => !item.read).forEach((item) => onReadChange?.(item, true))
    setBulk(true)
    setItems((current) => current.map((item) => ({ ...item, read: true })))
    setExpandedId(null)
    requestAnimationFrame(() => (view === "unread" ? unreadTabRef : allTabRef).current?.focus())
  }

  function dismiss(item: NotificationItem) {
    const index = visible.findIndex((entry) => entry.id === item.id)
    const nextId = visible[index + 1]?.id ?? visible[index - 1]?.id
    requestAnimationFrame(() => (nextId ? itemRefs.current.get(nextId)?.focus() : unreadTabRef.current?.focus()))
    setBulk(false)
    setItems((current) => current.filter((entry) => entry.id !== item.id))
    if (expandedId === item.id) setExpandedId(null)
    onDismiss?.(item)
  }

  function clearRead() {
    items.filter((item) => item.read).forEach((item) => onDismiss?.(item))
    setBulk(true)
    setItems((current) => current.filter((item) => !item.read))
    requestAnimationFrame(() => allTabRef.current?.focus())
  }

  const height: Transition = reduce ? instant : { height: motionTokens.spring.smooth, opacity: enter }

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={(next) => setOpen(next)}>
      {/* The trigger anchors the panel, so it gives press feedback with color only; scaling it would shift the panel. */}
      <PopoverPrimitive.Trigger
        className={cn(
          "relative grid size-[42px] cursor-pointer place-items-center rounded-[12px] border border-border bg-surface text-foreground",
          "transition-[border-color,background] duration-160 ease-standard motion-reduce:duration-0",
          "data-popup-open:border-border-strong data-popup-open:bg-surface-muted active:border-border-strong active:bg-surface-muted pointer-fine:hover:border-border-strong pointer-fine:hover:bg-surface-muted",
        )}
        aria-label={`${label}${unreadCount ? `, ${unreadCount} unread` : ""}`}
      >
        <motion.span
          className="grid place-items-center"
          animate={{ rotate: isOpen && !reduce ? -12 : 0 }}
          transition={reduce ? instant : motionTokens.spring.snappy}
        >
          <Bell size={19} strokeWidth={1.75} aria-hidden="true" />
        </motion.span>
        <AnimatePresence initial={false}>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center overflow-hidden rounded-pill border-2 border-surface bg-foreground px-[5px] text-(length:--text-xs) leading-none font-medium text-background tabular-nums"
              aria-hidden="true"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? fadeOut : { opacity: 0, scale: 0.6, transition: exitFast }}
              transition={reduce ? instant : motionTokens.spring.snappy}
            >
              <RollingCount value={unreadCount} display={unreadCount > 9 ? "9+" : String(unreadCount)} reduce={reduce} />
            </motion.span>
          )}
        </AnimatePresence>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          className="z-90"
          align="center"
          side="bottom"
          sideOffset={12}
          collisionPadding={12}
          collisionAvoidance={avoidCollisions ? undefined : { side: "none", align: "none", fallbackAxisSide: "none" }}
        >
          <PopoverPrimitive.Popup className={panelClass} aria-label={label}>
            <div className="flex items-start justify-between gap-3 px-6 pt-[23px] pb-[18px] max-[380px]:px-4 max-[380px]:pt-5 max-[380px]:pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="m-0 text-(length:--text-xl) leading-[1.2] font-medium tracking-body max-[380px]:text-(length:--text-lg)">{label}</h2>
                  <span className="grid h-[21px] min-w-[21px] place-items-center overflow-hidden rounded-[7px] bg-surface-muted px-[5px] text-(length:--text-xs) leading-none text-text-secondary tabular-nums">
                    <RollingCount value={unreadCount} reduce={reduce} />
                  </span>
                </div>
                <p className="relative m-0 mt-1 text-(length:--text-xs) leading-body text-text-secondary" aria-live="polite">
                  <SwapText reduce={reduce}>{summary}</SwapText>
                </p>
              </div>
              <PopoverPrimitive.Close
                className={cn(
                  "grid size-[30px] flex-none cursor-pointer place-items-center rounded-[8px] border-0 bg-transparent text-text-muted",
                  "[transition:scale_var(--duration-spring)_var(--ease-spring),color_var(--duration-fast)_var(--ease-standard),background_var(--duration-fast)_var(--ease-standard)]",
                  "active:scale-96 pointer-fine:hover:bg-surface-muted pointer-fine:hover:text-foreground",
                  springPress,
                )}
                aria-label="Close notifications"
              >
                <X size={17} strokeWidth={1.75} aria-hidden="true" />
              </PopoverPrimitive.Close>
            </div>

            <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-border-subtle pr-[17px] pb-[13px] pl-5 max-[380px]:items-start max-[380px]:px-3 max-[380px]:pb-3">
              <div className="inline-flex items-center gap-[3px]" role="group" aria-label="Show notifications">
                {(["all", "unread"] as const).map((next) => (
                  <button
                    key={next}
                    ref={next === "unread" ? unreadTabRef : allTabRef}
                    type="button"
                    className={cn(
                      "relative isolate h-[31px] min-w-[61px] cursor-pointer rounded-[9px] border-0 bg-transparent px-2.5 text-(length:--text-xs) text-text-secondary transition-[color] duration-160 ease-standard pointer-fine:hover:text-foreground motion-reduce:duration-0",
                      view === next && "text-foreground",
                    )}
                    aria-pressed={view === next}
                    onClick={() => {
                      setBulk(false)
                      setView(next)
                      setExpandedId(null)
                    }}
                  >
                    {view === next && (
                      <motion.span
                        className="absolute inset-0 -z-1 rounded-[9px] bg-surface-muted"
                        layoutId={`${layoutId}-view`}
                        transition={reduce ? instant : motionTokens.spring.morph}
                      />
                    )}
                    <span className="relative z-1">{next === "all" ? "All" : "Unread"}</span>
                  </button>
                ))}
              </div>
              <AnimatePresence initial={false}>
                {unreadCount > 0 && (
                  <motion.button
                    key="mark-all"
                    type="button"
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent py-1.5 text-(length:--text-xs) whitespace-nowrap text-text-secondary",
                      "[transition:scale_var(--duration-spring)_var(--ease-spring),color_var(--duration-fast)_var(--ease-standard)]",
                      "active:scale-97 pointer-fine:hover:text-foreground max-[380px]:[&_span]:hidden",
                      springPress,
                    )}
                    onClick={markAllRead}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)` }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    exit={reduce ? fadeOut : { opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)`, transition: exitFast }}
                    transition={reduce ? instant : enter}
                  >
                    <Check size={15} strokeWidth={1.75} aria-hidden="true" />
                    <span>Mark all read</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Rows collapse their own height on the way out, so the list and the panel close the gap together. */}
            <div
              className="min-h-0 overflow-y-auto overscroll-contain px-[11px] pt-[9px] pb-2.5 [scrollbar-width:none] max-[380px]:px-[5px] max-[380px]:py-2 [&::-webkit-scrollbar]:hidden"
              role="list"
              aria-label={view === "all" ? "All notifications" : "Unread notifications"}
            >
              <AnimatePresence initial={false} custom={bulk}>
                {visible.map((item, index) => {
                  const expanded = expandedId === item.id
                  return (
                    <motion.div
                      key={item.id}
                      role="listitem"
                      className="overflow-hidden"
                      custom={bulk}
                      variants={{
                        exit: (isBulk: boolean) =>
                          reduce
                            ? fadeOut
                            : {
                                height: 0,
                                opacity: 0,
                                transition: {
                                  height: { ...motionTokens.spring.smooth, delay: isBulk ? cascade(index) : 0 },
                                  opacity: { ...exitFast, delay: isBulk ? cascade(index) : 0 },
                                },
                              },
                      }}
                      initial={reduce ? { opacity: 0 } : { height: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit="exit"
                      transition={height}
                    >
                      {/* Rows settle in with a short cascade when the panel opens or a view adds them. */}
                      <article
                        className={cn(
                          "relative rounded-[calc(var(--radius-panel)-12px)] p-2.5 pointer-fine:hover:bg-surface-muted max-[380px]:px-[7px]",
                          "[transition:background_var(--duration-fast)_var(--ease-standard),opacity_var(--duration-standard)_var(--ease-enter)_calc(var(--index,0)*35ms),translate_var(--duration-standard)_var(--ease-enter)_calc(var(--index,0)*35ms)]",
                          "starting:opacity-0 starting:[translate:0_4px] motion-reduce:[transition:none]",
                          expanded && "bg-surface-muted",
                        )}
                        style={{ "--index": Math.min(index, 7) } as CSSProperties}
                      >
                        <div className="flex min-w-0 items-start gap-[11px] max-[380px]:gap-[7px]">
                          <NotificationVisual item={item} />
                          <button
                            ref={(node) => {
                              if (node) itemRefs.current.set(item.id, node)
                              else itemRefs.current.delete(item.id)
                            }}
                            type="button"
                            className="grid min-w-0 flex-1 cursor-pointer gap-1 border-0 bg-transparent p-0 pt-0.5 text-left text-foreground"
                            aria-expanded={expanded}
                            aria-label={`${item.title}${item.read ? "" : ", unread"}. ${expanded ? "Hide details" : "Show details"}`}
                            onClick={() => setExpandedId((current) => (current === item.id ? null : item.id))}
                          >
                            <span className="flex min-h-5 min-w-0 items-center gap-1.5">
                              <strong className={cn("truncate text-(length:--text-sm) leading-[1.4] font-medium", item.read && "text-text-secondary")}>
                                {item.title}
                              </strong>
                              <AnimatePresence initial={false} custom={bulk}>
                                {!item.read && (
                                  <motion.span
                                    key="dot"
                                    className="block size-1.5 flex-none rounded-full bg-foreground"
                                    aria-hidden="true"
                                    custom={bulk}
                                    variants={{
                                      exit: (isBulk: boolean) =>
                                        reduce
                                          ? fadeOut
                                          : { opacity: 0, scale: 0.3, transition: { ...exitFast, delay: isBulk ? cascade(index) : 0 } },
                                    }}
                                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.3 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit="exit"
                                    transition={reduce ? instant : motionTokens.spring.snappy}
                                  />
                                )}
                              </AnimatePresence>
                            </span>
                            <span className="truncate text-(length:--text-xs) leading-body text-text-secondary">
                              {item.description ?? (item.actor ? `From ${item.actor.name}` : "View update details")}
                            </span>
                          </button>
                          <time className="flex-none pt-1 text-(length:--text-xs) leading-body whitespace-nowrap text-text-muted tabular-nums">
                            {item.time}
                          </time>
                        </div>
                        <AnimatePresence initial={false}>
                          {expanded && (
                            <motion.div
                              className="overflow-hidden pl-[47px] max-[380px]:pl-[43px]"
                              initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={
                                reduce
                                  ? fadeOut
                                  : { height: 0, opacity: 0, transition: { height: motionTokens.spring.smooth, opacity: exitFast } }
                              }
                              transition={height}
                            >
                              <p className="my-3 text-(length:--text-xs) leading-body text-text-secondary">
                                {item.description ??
                                  (item.actor ? `${item.actor.name} shared an update with you.` : "This update is ready to review.")}
                              </p>
                              <div
                                className={cn(
                                  "flex flex-wrap gap-1.5 pb-[5px] max-[380px]:gap-[5px]",
                                  "*:inline-flex *:h-[30px] *:cursor-pointer *:items-center *:gap-[5px] *:overflow-clip *:rounded-[10px] *:border *:border-border *:bg-transparent *:px-2.5 *:text-(length:--text-xs) *:leading-none *:whitespace-nowrap *:text-foreground max-[380px]:*:px-[7px]",
                                  "*:[transition:scale_var(--duration-spring)_var(--ease-spring),border-color_var(--duration-fast)_var(--ease-standard),background_var(--duration-fast)_var(--ease-standard)]",
                                  "*:active:scale-97 *:active:duration-120 *:active:ease-standard pointer-fine:*:hover:border-border-strong pointer-fine:*:hover:bg-surface motion-reduce:*:duration-0 motion-reduce:*:active:scale-100",
                                )}
                              >
                                <button type="button" onClick={() => toggleRead(item)}>
                                  <MorphWidth reduce={reduce} morphKey={item.read ? "read" : "unread"}>
                                    <span className="relative grid place-items-center">
                                      <AnimatePresence mode="popLayout" initial={false}>
                                        <Swap
                                          key={item.read ? "unread" : "read"}
                                          className="relative grid place-items-center"
                                          initial={reduce ? { opacity: 0 } : iconIn}
                                          animate={shown}
                                          exit={reduce ? fadeOut : { ...iconIn, transition: exitFast }}
                                          transition={reduce ? instant : motionTokens.spring.snappy}
                                        >
                                          {item.read ? (
                                            <Record size={14} strokeWidth={1.75} aria-hidden="true" />
                                          ) : (
                                            <Check size={14} strokeWidth={1.75} aria-hidden="true" />
                                          )}
                                        </Swap>
                                      </AnimatePresence>
                                    </span>
                                    <SwapText reduce={reduce}>{item.read ? "Mark unread" : "Mark read"}</SwapText>
                                  </MorphWidth>
                                </button>
                                <button type="button" onClick={() => dismiss(item)}>
                                  <X size={14} strokeWidth={1.75} aria-hidden="true" />
                                  Dismiss
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </article>
                    </motion.div>
                  )
                })}
                {/* The empty state opens its height on the same spring the rows close on, so the panel morphs between them instead of stacking both. After a bulk action it waits for the cascade to get going, so the panel never grows before it shrinks. */}
                {visible.length === 0 && (
                  <motion.div
                    key="empty"
                    className="overflow-hidden"
                    initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduce ? fadeOut : { height: 0, opacity: 0, transition: { height: motionTokens.spring.smooth, opacity: exitFast } }}
                    transition={
                      reduce
                        ? instant
                        : {
                            height: { ...motionTokens.spring.smooth, delay: bulk ? cascade(3) : 0 },
                            opacity: { ...enter, delay: motionTokens.duration.fast },
                          }
                    }
                  >
                    <motion.div
                      className="grid min-h-[190px] content-center justify-items-center px-3 py-[22px] text-center"
                      initial={reduce ? false : { y: 6 }}
                      animate={{ y: 0 }}
                      transition={reduce ? instant : { ...enter, delay: motionTokens.duration.fast }}
                    >
                      <CheckCircle className="mb-[13px] text-text-muted" size={24} strokeWidth={1.5} aria-hidden="true" />
                      <strong className="text-(length:--text-sm) font-medium">
                        <SwapText reduce={reduce}>{view === "unread" ? "Nothing unread" : "All clear"}</SwapText>
                      </strong>
                      <p className="m-0 mt-1 text-(length:--text-xs) text-text-secondary">
                        <SwapText reduce={reduce}>{view === "unread" ? "You’ve seen every update." : "New updates will appear here."}</SwapText>
                      </p>
                      {view === "unread" && items.length > 0 && (
                        <button
                          type="button"
                          className="mt-4 cursor-pointer border-0 bg-transparent p-0 text-(length:--text-xs) text-foreground underline underline-offset-3"
                          onClick={() => {
                            setBulk(false)
                            setView("all")
                          }}
                        >
                          View all updates
                        </button>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence initial={false}>
              {readCount > 0 && (
                <motion.div
                  key="footer"
                  className="flex-none overflow-hidden"
                  initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduce ? fadeOut : { height: 0, opacity: 0, transition: { height: motionTokens.spring.smooth, opacity: exitFast } }}
                  transition={height}
                >
                  <div className="flex min-h-[46px] items-center justify-between gap-3 border-t border-border-subtle px-[22px] py-2 text-(length:--text-xs) text-text-muted max-[380px]:px-4">
                    <span>
                      <RollingCount value={readCount} reduce={reduce} /> read
                    </span>
                    <button
                      type="button"
                      className={cn(
                        "cursor-pointer border-0 bg-transparent py-1 text-(length:--text-xs) text-text-secondary",
                        "[transition:scale_var(--duration-spring)_var(--ease-spring),color_var(--duration-fast)_var(--ease-standard)]",
                        "active:scale-97 pointer-fine:hover:text-foreground",
                        springPress,
                      )}
                      onClick={clearRead}
                    >
                      Clear read
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export default NotificationCenter
