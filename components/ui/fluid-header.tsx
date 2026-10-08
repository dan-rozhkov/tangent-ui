"use client"

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import type { CSSProperties, FocusEvent, KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react"
import { AnimatePresence, LayoutGroup, animate, motion, useIsPresent, useMotionValue } from "motion/react"
import type { Transition, Variants } from "motion/react"
import { CaretDownIcon, MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react"

import { motionTokens as defaultTokens } from "@/lib/motion-tokens"
import { useMotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface FluidHeaderLink {
  label: string
  description?: string
  icon?: ReactNode
  href?: string
}
export interface FluidHeaderSection {
  id: string
  title: string
  href?: string
  entries?: FluidHeaderLink[]
  /** Defaults to 2 when there are more than three entries. */
  columns?: 1 | 2
  spotlight?: ReactNode
  note?: ReactNode
}
export interface FluidHeaderLogo {
  name: string
  glyph: ReactNode
  href?: string
}
export interface FluidHeaderCta {
  label: string
  icon?: ReactNode
  href?: string
  onClick?: () => void
}
export interface FluidHeaderSearchItem {
  label: string
  description?: string
  group?: string
  icon?: ReactNode
  href?: string
  keywords?: string
}
export interface FluidHeaderSearch {
  placeholder?: string
  items: FluidHeaderSearchItem[]
}
export interface FluidHeaderTarget {
  label: string
  href?: string
  section?: string
}
export interface FluidHeaderProps {
  sections: FluidHeaderSection[]
  logo?: FluidHeaderLogo
  cta?: FluidHeaderCta
  search?: FluidHeaderSearch
  page?: string
  slim?: boolean
  foldBelow?: number
  onVisit?: (target: FluidHeaderTarget) => void
  label?: string
  className?: string
}

type View = { kind: "bar" } | { kind: "panel"; value: string } | { kind: "search" }
type Size = { w: number; h: number }

type Bezier = [number, number, number, number]
const enter = [...defaultTokens.ease.enter] as Bezier
const standard = [...defaultTokens.ease.standard] as Bezier
/** Duration springs restated as stiffness and damping, so a retarget mid-flight keeps the velocity it already has. */
const physical = (visualDuration: number, bounce: number): Transition => {
  const root = (2 * Math.PI) / (visualDuration * 1.2)
  return { type: "spring", stiffness: root * root, damping: 2 * (1 - bounce) * root, mass: 1 }
}
/** Every resize of the surface (open, switch, search, fold) rides one critically damped spring: no overshoot in either direction. */
function useResize() {
  const { visualDuration, bounce } = useMotionTokens().spring.smooth
  return useMemo(
    () => physical(visualDuration ?? defaultTokens.spring.smooth.visualDuration, bounce ?? defaultTokens.spring.smooth.bounce),
    [visualDuration, bounce],
  )
}
const SLIDE = physical(0.38, 0.06)
const PANEL_RADIUS = 22
const OPEN_DELAY = 60
const CLOSE_DELAY = 180
const MENU = "__menu"
const TRAVEL = 28

const subscribe = () => () => {}
function useReducedFlag() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false)
  return !!useReducedMotion() && hydrated
}

/** Moving to a neighbour slides the new panel in from that side while the old one leaves the other way. */
const panelVariantsOf = (blur: { soft: number }): Variants => ({
  hidden: (direction: number) => ({ opacity: 0, x: direction * TRAVEL, filter: `blur(${blur.soft}px)` }),
  shown: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { x: SLIDE, opacity: { duration: 0.2, ease: enter, delay: 0.03 }, filter: { duration: 0.22, ease: enter, delay: 0.03 } },
  },
  gone: (direction: number) => ({
    opacity: 0,
    x: direction * -TRAVEL * 0.7,
    filter: `blur(${blur.soft}px)`,
    transition: { x: SLIDE, opacity: { duration: 0.12, ease: standard }, filter: { duration: 0.12, ease: standard } },
  }),
})
const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.14 } },
  gone: { opacity: 0, transition: { duration: 0.1 } },
}

/** Reports a face's natural size while it is present, so the surface can spring to it. */
function useReportSize(onSize: (size: Size) => void) {
  const ref = useRef<HTMLDivElement>(null)
  const present = useIsPresent()
  useLayoutEffect(() => {
    const node = ref.current
    if (!node || !present) return
    const report = () => onSize({ w: node.offsetWidth, h: node.offsetHeight })
    report()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(report)
    observer.observe(node)
    return () => observer.disconnect()
  }, [onSize, present])
  return { ref, present }
}

