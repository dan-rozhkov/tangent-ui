"use client"

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react"
import { AnimatePresence, animate, motion, useMotionValue, useSpring, useTransform } from "motion/react"
import type { Variants } from "motion/react"

import { useMotionTokens } from "@/lib/motion-tokens-context"
import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface LiquidTab {
  value: string
  label: string
  icon: ReactNode
  /** A rolling count. */
  badge?: number
  /** What screen readers hear with the badge, such as "2 new". */
  badgeLabel?: string
}

export interface LiquidTabBarProps {
  tabs: LiquidTab[]
  value: string
  onValueChange: (value: string) => void
  /** Which tabs show their label: the selected one, every tab, or none. */
  labels?: "active" | "always" | "none"
  /** Accessible name of the tab list. */
  label?: string
  /** Base id for tab and panel ids. */
  id?: string
  className?: string
}

export const liquidTabId = (id: string, value: string) => `${id}-tab-${value}`
export const liquidPanelId = (id: string, value: string) => `${id}-panel-${value}`

/* Geometry, in px: 40px tabs sit 4px inside a 48px bar with 2px between them. An icon-only tab is 44 wide (12 + 20 + 12);
   an open one puts its label 40px in and ends 14px after it. */
const SLOT = 44
const LABEL_START = 40
const LABEL_END = 14
const PAD = 4
const GAP = 2
const TAB = 40
/** The lens thins while it travels, up to this inset on each side (measured ~1.4px for a two-tab jump). */
const MAX_THIN = 3
/** Px of thinning per px/s of lens speed. */
const THIN_PER_SPEED = 0.0034
const LEAN = 6
const inOut = [...motionTokens.ease.inOut] as [number, number, number, number]

/** The leading edge races ahead with ~1.8% of overshoot and lands in ~280ms; the trailing edge follows critically damped. */
const leading = { type: "spring", visualDuration: 0.35, bounce: 0.2 } as const

