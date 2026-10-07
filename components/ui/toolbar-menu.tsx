"use client"

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import type { KeyboardEvent, ReactNode } from "react"
import { AnimatePresence, LayoutGroup, animate, motion, useIsPresent, useMotionValue } from "motion/react"
import type { Transition, Variants } from "motion/react"
import { ArrowLeft, ChevronRight, ChevronsUpDown } from "lucide-react"

import { motionTokens as staticTokens } from "@/lib/motion-tokens"
import { useMotionTokens, type MotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface ToolbarMenuItem {
  id: string
  label: string
  icon: ReactNode
  /** Items under this one open as their own page of the menu, with a Back row on top. */
  items?: ToolbarMenuItem[]
  /** Set false to keep the item out of the bar; it still shows in the menu. */
  inBar?: boolean
}
export interface ToolbarMenuProps {
  items: ToolbarMenuItem[]
  /** The id of the current leaf item. Its top-level item shows as current in the bar. */
  value?: string
  defaultValue?: string
  onValueChange?: (id: string, item: ToolbarMenuItem) => void
  /** Accessible name of the bar and its menu. */
  label?: string
  className?: string
}

/** The bar, or a page of the menu named by the path of submenu ids that leads to it ("page:" is the top page). */
type Face = "bar" | `page:${string}`

type Bezier = [number, number, number, number]
const enter = [...staticTokens.ease.enter] as Bezier
const standard = [...staticTokens.ease.standard] as Bezier
/** Duration springs restated as stiffness and damping, so a retarget mid-flight keeps the velocity it already has. */
const physical = (visualDuration: number, bounce: number): Transition => {
  const root = (2 * Math.PI) / (visualDuration * 1.2)
  return { type: "spring", stiffness: root * root, damping: 2 * (1 - bounce) * root, mass: 1 }
}

/** Bar height: 40px buttons in 4px of padding. The menu's corner is its 16px rows plus their 6px inset, so the two stay concentric. */
const BAR = 48
const BAR_RADIUS = BAR / 2
const PANEL_RADIUS = 22

/** Everything derived from the motion tokens, rebuilt when the tokens change. */
function buildMotion(motionTokens: MotionTokens) {
  const { blur } = motionTokens
  /** Growing out of the bar carries the morph spring's bounce; folding back never overshoots. */
  const GROW = physical(motionTokens.spring.morph.visualDuration ?? 0.42, motionTokens.spring.morph.bounce ?? 0.16)
  const FOLD = physical(motionTokens.spring.smooth.visualDuration ?? 0.4, motionTokens.spring.smooth.bounce ?? 0)
  /** Page to page, the height settles without overshoot and follows the incoming page a beat late. */
  const RESIZE: Transition = { ...FOLD, delay: 0.04 }
  /**
   * Faces swap in place, as one shape holding different content: the old face blurs out fast while the shape moves,
   * the new one sharpens in behind it. The bar waits for the fold to mostly land before its icons return.
   */
  const faceVariants: Variants = {
    hidden: { opacity: 0, scale: 0.97, filter: `blur(${blur.soft}px)` },
    shown: (delay: number) => ({
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        scale: { ...physical(0.32, 0), delay },
        opacity: { duration: 0.2, ease: enter, delay },
        filter: { duration: 0.24, ease: enter, delay },
      },
    }),
    gone: {
      opacity: 0,
      scale: 0.97,
      filter: `blur(${blur.soft}px)`,
      transition: { scale: physical(0.24, 0), opacity: { duration: 0.1, ease: standard }, filter: { duration: 0.12, ease: standard } },
    },
  }
  return { GROW, FOLD, RESIZE, faceVariants }
}

const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.14 } },
  gone: { opacity: 0, transition: { duration: 0.1 } },
}

const subscribe = () => () => {}
/** Reduced motion only after hydration, so the server and first client render agree. */
function useReducedFlag() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false)
  return !!useReducedMotion() && hydrated
}

const faceOf = (path: string[] | null): Face => (path ? `page:${path.join("/")}` : "bar")

function contains(item: ToolbarMenuItem, id: string | undefined): boolean {
  return item.id === id || !!item.items?.some(child => contains(child, id))
}

function firstLeaf(items: ToolbarMenuItem[]): string | undefined {
  for (const item of items) {
    if (!item.items) return item.id
    const leaf = firstLeaf(item.items)
    if (leaf) return leaf
  }
}