function PanelFace({
  id,
  value,
  direction,
  reduced,
  labelledBy,
  onSize,
  onKeyDown,
  onClick,
  className,
  children,
}: {
  id: string
  value: string
  direction: number
  reduced: boolean
  labelledBy: string
  onSize: (value: string, size: Size) => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  onClick: (event: MouseEvent<HTMLDivElement>) => void
  className?: string
  children: ReactNode
}) {
  const { blur } = useMotionTokens()
  const panelVariants = useMemo(() => panelVariantsOf(blur), [blur])
  const report = useCallback((size: Size) => onSize(value, size), [onSize, value])
  const { ref, present } = useReportSize(report)
  return (
    <motion.div
      ref={ref}
      id={id}
      role="region"
      aria-labelledby={labelledBy}
      custom={direction}
      variants={reduced ? fadeVariants : panelVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
      inert={!present || undefined}
      onKeyDown={onKeyDown}
      onClick={onClick}
      className={cn("absolute top-(--bar-h) left-1/2 w-max max-w-(--nav-cap) -translate-x-1/2", className)}
    >
      {children}
    </motion.div>
  )
}

function SearchFace({ reduced, onSize, children }: { reduced: boolean; onSize: (size: Size) => void; children: ReactNode }) {
  const { blur } = useMotionTokens()
  const RESIZE = useResize()
  const { ref, present } = useReportSize(onSize)
  return (
    <motion.div
      ref={ref}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, filter: `blur(${blur.soft}px)` }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)", transition: { scale: RESIZE, opacity: { duration: 0.2, ease: enter, delay: 0.05 }, filter: { duration: 0.2, ease: enter, delay: 0.05 } } }}
      exit={reduced ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.98, filter: `blur(${blur.soft}px)`, transition: { duration: 0.12, ease: standard } }}
      inert={!present || undefined}
      className="absolute top-0 left-1/2 w-[min(34rem,var(--nav-cap))] origin-top -translate-x-1/2"
    >
      {children}
    </motion.div>
  )
}

/** Simple in-memory ranking: label prefix beats word prefix beats substring beats a match in the description, group, or keywords. */
function rank(items: FluidHeaderSearchItem[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return items.slice(0, 5)
  const scored: { item: FluidHeaderSearchItem; score: number; index: number }[] = []
  items.forEach((item, index) => {
    const label = item.label.toLowerCase()
    const rest = `${item.description ?? ""} ${item.group ?? ""} ${item.keywords ?? ""}`.toLowerCase()
    const score = label.startsWith(q)
      ? 4
      : label.split(/\s+/).some(word => word.startsWith(q))
        ? 3
        : label.includes(q)
          ? 2
          : rest.includes(q)
            ? 1
            : 0
    if (score) scored.push({ item, score, index })
  })
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 6)
    .map(entry => entry.item)
}

const linkClass = [
  "group/link flex min-w-0 cursor-pointer items-start gap-3 rounded-[14px] px-3 py-2.5 text-left outline-none",
  "transition-[background-color] duration-160 ease-standard motion-reduce:transition-none",
  "pointer-fine:hover:bg-foreground/[0.045] focus-visible:bg-foreground/[0.045]",
].join(" ")

