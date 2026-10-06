"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { createContext, useCallback, useContext, useId, useLayoutEffect, useRef, useState } from "react"
import type { ComponentPropsWithoutRef, RefObject } from "react"
import { ChevronLeft as NavArrowLeft, ChevronRight as NavArrowRight } from "lucide-react"
import { AnimatePresence, LayoutGroup, animate, motion, useReducedMotion } from "motion/react"
import type { AnimationPlaybackControls, Variants } from "motion/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

type RootProps = Omit<ComponentPropsWithoutRef<typeof TabsPrimitive.Root>, "value" | "defaultValue" | "onValueChange"> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** "automatic" selects a tab as soon as arrow keys focus it; "manual" waits for Enter or Space. */
  activationMode?: "automatic" | "manual"
}
type ListProps = ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  /** Whether arrow keys wrap from the last tab to the first. */
  loop?: boolean
}
type TriggerProps = Omit<ComponentPropsWithoutRef<typeof TabsPrimitive.Tab>, "value"> & { value: string }
type ContentProps = Omit<ComponentPropsWithoutRef<typeof TabsPrimitive.Panel>, "value"> & {
  value: string
  /** Keeps the panel mounted and skips the enter and exit animation. */
  forceMount?: boolean
}

/** `direction` is +1 when the new tab sits after the old one; `panelHeightRef` holds the visible panel height so the next panel can morph from it; `leavingRectRef` pins the outgoing panel where it was on screen. */
const TabsContext = createContext<{
  active: string
  layoutId: string
  direction: number
  activationMode: "automatic" | "manual"
  panelHeightRef: RefObject<number | null>
  leavingRectRef: RefObject<DOMRect | null>
}>({
  active: "",
  layoutId: "tabs",
  direction: 1,
  activationMode: "automatic",
  panelHeightRef: { current: null },
  leavingRectRef: { current: null },
})

export function Tabs({ value, defaultValue, onValueChange, activationMode = "automatic", className, ...props }: RootProps) {
  const [internal, setInternal] = useState(defaultValue ?? "")
  const [direction, setDirection] = useState(1)
  const active = value ?? internal
  const layoutId = useId()
  const root = useRef<HTMLDivElement>(null)
  const panelHeightRef = useRef<number | null>(null)
  const leavingRectRef = useRef<DOMRect | null>(null)
  function handleChange(next: string) {
    const frame = root.current
    leavingRectRef.current =
      frame?.querySelector(':scope > [role="tabpanel"]:not([hidden]):not([inert])')?.getBoundingClientRect() ?? null
    const order = frame
      ? Array.from(frame.querySelectorAll<HTMLElement>('[role="tab"][data-value]'))
          .filter(tab => tab.closest("[data-tg-tabs]") === frame)
          .map(tab => tab.dataset.value)
      : []
    const from = order.indexOf(active),
      to = order.indexOf(next)
    if (from >= 0 && to >= 0 && from !== to) setDirection(to > from ? 1 : -1)
    if (value === undefined) setInternal(next)
    onValueChange?.(next)
  }
  return (
    <TabsContext.Provider value={{ active, layoutId, direction, activationMode, panelHeightRef, leavingRectRef }}>
      <LayoutGroup id={layoutId}>
        {/* Positioned so an outgoing panel pops out exactly where it was while the next one takes its place. */}
        <TabsPrimitive.Root
          {...props}
          ref={root}
          data-tg-tabs=""
          className={cn("relative", className)}
          value={active}
          onValueChange={next => handleChange(String(next))}
        />
      </LayoutGroup>
    </TabsContext.Provider>
  )
}