function FaceLayer({
  id,
  delay,
  reduced,
  onSize,
  className,
  children,
}: {
  id: Face
  delay: number
  reduced: boolean
  onSize: (id: Face, width: number, height: number) => void
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const present = useIsPresent()
  const motionTokens = useMotionTokens()
  const { faceVariants } = useMemo(() => buildMotion(motionTokens), [motionTokens])
  // Only the current face reports its size; the leaving one keeps whatever it had while it fades.
  useLayoutEffect(() => {
    const node = ref.current
    if (!node || !present) return
    const report = () => onSize(id, node.offsetWidth, node.offsetHeight)
    report()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(report)
    observer.observe(node)
    return () => observer.disconnect()
  }, [id, onSize, present])
  return (
    <motion.div
      ref={ref}
      data-face={id}
      custom={delay}
      variants={reduced ? fadeVariants : faceVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
      inert={!present || undefined}
      // Centered on the bar and pinned to its bottom edge, so the menu grows up and out to both sides.
      style={{ x: "-50%" }}
      className={cn("absolute bottom-0 left-1/2 origin-bottom", className)}
    >
      {children}
    </motion.div>
  )
}

/**
 * A compact bar of icons that morphs into a full menu. Hovering an icon names it in a tooltip that slides between icons;
 * the chevron, or an icon with sub-items, opens the menu, whose pages swap in place while the shape follows their height.
 */
export function ToolbarMenu({ items, value: valueProp, defaultValue, onValueChange, label = "Navigation", className }: ToolbarMenuProps) {
  const reduced = useReducedFlag()
  const motionTokens = useMotionTokens()
  const { GROW, FOLD, RESIZE } = useMemo(() => buildMotion(motionTokens), [motionTokens])
  const uid = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)

  const [inner, setInner] = useState(() => defaultValue ?? firstLeaf(items))
  const value = valueProp ?? inner

  const [path, setPath] = useState<string[] | null>(null)
  const face = faceOf(path)
  const current = useRef<Face>("bar")
  const focusNext = useRef<string | null>(null)
  const [active, setActive] = useState(0)
  const [tip, setTip] = useState<{ index: number; x: number } | null>(null)
  const [barWidth, setBarWidth] = useState<number>()

  /* The shape: one surface whose width, height, and corner radius follow the current face. */
  const width = useMotionValue<number | string>("100%")
  const height = useMotionValue<number | string>("100%")
  const radius = useMotionValue(BAR_RADIUS)
  const target = useRef<{ id: Face; w: number; h: number } | null>(null)
  const onSize = useCallback(
    (id: Face, w: number, h: number) => {
      if (id === "bar") setBarWidth(w)
      if (id !== current.current) return
      const previous = target.current
      if (previous && Math.abs(previous.w - w) < 0.5 && Math.abs(previous.h - h) < 0.5) return
      target.current = { id, w, h }
      const r = id === "bar" ? BAR_RADIUS : PANEL_RADIUS
      if (!previous || reduced) {
        width.jump(w)
        height.jump(h)
        radius.jump(r)
        return
      }
      const surface = surfaceRef.current
      if (typeof width.get() === "string" && surface) {
        width.jump(surface.offsetWidth)
        height.jump(surface.offsetHeight)
      }
      const spring = id === "bar" ? FOLD : previous.id === "bar" ? GROW : RESIZE
      animate(width, w, spring)
      animate(height, h, spring)
      animate(radius, r, spring)
    },
    [FOLD, GROW, RESIZE, height, radius, reduced, width],
  )

  const go = useCallback((next: string[] | null, focus: string | null) => {
    const nextFace = faceOf(next)
    if (nextFace === current.current) return
    current.current = nextFace
    focusNext.current = focus
    setTip(null)
    setPath(next)
  }, [])

  // Focus moves into each new face once it mounts, and back to the bar on close.
  useEffect(() => {
    const selector = focusNext.current
    focusNext.current = null
    if (!selector) return
    surfaceRef.current?.querySelector<HTMLElement>(`[data-face="${CSS.escape(face)}"] ${selector}`)?.focus({ preventScroll: true })
  }, [face])

  const close = useCallback((focusTrigger: boolean) => go(null, focusTrigger ? "[data-trigger]" : null), [go])

  // A press outside folds the menu without moving focus.
  useEffect(() => {
    if (!path) return
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close(false)
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [close, path])

  const pageItems = useMemo(() => lookup(items, path ?? []), [items, path])
  const parent = path?.length ? path.slice(0, -1) : null
  const pageTitle = path?.length ? findLabel(items, path) : label

  const open = (next: string[], index = 0) => {
    setActive(index)
    go(next, `[data-index="${index}"]`)
  }
  const pick = (item: ToolbarMenuItem, fromMenu: boolean) => {
    if (valueProp === undefined) setInner(item.id)
    onValueChange?.(item.id, item)
    if (fromMenu) close(true)
  }

  /* Bar */
  const barItems = items.filter(item => item.inBar !== false)
  const showTip = (index: number, button: HTMLElement) => setTip({ index, x: button.offsetLeft + button.offsetWidth / 2 })
  const onBarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...event.currentTarget.querySelectorAll<HTMLElement>("button")]
    const index = buttons.indexOf(document.activeElement as HTMLElement)
    if (event.key === "ArrowUp") {
      event.preventDefault()
      open([], 0)
      return
    }
    let next = -1
    if (event.key === "ArrowRight") next = (index + 1) % buttons.length
    else if (event.key === "ArrowLeft") next = (index - 1 + buttons.length) % buttons.length
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = buttons.length - 1
    if (next < 0) return
    event.preventDefault()
    buttons[next]?.focus()
  }

  /* Menu: a Back row on sub-pages, then the page's items. */
  const rows = parent ? [null, ...pageItems] : pageItems
  const choose = (row: ToolbarMenuItem | null) => {
    if (row?.items) return open([...(path ?? []), row.id], 0)
    if (row) return pick(row, true)
    if (!parent) return
    // Back lands on the row that opened this page, one lower when the parent page has its own Back row.
    const index = lookup(items, parent).findIndex(item => item.id === path?.at(-1))
    open(parent, Math.max(0, index) + (parent.length ? 1 : 0))
  }
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = rows.length - 1
    let next = -1
    if (event.key === "ArrowDown") next = active >= last ? 0 : active + 1
    else if (event.key === "ArrowUp") next = active <= 0 ? last : active - 1
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = last
    else if (event.key === "ArrowRight" && rows[active]?.items) {
      event.preventDefault()
      choose(rows[active])
      return
    } else if (event.key === "ArrowLeft" && parent) {
      event.preventDefault()
      choose(null)
      return
    }
    if (next < 0) return
    event.preventDefault()
    setActive(next)
    event.currentTarget.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus()
  }
  const onSurfaceKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !path) return
    event.preventDefault()
    event.stopPropagation()
    if (parent) choose(null)
    else close(true)
  }

  const resting = face === "bar"
  const tipItem = tip && barItems[tip.index]
  const iconClass = "grid size-5 flex-none place-items-center [&_svg]:size-[18px]"

  return (
    <div ref={rootRef} className={cn("relative h-12 touch-manipulation", className)} style={{ width: barWidth }}>
      <AnimatePresence>
        {resting && tipItem && (
          <motion.span
            key="tip"
            aria-hidden="true"
            className="pointer-events-none absolute bottom-full left-0 z-10 mb-2"
            initial={reduced ? { opacity: 0, x: tip.x } : { opacity: 0, y: 4, scale: 0.96, x: tip.x }}
            animate={{ opacity: 1, y: 0, scale: 1, x: tip.x }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.96 }}
            transition={
              reduced
                ? { duration: motionTokens.duration.instant }
                : { x: motionTokens.spring.snappy, default: { duration: motionTokens.duration.fast, ease: enter } }
            }
          >
            <span className="block -translate-x-1/2 rounded-full bg-foreground px-2.5 py-1 text-xs leading-body font-medium whitespace-nowrap text-background shadow-raised">
              {tipItem.label}
            </span>
          </motion.span>
        )}
      </AnimatePresence>

      <motion.div
        ref={surfaceRef}
        className={cn(
          "absolute bottom-0 left-1/2 overflow-hidden bg-surface-raised text-foreground ring-1 ring-border",
          resting ? "shadow-raised" : "shadow-floating",
        )}
        style={{ x: "-50%", width, height, borderRadius: radius }}
        onKeyDown={onSurfaceKeyDown}
      >
        <AnimatePresence initial={false}>
          {resting && (
            <FaceLayer key="bar" id="bar" delay={0.12} reduced={reduced} onSize={onSize}>
              <LayoutGroup id={`${uid}-bar`}>
                <div role="toolbar" aria-label={label} className="isolate flex items-center gap-0.5 p-1" onKeyDown={onBarKeyDown}>
                  {barItems.map((item, index) => {
                    const isCurrent = contains(item, value)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-label={item.label}
                        aria-current={isCurrent ? "page" : undefined}
                        aria-haspopup={item.items ? "menu" : undefined}
                        aria-expanded={item.items ? false : undefined}
                        className={cn(
                          "relative grid size-10 cursor-pointer place-items-center rounded-full outline-none [-webkit-tap-highlight-color:transparent]",
                          "transition-[color,background-color] duration-160 ease-standard motion-reduce:transition-none",
                          "focus-visible:ring-2 focus-visible:ring-focus-ring",
                          isCurrent ? "text-foreground" : "text-text-secondary pointer-fine:hover:bg-foreground/[0.05] pointer-fine:hover:text-foreground",
                        )}
                        onPointerEnter={event => event.pointerType === "mouse" && showTip(index, event.currentTarget)}
                        onPointerLeave={() => setTip(null)}
                        onFocus={event => event.currentTarget.matches(":focus-visible") && showTip(index, event.currentTarget)}
                        onBlur={() => setTip(null)}
                        onClick={() => (item.items ? open([item.id], 0) : pick(item, false))}
                      >
                        {isCurrent && (
                          <motion.span
                            layoutId="current"
                            className="absolute inset-0 -z-1 rounded-[inherit] bg-foreground/[0.08]"
                            transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
                            aria-hidden="true"
                          />
                        )}
                        <span className={iconClass} aria-hidden="true">
                          {item.icon}
                        </span>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    data-trigger=""
                    aria-label={`Open ${label.toLowerCase()} menu`}
                    aria-haspopup="menu"
                    aria-expanded={false}
                    className={cn(
                      "grid size-10 cursor-pointer place-items-center rounded-full text-text-secondary outline-none [-webkit-tap-highlight-color:transparent]",
                      "transition-[color,background-color] duration-160 ease-standard motion-reduce:transition-none",
                      "focus-visible:ring-2 focus-visible:ring-focus-ring pointer-fine:hover:bg-foreground/[0.05] pointer-fine:hover:text-foreground",
                    )}
                    onClick={() => open([], 0)}
                  >
                    <ChevronsUpDown className="size-[18px]" aria-hidden="true" />
                  </button>
                </div>
              </LayoutGroup>
            </FaceLayer>
          )}

          {path && (
            <FaceLayer key={face} id={face} delay={0.06} reduced={reduced} onSize={onSize} className="w-[min(15rem,calc(100vw-2rem))] p-1.5">
              <LayoutGroup id={`${uid}-${face}`}>
                <div role="menu" aria-label={pageTitle} className="isolate flex flex-col gap-0.5" onKeyDown={onMenuKeyDown}>
                  {rows.map((row, index) => {
                    const isCurrent = !!row && contains(row, value)
                    return (
                      <button
                        key={row?.id ?? "back"}
                        type="button"
                        role="menuitem"
                        data-index={index}
                        tabIndex={index === active ? 0 : -1}
                        aria-haspopup={row?.items ? "menu" : undefined}
                        aria-current={isCurrent && !row?.items ? "page" : undefined}
                        className="relative flex h-10 cursor-pointer items-center gap-3 rounded-[16px] px-2.5 text-left text-sm leading-body font-medium outline-none [-webkit-tap-highlight-color:transparent]"
                        onFocus={() => setActive(index)}
                        onPointerMove={event => {
                          if (event.pointerType === "mouse" && document.activeElement !== event.currentTarget) event.currentTarget.focus()
                        }}
                        onClick={() => choose(row)}
                      >
                        {index === active && (
                          <motion.span
                            layoutId="highlight"
                            className="absolute inset-0 -z-1 rounded-[inherit] bg-foreground/[0.065]"
                            transition={reduced ? { duration: 0 } : motionTokens.spring.morph}
                            aria-hidden="true"
                          />
                        )}
                        <span className={cn(iconClass, isCurrent ? "text-foreground" : "text-text-secondary")} aria-hidden="true">
                          {row ? row.icon : <ArrowLeft />}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{row ? row.label : "Back"}</span>
                        {row?.items && <ChevronRight className="size-4 flex-none text-text-muted" aria-hidden="true" />}
                      </button>
                    )
                  })}
                </div>
              </LayoutGroup>
            </FaceLayer>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

function lookup(items: ToolbarMenuItem[], path: string[]) {
  let list = items
  for (const id of path) list = list.find(item => item.id === id)?.items ?? []
  return list
}

function findLabel(items: ToolbarMenuItem[], path: string[]) {
  const id = path.at(-1)
  return lookup(items, path.slice(0, -1)).find(item => item.id === id)?.label ?? ""
}

export default ToolbarMenu