export function FluidHeader({
  sections,
  logo,
  cta,
  search,
  page,
  slim = false,
  foldBelow = 680,
  onVisit,
  label = "Site navigation",
  className,
}: FluidHeaderProps) {
  const motionTokens = useMotionTokens()
  const { blur } = motionTokens
  const RESIZE = useResize()
  const reduced = useReducedFlag()
  const uid = useId()
  const navRef = useRef<HTMLElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)

  const [containerWidth, setContainerWidth] = useState<number | null>(null)
  const [barHeight, setBarHeight] = useState(0)
  const [view, setViewState] = useState<View>({ kind: "bar" })
  const [direction, setDirection] = useState(1)
  const [hovered, setHovered] = useState<string | null>(null)
  const [focusedTop, setFocusedTop] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [activeResult, setActiveResult] = useState(0)

  const collapsed = containerWidth !== null && containerWidth < foldBelow
  /** In the narrow state every item folds into one menu trigger. */
  const topItems: FluidHeaderSection[] = useMemo(
    () => (collapsed ? [{ id: MENU, title: "Menu" }] : sections),
    [collapsed, sections],
  )
  const hasPanel = useCallback(
    (item: FluidHeaderSection) => item.id === MENU || !!item.entries?.length || !!item.spotlight,
    [],
  )

  /* ── Shape ─────────────────────────────────────────────────────────────── */
  const width = useMotionValue<number | string>("auto")
  const height = useMotionValue<number | string>("auto")
  const radius = useMotionValue(28)
  const sizes = useRef<{ bar: Size | null; search: Size | null; panels: Record<string, Size> }>({ bar: null, search: null, panels: {} })
  const viewRef = useRef<View>({ kind: "bar" })
  const target = useRef<{ w: number; h: number; r: number } | null>(null)
  const flight = useRef(0)
  const reducedRef = useRef(reduced)
  useLayoutEffect(() => {
    reducedRef.current = reduced
  }, [reduced])

  const retarget = useCallback(() => {
    const { bar, search: searchSize, panels } = sizes.current
    const current = viewRef.current
    if (!bar) return
    let next: { w: number; h: number; r: number }
    if (current.kind === "search") {
      if (!searchSize) return
      next = { w: searchSize.w, h: searchSize.h, r: PANEL_RADIUS }
    } else if (current.kind === "panel") {
      const panel = panels[current.value]
      if (!panel) return
      next = { w: Math.max(bar.w, panel.w), h: bar.h + panel.h, r: PANEL_RADIUS }
    } else {
      next = { w: bar.w, h: bar.h, r: bar.h / 2 }
    }
    const previous = target.current
    if (previous && Math.abs(previous.w - next.w) < 0.5 && Math.abs(previous.h - next.h) < 0.5 && previous.r === next.r) return
    target.current = next
    const token = ++flight.current
    // At rest the surface sizes itself to the bar, so it renders right before hydration and follows font swaps for free.
    const settle = () => {
      if (token !== flight.current || viewRef.current.kind !== "bar") return
      width.jump("auto")
      height.jump("auto")
    }
    if (!previous || reducedRef.current) {
      width.jump(next.w)
      height.jump(next.h)
      radius.jump(next.r)
      settle()
      return
    }
    const surface = surfaceRef.current
    if (typeof width.get() === "string" && surface) {
      width.jump(surface.offsetWidth)
      height.jump(surface.offsetHeight)
    }
    // Width, height, and radius share one spring, so the corner moves in step with the size.
    animate(width, next.w, RESIZE)
    animate(radius, next.r, RESIZE)
    animate(height, next.h, RESIZE).then(settle)
  }, [RESIZE, height, radius, width])

  const onBarSize = useCallback(
    (size: Size) => {
      sizes.current.bar = size
      setBarHeight(size.h)
      retarget()
    },
    [retarget],
  )
  const onPanelSize = useCallback(
    (value: string, size: Size) => {
      sizes.current.panels[value] = size
      if (viewRef.current.kind === "panel" && viewRef.current.value === value) retarget()
    },
    [retarget],
  )
  const onSearchSize = useCallback(
    (size: Size) => {
      sizes.current.search = size
      if (viewRef.current.kind === "search") retarget()
    },
    [retarget],
  )

  const barRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const node = barRef.current
    if (!node) return
    const report = () => onBarSize({ w: node.offsetWidth, h: node.offsetHeight })
    report()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(report)
    observer.observe(node)
    return () => observer.disconnect()
  }, [onBarSize])

  // The root is a container: its own width decides the narrow state and caps panels and search.
  useLayoutEffect(() => {
    const node = navRef.current
    if (!node) return
    const report = () => setContainerWidth(node.clientWidth)
    report()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(report)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  /* ── View changes and focus ────────────────────────────────────────────── */
  const focusNext = useRef<string | null>(null)
  const setView = useCallback(
    (next: View, focus: string | null = null) => {
      const previous = viewRef.current
      if (previous.kind === next.kind && (next.kind !== "panel" || (previous.kind === "panel" && previous.value === next.value))) {
        if (focus) {
          focusNext.current = focus
          navRef.current?.querySelector<HTMLElement>(focus)?.focus()
          focusNext.current = null
        }
        return
      }
      if (previous.kind === "panel" && next.kind === "panel") {
        const from = topItems.findIndex(item => item.id === previous.value)
        const to = topItems.findIndex(item => item.id === next.value)
        setDirection(to >= from ? 1 : -1)
      } else {
        setDirection(1)
      }
      viewRef.current = next
      focusNext.current = focus
      setViewState(next)
      retarget()
    },
    [retarget, topItems],
  )
  useEffect(() => {
    const selector = focusNext.current
    focusNext.current = null
    if (selector) navRef.current?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true })
  }, [view])

  const openTimer = useRef(0)
  const closeTimer = useRef(0)
  const clearTimers = () => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
  }
  useEffect(() => () => {
    clearTimers()
    window.clearTimeout(hoverOpenedTimer.current)
  }, [])

  const closeAll = useCallback(
    (focus: string | null = null) => {
      window.clearTimeout(openTimer.current)
      window.clearTimeout(closeTimer.current)
      setView({ kind: "bar" }, focus)
    },
    [setView],
  )

  // The narrow state can drop the open item; fold the panel rather than point at a trigger that no longer exists.
  useEffect(() => {
    if (view.kind === "panel" && !topItems.some(item => item.id === view.value)) closeAll()
  }, [closeAll, topItems, view])

  // A pointer down outside the nav closes the panel or search.
  useEffect(() => {
    if (view.kind === "bar") return
    const onDown = (event: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) closeAll()
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [closeAll, view.kind])

  const navigate = (destination: FluidHeaderTarget, event?: MouseEvent) => {
    if (onVisit) {
      event?.preventDefault()
      onVisit(destination)
    }
  }

  /* ── Hover intent ──────────────────────────────────────────────────────── */
  /** Set for a moment after hover opens a panel, so the click that follows does not toggle it shut. */
  const hoverOpened = useRef(false)
  const hoverOpenedTimer = useRef(0)
  const onItemPointerEnter = (item: FluidHeaderSection, event: ReactPointerEvent) => {
    if (event.pointerType !== "mouse" || viewRef.current.kind === "search") return
    clearTimers()
    setHovered(item.id)
    openTimer.current = window.setTimeout(() => {
      if (hasPanel(item)) {
        hoverOpened.current = true
        window.clearTimeout(hoverOpenedTimer.current)
        hoverOpenedTimer.current = window.setTimeout(() => (hoverOpened.current = false), 400)
        setView({ kind: "panel", value: item.id })
      } else if (viewRef.current.kind === "panel") {
        setView({ kind: "bar" })
      }
    }, OPEN_DELAY)
  }
  const onNavPointerEnter = (event: ReactPointerEvent) => {
    if (event.pointerType === "mouse") window.clearTimeout(closeTimer.current)
  }
  const onNavPointerLeave = (event: ReactPointerEvent) => {
    if (event.pointerType !== "mouse") return
    window.clearTimeout(openTimer.current)
    setHovered(null)
    if (viewRef.current.kind !== "panel") return
    closeTimer.current = window.setTimeout(() => setView({ kind: "bar" }), CLOSE_DELAY)
  }

  // The panel closes when focus leaves the nav.
  const onNavBlur = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget as Node | null
    if (next && navRef.current?.contains(next)) return
    if (!next) return // Focus fell to the body, for example after a press on empty space; the outside press handles that.
    if (viewRef.current.kind !== "bar") closeAll()
  }

  /* ── Keyboard on top items ─────────────────────────────────────────────── */
  const triggerId = (value: string) => `${uid}-trigger-${value}`
  const panelId = (value: string) => `${uid}-panel-${value}`
  const focusTop = (index: number) => navRef.current?.querySelector<HTMLElement>(`[data-top="${index}"]`)?.focus()

  const onTopKeyDown = (item: FluidHeaderSection, index: number, event: KeyboardEvent<HTMLElement>) => {
    const last = topItems.length - 1
    const move = (to: number) => {
      event.preventDefault()
      focusTop(to)
      setHovered(null)
      // An open panel follows to the new item.
      if (viewRef.current.kind === "panel") {
        const target = topItems[to]
        if (target && hasPanel(target)) setView({ kind: "panel", value: target.id })
        else setView({ kind: "bar" })
      }
    }
    if (event.key === "ArrowRight") return move(index >= last ? 0 : index + 1)
    if (event.key === "ArrowLeft") return move(index <= 0 ? last : index - 1)
    if (event.key === "Home") return move(0)
    if (event.key === "End") return move(last)
    if (hasPanel(item) && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) {
      event.preventDefault()
      setView({ kind: "panel", value: item.id }, `#${CSS.escape(panelId(item.id))} [data-link]`)
    }
  }

  const onTopClick = (item: FluidHeaderSection, event: MouseEvent) => {
    if (!hasPanel(item)) {
      navigate({ label: item.title, href: item.href, section: item.id }, event)
      closeAll()
      return
    }
    // A click right after hover opened the panel keeps it open instead of toggling it shut.
    if (hoverOpened.current && viewRef.current.kind === "panel") return
    const open = viewRef.current.kind === "panel" && viewRef.current.value === item.id
    if (open) closeAll()
    else setView({ kind: "panel", value: item.id })
  }

  /** Top items carry their index in data-top, so one handler of each kind serves every item. */
  const topFromEvent = (event: { currentTarget: EventTarget }) => {
    const index = Number((event.currentTarget as HTMLElement).dataset.top)
    return { index, item: topItems[index] }
  }
  const onTopPointerEnter = (event: ReactPointerEvent<HTMLElement>) => {
    const { item } = topFromEvent(event)
    if (item) onItemPointerEnter(item, event)
  }
  const onTopKeyDownEvent = (event: KeyboardEvent<HTMLElement>) => {
    const { item, index } = topFromEvent(event)
    if (item) onTopKeyDown(item, index, event)
  }
  const onTopClickEvent = (event: MouseEvent<HTMLElement>) => {
    const { item } = topFromEvent(event)
    if (item) onTopClick(item, event)
  }

  /* ── Keyboard inside panels ────────────────────────────────────────────── */
  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const open = viewRef.current
    if ((event.key !== "ArrowDown" && event.key !== "ArrowUp") || open.kind !== "panel") return
    const value = open.value
    const links = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-link]"))
    const index = links.indexOf(document.activeElement as HTMLElement)
    if (index < 0) return
    event.preventDefault()
    if (event.key === "ArrowUp" && index === 0) {
      navRef.current?.querySelector<HTMLElement>(`#${CSS.escape(triggerId(value))}`)?.focus()
      return
    }
    const next = event.key === "ArrowDown" ? Math.min(links.length - 1, index + 1) : index - 1
    links[next]?.focus()
  }
  // Clicking a link or a button inside a feature closes the panel.
  const onPanelClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target.closest("a, button") : null
    if (target) closeAll()
  }

  /* ── Search ────────────────────────────────────────────────────────────── */
  const results = useMemo(() => (search ? rank(search.items, query) : []), [search, query])
  const suggested = !query.trim()
  const groups = useMemo(() => {
    const map = new Map<string, { item: FluidHeaderSearchItem; index: number }[]>()
    results.forEach((item, index) => {
      const key = suggested ? "Suggested" : (item.group ?? "Results")
      map.set(key, [...(map.get(key) ?? []), { item, index }])
    })
    return Array.from(map.entries())
  }, [results, suggested])
  const resultId = (index: number) => `${uid}-result-${index}`
  const listboxId = `${uid}-results`
  const active = Math.min(activeResult, Math.max(0, results.length - 1))

  const openSearch = () => {
    clearTimers()
    setQuery("")
    setActiveResult(0)
    setHovered(null)
    setView({ kind: "search" }, "[data-search-input]")
  }
  const choose = (item: FluidHeaderSearchItem) => {
    const destination = { label: item.label, href: item.href, section: item.group }
    closeAll("[data-search-trigger]")
    if (onVisit) onVisit(destination)
    else if (item.href) window.location.assign(item.href)
  }
  const onResultPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const index = Number(event.currentTarget.dataset.index)
    if (index !== active) setActiveResult(index)
  }
  const onResultClick = (event: MouseEvent<HTMLElement>) => {
    const item = results[Number(event.currentTarget.dataset.index)]
    if (item) choose(item)
  }
  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (!results.length) return
      const last = results.length - 1
      setActiveResult(event.key === "ArrowDown" ? (active >= last ? 0 : active + 1) : active <= 0 ? last : active - 1)
    } else if (event.key === "Enter") {
      event.preventDefault()
      const item = results[active]
      if (item) choose(item)
    }
  }

  const onNavKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") return
    const currentView = viewRef.current
    if (currentView.kind === "bar") return
    event.preventDefault()
    closeAll(currentView.kind === "search" ? "[data-search-trigger]" : `#${CSS.escape(triggerId(currentView.value))}`)
  }

  /* ── Render ────────────────────────────────────────────────────────────── */
  const searching = view.kind === "search"
  const openValue = view.kind === "panel" ? view.value : null
  /** The highlight follows the pointer, then keyboard focus, then the open panel; at rest it is hidden. */
  const highlighted = hovered ?? focusedTop ?? openValue ?? null
  const itemText = slim ? "text-[13px]" : "text-sm"
  const cap = containerWidth ? `${Math.max(240, containerWidth - 16)}px` : "calc(100vw - 2rem)"
  const announcement = searching ? (results.length ? `${results.length} ${results.length === 1 ? "result" : "results"}` : "No results") : ""

  const renderLinks = (links: FluidHeaderLink[], section: string, columns: 1 | 2) => (
    <ul className={cn("grid gap-1", columns === 2 ? "w-[29rem] max-w-full grid-cols-2 max-[420px]:grid-cols-1" : "w-[14.375rem] max-w-full grid-cols-1")}>
      {links.map(link => (
        <li key={link.label} className="min-w-0">
          <a
            data-link=""
            href={link.href ?? "#"}
            className={linkClass}
            onClick={event => navigate({ label: link.label, href: link.href, section }, event)}
          >
            {link.icon && (
              <span className="grid size-5 flex-none place-items-center text-text-secondary [&_svg]:size-5" aria-hidden="true">
                {link.icon}
              </span>
            )}
            <span className="flex min-w-0 flex-col gap-px">
              <span className="truncate text-sm leading-body font-medium text-foreground">{link.label}</span>
              {link.description && <span className="line-clamp-3 text-xs leading-body text-text-muted">{link.description}</span>}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )

  const renderPanel = (value: string) => {
    if (value === MENU) {
      return (
        <div className="flex w-[min(20rem,var(--nav-cap))] flex-col gap-1 p-2">
          {sections.map(item =>
            item.entries?.length ? (
              <div key={item.id} className="flex flex-col">
                <span className="px-3 pt-2 pb-1 text-xs leading-body text-text-muted">{item.title}</span>
                {renderLinks(item.entries, item.id, 1)}
              </div>
            ) : (
              <a
                key={item.id}
                data-link=""
                href={item.href ?? "#"}
                aria-current={page === item.id ? "page" : undefined}
                className={cn(linkClass, "text-sm leading-body font-medium")}
                onClick={event => navigate({ label: item.title, href: item.href, section: item.id }, event)}
              >
                {item.title}
              </a>
            ),
          )}
        </div>
      )
    }
    const item = sections.find(entry => entry.id === value)
    if (!item) return null
    const columns = item.columns ?? ((item.entries?.length ?? 0) > 3 ? 2 : 1)
    return (
      <div className="flex flex-col gap-2 p-2">
        <div className="flex gap-2 max-[420px]:flex-col">
          {item.entries?.length ? renderLinks(item.entries, item.id, columns) : null}
          {item.spotlight && <div className="w-[13.25rem] max-w-full flex-none max-[420px]:w-full">{item.spotlight}</div>}
        </div>
        {item.note && <div className="border-t border-border-subtle px-2.5 pt-2 pb-1 text-sm text-text-secondary">{item.note}</div>}
      </div>
    )
  }

  return (
    <nav
      ref={navRef}
      aria-label={label}
      className={cn("relative w-full", slim ? "h-11" : "h-14", className)}
      style={{ "--nav-cap": cap, "--bar-h": `${barHeight}px` } as CSSProperties}
      onPointerEnter={onNavPointerEnter}
      onPointerLeave={onNavPointerLeave}
      onBlur={onNavBlur}
      onKeyDown={onNavKeyDown}
    >
      <motion.div
        ref={surfaceRef}
        className={cn(
          "absolute top-0 left-1/2 z-30 -translate-x-1/2 overflow-hidden text-foreground",
          "bg-surface-raised/88 backdrop-blur-[22px] backdrop-saturate-150",
          "[@media(prefers-reduced-transparency:reduce)]:bg-surface-raised [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
          "contrast-more:bg-surface-raised contrast-more:backdrop-blur-none",
          "transition-shadow duration-200 ease-standard",
          // Light theme uses the shared tokens; dark matches the two-layer shadows the bar and open states use.
          view.kind === "bar"
            ? "shadow-raised dark:shadow-[0_1px_2px_color-mix(in_oklab,var(--shade)_20%,transparent),0_6px_18px_color-mix(in_oklab,var(--shade)_18%,transparent)]"
            : "shadow-floating dark:shadow-[0_2px_6px_color-mix(in_oklab,var(--shade)_20%,transparent),0_20px_48px_color-mix(in_oklab,var(--shade)_30%,transparent)]",
        )}
        style={{ width, height, borderRadius: radius }}
      >
        {/* The bar stays in flow so the resting surface sizes to it; search fades and blurs it away. */}
        <motion.div
          ref={barRef}
          className={cn("mx-auto flex w-max items-center", slim ? "h-11 gap-1 px-1.5" : "h-14 gap-1.5 pr-2 pl-2.5")}
          animate={
            searching
              ? reduced
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.96, filter: `blur(${blur.soft}px)` }
              : { opacity: 1, scale: 1, filter: "blur(0px)" }
          }
          transition={{ duration: searching ? 0.14 : motionTokens.duration.standard, ease: searching ? standard : enter }}
          inert={searching || undefined}
        >
          {logo && (
            <a
              href={logo.href ?? "#"}
              className={cn(
                "inline-flex h-9 flex-none cursor-pointer items-center rounded-full pl-1 text-base leading-body font-medium text-foreground outline-none",
                "transition-[padding] duration-200 ease-standard motion-reduce:transition-none",
                slim ? "pr-1" : "pr-2",
              )}
              aria-label={slim ? logo.name : undefined}
              onClick={event => {
                closeAll()
                navigate({ label: logo.name, href: logo.href }, event)
              }}
            >
              <span className="grid size-[26px] flex-none place-items-center [&_svg]:size-[26px]" aria-hidden="true">
                {logo.glyph}
              </span>
              {/* In the compact bar the name folds to nothing with a small blur instead of unmounting. */}
              <motion.span
                className="overflow-hidden whitespace-nowrap"
                initial={false}
                animate={
                  slim
                    ? { width: 0, opacity: 0, filter: reduced ? "blur(0px)" : `blur(${blur.subtle}px)` }
                    : { width: "auto", opacity: 1, filter: "blur(0px)" }
                }
                transition={reduced ? { duration: 0 } : { width: RESIZE, opacity: { duration: 0.16, ease: standard }, filter: { duration: 0.16, ease: standard } }}
                aria-hidden={slim || undefined}
              >
                <span className="block pl-2">{logo.name}</span>
              </motion.span>
            </a>
          )}

          <LayoutGroup id={`${uid}-items`}>
            <ul className="isolate flex items-center">
              {topItems.map((item, index) => {
                const panel = hasPanel(item)
                const open = openValue === item.id
                const isCurrent = page === item.id
                const common = {
                  "data-top": index,
                  className: cn(
                    "relative inline-flex cursor-pointer items-center gap-1 rounded-full leading-body font-normal whitespace-nowrap outline-none [-webkit-tap-highlight-color:transparent]",
                    "transition-[color] duration-160 ease-standard motion-reduce:transition-none",
                    slim ? "h-8 px-3" : "h-9 px-3.5",
                    itemText,
                    highlighted === item.id || isCurrent ? "text-foreground" : "text-text-secondary",
                  ),
                  onPointerEnter: onTopPointerEnter,
                  onFocus: () => setFocusedTop(item.id),
                  onBlur: () => setFocusedTop(value => (value === item.id ? null : value)),
                  onKeyDown: onTopKeyDownEvent,
                  onClick: onTopClickEvent,
                }
                const highlight = highlighted === item.id && (
                  <motion.span
                    layoutId="highlight"
                    className="absolute inset-0 -z-1 rounded-full bg-foreground/[0.045]"
                    transition={reduced ? { duration: 0 } : motionTokens.spring.morph}
                    aria-hidden="true"
                  />
                )
                return (
                  <li key={item.id}>
                    {panel ? (
                      <button
                        type="button"
                        id={triggerId(item.id)}
                        aria-expanded={open}
                        aria-controls={open ? panelId(item.id) : undefined}
                        aria-current={isCurrent ? "page" : undefined}
                        {...common}
                      >
                        {highlight}
                        {item.title}
                        <CaretDownIcon
                          className={cn("size-3.5 opacity-80 transition-transform duration-200 ease-standard motion-reduce:transition-none", open && "rotate-180")}
                          aria-hidden="true"
                        />
                      </button>
                    ) : (
                      <a id={triggerId(item.id)} href={item.href ?? "#"} aria-current={isCurrent ? "page" : undefined} {...common}>
                        {highlight}
                        {item.title}
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          </LayoutGroup>

          {search && (
            <button
              type="button"
              data-search-trigger=""
              aria-label="Search"
              aria-expanded={searching}
              className={cn(
                "grid flex-none cursor-pointer place-items-center rounded-full text-text-secondary outline-none transition-[background-color,color] duration-160 ease-standard pointer-fine:hover:bg-foreground/[0.045] pointer-fine:hover:text-foreground",
                slim ? "size-8" : "size-9",
              )}
              onClick={openSearch}
            >
              <MagnifyingGlassIcon className="size-4" aria-hidden="true" />
            </button>
          )}

          {cta &&
            (cta.href ? (
              <a
                href={cta.href}
                onClick={() => cta.onClick?.()}
                className={cn(
                  "inline-flex flex-none cursor-pointer items-center gap-1.5 rounded-full bg-foreground leading-body font-medium whitespace-nowrap text-background outline-none",
                  "transition-opacity duration-160 pointer-fine:hover:opacity-90",
                  slim ? "h-8 px-3 text-[13px]" : "h-9 px-4 text-sm",
                )}
              >
                {cta.icon}
                {cta.label}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => cta.onClick?.()}
                className={cn(
                  "inline-flex flex-none cursor-pointer items-center gap-1.5 rounded-full bg-foreground leading-body font-medium whitespace-nowrap text-background outline-none",
                  "transition-opacity duration-160 pointer-fine:hover:opacity-90",
                  slim ? "h-8 px-3 text-[13px]" : "h-9 px-4 text-sm",
                )}
              >
                {cta.icon}
                {cta.label}
              </button>
            ))}
        </motion.div>

        <AnimatePresence initial={false} custom={direction}>
          {openValue && (
            <PanelFace
              key={openValue}
              id={panelId(openValue)}
              value={openValue}
              direction={direction}
              reduced={reduced}
              labelledBy={triggerId(openValue)}
              onSize={onPanelSize}
              onKeyDown={onPanelKeyDown}
              onClick={onPanelClick}
            >
              {renderPanel(openValue)}
            </PanelFace>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {searching && search && (
            <SearchFace key="search" reduced={reduced} onSize={onSearchSize}>
              <div className={cn("flex items-center gap-2.5 pr-2 pl-[18px]", slim ? "h-11" : "h-[54px]")}>
                <MagnifyingGlassIcon className="size-[17px] flex-none text-text-muted" aria-hidden="true" />
                <input
                  data-search-input=""
                  role="combobox"
                  aria-expanded
                  aria-controls={listboxId}
                  aria-autocomplete="list"
                  aria-activedescendant={results.length ? resultId(active) : undefined}
                  aria-label="Search"
                  placeholder={search.placeholder ?? "Search"}
                  className="h-full min-w-0 flex-1 bg-transparent text-base leading-body text-foreground outline-none placeholder:text-text-muted sm:text-sm"
                  value={query}
                  onChange={event => {
                    setQuery(event.target.value)
                    setActiveResult(0)
                  }}
                  onKeyDown={onSearchKeyDown}
                />
                <button
                  type="button"
                  aria-label="Close search"
                  className="grid size-[35px] flex-none cursor-pointer place-items-center rounded-full text-text-muted outline-none transition-[background-color,color] duration-160 ease-standard pointer-fine:hover:bg-foreground/[0.045] pointer-fine:hover:text-foreground"
                  onClick={() => closeAll("[data-search-trigger]")}
                >
                  <XIcon className="size-4" aria-hidden="true" />
                </button>
              </div>
              <LayoutGroup id={`${uid}-results`}>
                <div id={listboxId} role="listbox" aria-label="Search results" className="isolate border-t border-border-subtle p-2 pb-3">
                  {results.length === 0 ? (
                    <p className="px-2.5 py-6 text-center text-sm text-text-muted">No results for “{query.trim()}”</p>
                  ) : (
                    groups.map(([group, entries], groupIndex) => (
                      <div key={group} role="group" aria-labelledby={`${uid}-group-${groupIndex}`} className="flex flex-col">
                        <span id={`${uid}-group-${groupIndex}`} className="px-3 pt-3 pb-2 text-xs leading-body text-text-muted">
                          {group}
                        </span>
                        {entries.map(({ item, index }) => (
                          <motion.div
                            key={`${item.label}-${index}`}
                            id={resultId(index)}
                            role="option"
                            aria-selected={index === active}
                            className="relative flex cursor-pointer items-center gap-3 rounded-[14px] px-3 py-[9px]"
                            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: motionTokens.duration.standard, ease: enter, delay: reduced ? 0 : index * motionTokens.stagger.item }}
                            data-index={index}
                            onPointerMove={onResultPointerMove}
                            onPointerDown={event => event.preventDefault()}
                            onClick={onResultClick}
                          >
                            {index === active && (
                              <motion.span
                                layoutId="result"
                                className="absolute inset-0 -z-1 rounded-[inherit] bg-foreground/[0.045]"
                                transition={reduced ? { duration: 0 } : motionTokens.spring.morph}
                                aria-hidden="true"
                              />
                            )}
                            {item.icon && (
                              <span className="grid size-5 flex-none place-items-center text-text-secondary [&_svg]:size-5" aria-hidden="true">
                                {item.icon}
                              </span>
                            )}
                            <span className="flex min-w-0 flex-1 flex-col gap-px">
                              <span className="truncate text-sm leading-body font-medium text-foreground">{item.label}</span>
                              {item.description && <span className="truncate text-xs leading-body text-text-muted">{item.description}</span>}
                            </span>
                            {suggested && item.group && <span className="flex-none text-xs leading-body text-text-muted">{item.group}</span>}
                          </motion.div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </LayoutGroup>
            </SearchFace>
          )}
        </AnimatePresence>
      </motion.div>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </nav>
  )
}

export default FluidHeader