function RollingNumber({ value, reduced }: { value: number; reduced: boolean }) {
  const motionTokens = useMotionTokens()
  const [state, setState] = useState({ value, direction: 1 })
  if (state.value !== value) setState({ value, direction: value > state.value ? 1 : -1 })
  const digits = String(value).split("")
  const variants: Variants = {
    from: (direction: number) => (reduced ? { opacity: 0 } : { y: direction > 0 ? "100%" : "-100%", opacity: 0 }),
    at: { y: 0, opacity: 1 },
    to: (direction: number) => (reduced ? { opacity: 0 } : { y: direction > 0 ? "-100%" : "100%", opacity: 0 }),
  }
  return (
    <span className="inline-flex tabular-nums">
      {digits.map((digit, index) => (
        <span key={digits.length - index} className="relative inline-grid overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout" custom={state.direction}>
            <motion.span
              key={digit}
              custom={state.direction}
              variants={variants}
              initial="from"
              animate="at"
              exit="to"
              transition={reduced ? { duration: motionTokens.duration.instant } : motionTokens.spring.snappy}
            >
              {digit}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  )
}

/**
 * Horizontal navigation for a handful of peer sections. The selection is a liquid lens: an inverted copy of the tabs clipped
 * to a pill whose two edges ride different springs, so it stretches toward the new tab and thins while it stretches.
 */
export function LiquidTabBar({ tabs, value, onValueChange, labels = "active", label = "Sections", id, className }: LiquidTabBarProps) {
  const motionTokens = useMotionTokens()
  const trailing = motionTokens.spring.smooth
  const reduced = useReducedMotion() ?? false
  const generated = useId()
  const baseId = id ?? generated
  const list = useRef<HTMLDivElement>(null)
  const measureRow = useRef<HTMLSpanElement>(null)
  const [labelWidths, setLabelWidths] = useState<Record<string, number> | null>(null)
  const selectedIndex = Math.max(0, tabs.findIndex((tab) => tab.value === value))

  // Label widths come from hidden copies, so every slot knows its open width before it springs there.
  const tabsKey = tabs.map((tab) => `${tab.value}\u0000${tab.label}`).join("\u0001")
  useEffect(() => {
    const row = measureRow.current
    if (!row || typeof ResizeObserver === "undefined") return
    const read = () => {
      const next: Record<string, number> = {}
      row.querySelectorAll<HTMLElement>("[data-measure]").forEach((node) => {
        next[node.dataset.measure ?? ""] = Math.ceil(node.getBoundingClientRect().width)
      })
      setLabelWidths(next)
    }
    const observer = new ResizeObserver(read)
    observer.observe(row)
    return () => observer.disconnect()
  }, [tabsKey])

  const showsLabel = useCallback(
    (index: number) => labels === "always" || (labels === "active" && index === selectedIndex),
    [labels, selectedIndex],
  )
  const widthOf = useCallback(
    (index: number) => {
      const tab = tabs[index]
      const text = labelWidths?.[tab.value] ?? 0
      return showsLabel(index) && text ? Math.max(SLOT, LABEL_START + text + LABEL_END) : SLOT
    },
    [labelWidths, showsLabel, tabs],
  )
  const geometry = useCallback(
    (index: number) => {
      let left = 0
      for (let i = 0; i < index; i++) left += widthOf(i) + GAP
      return { left, right: left + widthOf(index) }
    },
    [widthOf],
  )

  /* ---------- lens ---------- */
  const left = useMotionValue(0)
  const right = useMotionValue(SLOT)
  const rest = useMotionValue(SLOT)
  const lean = useSpring(0, motionTokens.spring.snappy)
  const placed = useRef(false)
  const stretchy = useMotionValue(!reduced)
  useEffect(() => {
    stretchy.set(!reduced)
    if (reduced) lean.jump(0)
  }, [lean, reduced, stretchy])
  const drag = useRef<{
    pointer: number
    start: number
    center: number
    width: number
    moved: boolean
    samples: { x: number; t: number }[]
  } | null>(null)
  // A drag ends in a click on the tab it started from; that click must not undo the throw.
  const dragged = useRef(false)

  // Declared before the settle effect on purpose: useTransform re-subscribes to its inputs in a layout effect on every
  // render, and React runs a component's layout effects in order, so a jump made by an earlier effect would land while
  // the clip path is unsubscribed and the lens would keep its old shape.
  // The lens thins while it travels: speed drives the inset through a short spring, so the thinnest point lands mid-flight
  // and the lens is full height again as it settles. A drag stretches it instead, and stretch thins it too.
  const speedThin = useMotionValue(0)
  useEffect(() => {
    const update = () => {
      if (!stretchy.get()) return speedThin.set(0)
      const moving = left.isAnimating() || right.isAnimating()
      const speed = moving ? Math.abs(left.getVelocity() + right.getVelocity()) / 2 : 0
      const stretch = Math.max(0, right.get() - left.get() - rest.get())
      speedThin.set(Math.min(MAX_THIN, Math.max(speed * THIN_PER_SPEED, stretch / 14)))
    }
    const off = [
      left.on("change", update),
      right.on("change", update),
      rest.on("change", update),
      left.on("animationComplete", update),
      right.on("animationComplete", update),
    ]
    return () => off.forEach((stop) => stop())
  }, [left, rest, right, speedThin, stretchy])
  const thin = useSpring(speedThin, { visualDuration: 0.18, bounce: 0 })
  // Insets are measured from the bar's edges; the radius is always half the lens height.
  const clipPath = useTransform(() => {
    const leanBy = lean.get()
    const l = left.get() + (leanBy < 0 ? leanBy : leanBy * 0.3)
    const r = right.get() + (leanBy > 0 ? leanBy : leanBy * 0.3)
    const by = Math.max(0, thin.get())
    const radius = TAB / 2 - by
    return `inset(${PAD + by}px calc(100% - ${PAD + r}px) ${PAD + by}px ${PAD + l}px round ${radius}px)`
  })

  const settle = useCallback(
    (index: number) => {
      if (!labelWidths || !tabs[index]) return
      const target = geometry(index)
      // The pointer that picked this tab now rests on it, so drop any lean toward it.
      lean.set(0)
      rest.jump(target.right - target.left)
      if (!placed.current || reduced) {
        left.jump(target.left)
        right.jump(target.right)
        placed.current = true
        return
      }
      const currentCenter = (left.get() + right.get()) / 2
      const toRight = (target.left + target.right) / 2 >= currentCenter
      animate(left, target.left, toRight ? trailing : leading)
      animate(right, target.right, toRight ? leading : trailing)
    },
    [geometry, labelWidths, lean, left, reduced, rest, right, tabs, trailing],
  )

  useLayoutEffect(() => {
    if (!drag.current?.moved) settle(selectedIndex)
  }, [selectedIndex, settle])

  /* ---------- drag and throw ---------- */
  const centers = () => tabs.map((_, index) => {
    const g = geometry(index)
    return (g.left + g.right) / 2
  })

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    dragged.current = false
    if (index !== selectedIndex || event.button !== 0 || !labelWidths) return
    const g = geometry(index)
    drag.current = {
      pointer: event.pointerId,
      start: event.clientX,
      center: (left.get() + right.get()) / 2,
      width: g.right - g.left,
      moved: false,
      samples: [{ x: event.clientX, t: event.timeStamp }],
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current
    if (!state || state.pointer !== event.pointerId) return
    const dx = event.clientX - state.start
    if (!state.moved && Math.abs(dx) < 4) return
    state.moved = true
    state.samples.push({ x: event.clientX, t: event.timeStamp })
    if (state.samples.length > 6) state.samples.shift()
    const all = centers()
    const min = all[0]
    const max = all[all.length - 1]
    let center = state.center + dx
    // Past either end the lens resists, travelling a third of the pointer.
    if (center < min) center = min - (min - center) / 3
    if (center > max) center = max + (center - max) / 3
    left.stop()
    right.stop()
    left.jump(center - state.width / 2)
    right.jump(center + state.width / 2)
    rest.jump(state.width)
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current
    if (!state || state.pointer !== event.pointerId) return
    drag.current = null
    if (!state.moved) return
    dragged.current = true
    // Touch drags end without a click, so the guard only lives until the click that would follow this release.
    window.setTimeout(() => {
      dragged.current = false
    }, 0)
    const first = state.samples[0]
    const last = state.samples[state.samples.length - 1]
    const elapsed = Math.max(1, last.t - first.t) / 1000
    const velocity = (last.x - first.x) / elapsed
    const center = (left.get() + right.get()) / 2
    const projected = center + velocity * 0.18
    const all = centers()
    let index = 0
    all.forEach((c, i) => {
      if (Math.abs(c - projected) < Math.abs(all[index] - projected)) index = i
    })
    // A quick flick always moves at least one tab.
    if (index === selectedIndex && Math.abs(velocity) > 380) index = Math.min(tabs.length - 1, Math.max(0, selectedIndex + Math.sign(velocity)))
    if (index !== selectedIndex) onValueChange(tabs[index].value)
    else settle(selectedIndex)
  }

  /* ---------- keyboard and hover ---------- */
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = tabs.length - 1
    const target =
      event.key === "ArrowRight"
        ? selectedIndex === last
          ? 0
          : selectedIndex + 1
        : event.key === "ArrowLeft"
          ? selectedIndex === 0
            ? last
            : selectedIndex - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1
    if (target < 0 || !tabs[target]) return
    event.preventDefault()
    onValueChange(tabs[target].value)
    document.getElementById(liquidTabId(baseId, tabs[target].value))?.focus()
  }

  // The lens leans toward a hovered tab, mouse only.
  const onHover = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType !== "mouse" || drag.current?.moved) return
    const tab = (event.target as HTMLElement).closest<HTMLElement>("[data-index]")
    const index = tab ? Number(tab.dataset.index) : selectedIndex
    lean.set(index === selectedIndex ? 0 : Math.sign(index - selectedIndex) * LEAN)
  }

  // Measured: tab widths follow on a critically damped spring, ~560ms to settle with no overshoot.
  const widthTransition = reduced ? { duration: 0 } : motionTokens.spring.smooth

  const renderRow = (inverted: boolean) =>
    tabs.map((tab, index) => {
      const open = showsLabel(index)
      const badge = tab.badge ? (
        <span
          className={cn(
            "absolute top-[3px] left-[22px] inline-flex h-4 min-w-[17px] items-center justify-center rounded-pill px-[5px] text-[11px] leading-none font-medium",
            inverted ? "bg-background text-foreground" : "bg-foreground text-background",
          )}
        >
          <RollingNumber value={tab.badge} reduced={reduced} />
        </span>
      ) : null
      const content = (
        <>
          <span className="relative flex h-10 w-10 flex-none items-center pl-3 [&_svg]:size-5">
            {/* The lens shows the same icon, only recoloured by its inverted text colour. */}
            {tab.icon}
            {badge}
          </span>
          {/* Measured: the outgoing label is gone by ~210ms; the incoming one starts ~60ms later and lands by ~280ms. No blur. */}
          <motion.span
            className="text-sm font-medium whitespace-nowrap"
            style={{ paddingRight: LABEL_END }}
            initial={false}
            animate={{ opacity: open ? 1 : 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : open
                  ? { delay: 0.06, duration: 0.24, ease: "easeOut" }
                  : { duration: 0.21, ease: inOut }
            }
          >
            {tab.label}
          </motion.span>
        </>
      )
      const width = labelWidths ? widthOf(index) : undefined
      // Motion skips the first width it is handed after mount, so a tab keeps its natural width until the next change.
      // Mounting again once measured lets initial={false} start every tab at its measured width.
      const key = `${tab.value}${labelWidths ? "" : "-unmeasured"}`
      if (inverted) {
        return (
          <motion.span
            key={key}
            className="flex h-10 flex-none items-center overflow-hidden text-background"
            initial={false}
            animate={width === undefined ? undefined : { width }}
            transition={widthTransition}
          >
            {content}
          </motion.span>
        )
      }
      const selected = index === selectedIndex
      return (
        <motion.button
          key={key}
          id={liquidTabId(baseId, tab.value)}
          type="button"
          role="tab"
          data-index={index}
          aria-selected={selected}
          aria-controls={liquidPanelId(baseId, tab.value)}
          aria-label={tab.badge ? `${tab.label}, ${tab.badgeLabel ?? tab.badge}` : tab.label}
          tabIndex={selected ? 0 : -1}
          className={cn(
            "flex h-10 flex-none cursor-pointer items-center overflow-hidden rounded-pill border-0 bg-transparent p-0 text-text-secondary outline-none",
            "transition-[color] duration-160 ease-standard motion-reduce:transition-none [-webkit-tap-highlight-color:transparent]",
            "pointer-fine:hover:text-foreground",
            selected && "cursor-grab active:cursor-grabbing",
          )}
          initial={false}
          animate={width === undefined ? undefined : { width }}
          transition={widthTransition}
          onClick={() => {
            if (dragged.current) dragged.current = false
            else if (!selected) onValueChange(tab.value)
          }}
          onKeyDown={onKeyDown}
          onPointerDown={(event) => onPointerDown(event, index)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {content}
        </motion.button>
      )
    })

  return (
    <div
      ref={list}
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      className={cn(
        "relative isolate inline-flex max-w-full gap-0.5 rounded-pill bg-surface-muted shadow-[inset_0_0_0_1px_var(--border-subtle)] [touch-action:pan-y] select-none",
        className,
      )}
      style={{ padding: PAD }}
      onPointerMove={onHover}
      onPointerLeave={() => lean.set(0)}
    >
      {renderRow(false)}
      {/* The lens: an inverted copy of the tabs over the whole bar, clipped to the selection. Decorative, the real tabs sit
          underneath. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex gap-0.5 rounded-pill bg-foreground"
        style={{ padding: PAD, clipPath, WebkitClipPath: clipPath, opacity: labelWidths ? 1 : 0 }}
      >
        {renderRow(true)}
      </motion.div>
      <span ref={measureRow} aria-hidden="true" className="pointer-events-none invisible absolute top-0 left-0 flex w-max">
        {tabs.map((tab) => (
          <span key={tab.value} data-measure={tab.value} className="text-sm font-medium whitespace-nowrap">
            {tab.label}
          </span>
        ))}
      </span>
    </div>
  )
}

export default LiquidTabBar