export function TabsList({ className, loop, loopFocus, activateOnFocus, ...props }: ListProps) {
  const { active, activationMode } = useContext(TabsContext)
  const reduced = useReducedMotion()
  const shell = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ overflow: false, left: false, right: false })
  const update = useCallback(() => {
    const frame = shell.current
    const scroll = viewport.current
    if (!frame || !scroll) return
    const max = Math.max(0, scroll.scrollWidth - scroll.clientWidth)
    const next = { overflow: scroll.scrollWidth > frame.clientWidth + 1, left: scroll.scrollLeft > 1, right: scroll.scrollLeft < max - 1 }
    setEdges(previous =>
      previous.overflow === next.overflow && previous.left === next.left && previous.right === next.right ? previous : next,
    )
  }, [])
  const reveal = useCallback(
    (tab: HTMLElement | null) => {
      const scroll = viewport.current
      if (!scroll || !tab) return
      const frame = scroll.getBoundingClientRect()
      const item = tab.getBoundingClientRect()
      const max = Math.max(0, scroll.scrollWidth - scroll.clientWidth)
      const left = frame.left + (scroll.scrollLeft > 1 ? 34 : 0)
      const right = frame.right - (scroll.scrollLeft < max - 1 ? 34 : 0)
      const delta = item.left < left ? item.left - left : item.right > right ? item.right - right : 0
      if (delta) scroll.scrollBy({ left: delta, behavior: reduced ? "instant" : "smooth" })
    },
    [reduced],
  )
  useLayoutEffect(() => {
    const frame = shell.current
    const scroll = viewport.current
    const content = list.current
    if (!frame || !scroll || !content) return
    const observer = new ResizeObserver(update)
    observer.observe(frame)
    observer.observe(scroll)
    observer.observe(content)
    scroll.addEventListener("scroll", update, { passive: true })
    update()
    return () => {
      observer.disconnect()
      scroll.removeEventListener("scroll", update)
    }
  }, [update])
  useLayoutEffect(() => {
    reveal(list.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ?? null)
  }, [active, reveal])
  const scrollTabs = (direction: number) =>
    viewport.current?.scrollBy({
      left: direction * (viewport.current?.clientWidth ?? 0) * 0.75,
      behavior: reduced ? "instant" : "smooth",
    })
  const scrollButton = cn(
    "absolute top-0 bottom-0 z-2 grid w-[33px] place-items-center border-0 bg-surface-muted text-foreground",
    "disabled:pointer-events-none disabled:opacity-0 focus-visible:outline-2 focus-visible:-outline-offset-3 focus-visible:outline-(--focus-ring)",
  )
  return (
    <div
      ref={shell}
      className="relative isolate inline-flex max-w-full min-w-0 items-center rounded-control border border-border bg-surface-muted"
      data-overflow={edges.overflow}
      data-left={edges.left}
      data-right={edges.right}
    >
      {edges.overflow && (
        <button
          type="button"
          className={cn(scrollButton, "left-0 rounded-l-control")}
          aria-label="Scroll tabs left"
          disabled={!edges.left}
          onClick={() => scrollTabs(-1)}
        >
          <NavArrowLeft width={17} height={17} aria-hidden="true" />
        </button>
      )}
      <motion.div
        ref={viewport}
        layoutScroll
        className={cn(
          "min-w-0 overflow-x-auto rounded-[inherit] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          edges.left && !edges.right && "[mask-image:linear-gradient(to_right,transparent,black_35px,black)]",
          edges.right && !edges.left && "[mask-image:linear-gradient(to_right,black,black_calc(100%_-_35px),transparent)]",
          edges.left &&
            edges.right &&
            "[mask-image:linear-gradient(to_right,transparent,black_35px,black_calc(100%_-_35px),transparent)]",
        )}
        onFocusCapture={event => {
          if (event.target instanceof HTMLElement && event.target.getAttribute("role") === "tab") reveal(event.target)
        }}
      >
        {/* The list owns the stacking context so the gliding highlight passes under every label, not over earlier ones. */}
        <TabsPrimitive.List
          {...props}
          ref={list}
          activateOnFocus={activateOnFocus ?? activationMode !== "manual"}
          loopFocus={loopFocus ?? loop}
          className={cn("isolate inline-flex w-max items-center gap-1 p-1", className)}
        />
      </motion.div>
      {edges.overflow && (
        <button
          type="button"
          className={cn(scrollButton, "right-0 rounded-r-control")}
          aria-label="Scroll tabs right"
          disabled={!edges.right}
          onClick={() => scrollTabs(1)}
        >
          <NavArrowRight width={17} height={17} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export function TabsTrigger({ className, children, value, ...props }: TriggerProps) {
  const { active } = useContext(TabsContext)
  const reduced = useReducedMotion()
  // The LayoutGroup in Tabs scopes the highlight to this instance, so it glides between triggers but never flies in from another tab set.
  return (
    <TabsPrimitive.Tab
      {...props}
      value={value}
      data-value={value}
      className={cn(
        "relative inline-grid min-h-control-sm min-w-[5.5rem] flex-none cursor-pointer place-items-center rounded-[calc(var(--radius-control)_-_3px)] border-0 bg-transparent px-3",
        "[font:inherit] text-(length:--text-sm) font-medium whitespace-nowrap text-text-muted [-webkit-tap-highlight-color:transparent]",
        "transition-colors duration-160 ease-standard motion-reduce:transition-none",
        "pointer-fine:hover:text-foreground active:text-foreground aria-selected:text-accent-strong",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)",
        "disabled:cursor-not-allowed disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
    >
      {active === value && (
        <motion.span
          className="absolute inset-0 -z-1 rounded-[inherit] border border-border bg-surface shadow-resting will-change-transform"
          layoutId="selection"
          layoutDependency={active}
          transition={reduced ? { duration: 0 } : motionTokens.spring.morph}
          aria-hidden="true"
        />
      )}
      <span className="relative z-1">{children}</span>
    </TabsPrimitive.Tab>
  )
}

const panelMotion: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 8 }),
  center: {
    opacity: 1,
    x: 0,
    transition: {
      opacity: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] },
      x: motionTokens.spring.smooth,
    },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -6,
    transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] },
  }),
}
/** Reduced motion: a short crossfade in place. Keys match panelMotion so server and client render identical styles. */
const panelFade: Variants = {
  enter: { opacity: 0, x: 0 },
  center: { opacity: 1, x: 0, transition: { duration: motionTokens.duration.instant } },
  exit: { opacity: 0, x: 0, transition: { duration: 0.1 } },
}

/* The outgoing panel is lifted out of flow by the presence animation; drop its margin so it stays in place and ignore stray clicks. */
const contentClass = cn(
  "mt-4 text-(length:--text-sm) leading-body text-text-secondary",
  "data-motion-pop-id:mt-0 data-ending-style:pointer-events-none data-hidden:pointer-events-none",
  "focus-visible:rounded-control focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--focus-ring)",
)

export function TabsContent({ className, value, forceMount, keepMounted, children, ...props }: ContentProps) {
  const { active, direction, panelHeightRef, leavingRectRef } = useContext(TabsContext)
  const reduced = useReducedMotion()
  const panel = useRef<HTMLDivElement>(null)
  const selected = active === value
  const still = forceMount || keepMounted
  const classes = cn(contentClass, className)
  // The incoming panel starts at the outgoing panel's height and settles at its own, so content below glides instead of jumping.
  useLayoutEffect(() => {
    const node = panel.current
    if (!node || still) return
    // Outgoing: the tab root may have changed size around it, so pin the panel to where it was while it fades.
    if (!selected) {
      const before = leavingRectRef.current
      const now = node.getBoundingClientRect()
      if (before) node.style.translate = `${before.left - now.left}px ${before.top - now.top}px`
      node.inert = true
      return
    }
    node.style.translate = ""
    node.inert = false
    const from = panelHeightRef.current
    const to = node.offsetHeight
    let controls: AnimationPlaybackControls | undefined
    const release = () => {
      node.style.height = ""
      node.style.overflow = ""
    }
    if (from !== null && Math.abs(from - to) > 1 && !reduced) {
      if (to > from) node.style.overflow = "clip"
      controls = animate(node, { height: [from, to] }, { ...motionTokens.spring.smooth, onComplete: release })
    }
    panelHeightRef.current = controls && from !== null ? from : to
    const observer = new ResizeObserver(() => {
      panelHeightRef.current = node.offsetHeight
    })
    observer.observe(node)
    return () => {
      observer.disconnect()
      controls?.stop()
      release()
    }
  }, [selected, reduced, still, panelHeightRef, leavingRectRef])
  if (still)
    return (
      <TabsPrimitive.Panel {...props} value={value} keepMounted className={classes}>
        {children}
      </TabsPrimitive.Panel>
    )
  // Presence owns the exit, so the panel stays mounted and visible to Base UI until the fade ends.
  return (
    <AnimatePresence initial={false} mode="popLayout" custom={direction}>
      {selected && (
        <TabsPrimitive.Panel
          {...props}
          key={value}
          value={value}
          keepMounted
          hidden={false}
          className={classes}
          render={
            <motion.div ref={panel} custom={direction} variants={reduced ? panelFade : panelMotion} initial="enter" animate="center" exit="exit" />
          }
        >
          {children}
        </TabsPrimitive.Panel>
      )}
    </AnimatePresence>
  )
}
