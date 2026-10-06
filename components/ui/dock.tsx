"use client"

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { ComponentProps, FocusEvent, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react"
import { AnimatePresence, LayoutGroup, Reorder, animate, motion, useMotionValue, useIsPresent, useReducedMotion, useTransform } from "motion/react"
import type { Variants } from "motion/react"

import { motionTokens as presets } from "@/lib/motion-tokens"
import { useMotionTokens, type MotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"

export interface DockItem {
  id: string
  label: string
  icon: ReactNode
  /** Display-only key hint. The page binds the key. */
  shortcut?: string
  /** A rolling count that leaves at 0. */
  badge?: number
  /** Turns the entry into a group with a tray. */
  items?: DockItem[]
}

export interface DockMove {
  type: "move"
  id: string
  index: number
}

export interface DockProps {
  items: DockItem[]
  value?: string | null
  onValueChange?: (id: string) => void
  /** Enables drag to reorder and Alt with the arrow keys. */
  onItemsChange?: (items: DockItem[], change: DockMove) => void
  /** Accessible name of the toolbar. */
  label?: string
  className?: string
}

// Measured: the first label waits ~380ms, then follows hovers at once while warm.
const LABEL_DELAY = 380
const LABEL_WARM = 320
const enter = [...presets.ease.enter] as [number, number, number, number]
const standard = [...presets.ease.standard] as [number, number, number, number]

/* Geometry, in px. Slots are 44 with a 2px gap inside 6px of padding; tray members are one step smaller. */
const PAD = 6
const GAP = 2
const SLOT = 44
const MEMBER = 40
const BAR_RADIUS = 22
const TAB_RADIUS = 12
const FILLET = 12
const STROKE = 1

/** The selection glides with about 1% of overshoot and lands in ~300ms, a touch livelier than morph. */
const selectionSpring = { type: "spring", visualDuration: 0.3, bounce: 0.18 } as const

const isGroup = (item: DockItem) => !!item.items?.length
const holds = (item: DockItem, value: string | null | undefined) =>
  value != null && (item.id === value || !!item.items?.some((member) => member.id === value))

function accessibleName(label: string, shortcut?: string, badge?: number) {
  return [label, shortcut, badge ? String(badge) : null].filter(Boolean).join(", ")
}

const barWidth = (count: number) => count * SLOT + Math.max(0, count - 1) * GAP + PAD * 2
const BAR_HEIGHT = SLOT + PAD * 2
const trayWidth = (count: number) => count * MEMBER + Math.max(0, count - 1) * GAP + PAD * 2
const TRAY_HEIGHT = MEMBER + PAD * 2

/**
 * One outline for the bar and its tray tab, so both share a fill and a stroke with no seam. The tab rises out of the
 * straight part of the top edge: concave fillets where it leaves the bar, rounded outer corners on top. Radii shrink
 * with the tab while it is short so the curve never folds over itself. `top` is the tab's top edge; at the bar's top
 * edge the tab is flat and the path is the plain pill.
 */
function dockPath(width: number, height: number, left: number, right: number, top: number) {
  const h = STROKE / 2
  const x0 = h
  const y0 = h
  const x1 = Math.max(x0, width - h)
  const y1 = Math.max(y0, height - h)
  const r = Math.max(0, Math.min(BAR_RADIUS - h, (x1 - x0) / 2, (y1 - y0) / 2))
  const rise = Math.max(0, y0 - top)
  const l = Math.max(x0 + r, Math.min(left, x1 - r))
  const rt = Math.max(l, Math.min(right, x1 - r))
  const k = Math.min(1, rise / (TAB_RADIUS + FILLET))
  const fl = Math.min(FILLET * k, l - (x0 + r))
  const fr = Math.min(FILLET * k, x1 - r - rt)
  const ro = Math.min(TAB_RADIUS * k, (rt - l) / 2)
  const t = y0 - rise
  const f = (n: number) => Math.round(n * 100) / 100
  const tab =
    rise > 0.01
      ? `L${f(l - fl)} ${f(y0)} Q${f(l)} ${f(y0)} ${f(l)} ${f(y0 - fl)} L${f(l)} ${f(t + ro)} Q${f(l)} ${f(t)} ${f(l + ro)} ${f(t)} ` +
        `L${f(rt - ro)} ${f(t)} Q${f(rt)} ${f(t)} ${f(rt)} ${f(t + ro)} L${f(rt)} ${f(y0 - fr)} Q${f(rt)} ${f(y0)} ${f(rt + fr)} ${f(y0)} `
      : ""
  return (
    `M${f(x0 + r)} ${f(y0)} ${tab}L${f(x1 - r)} ${f(y0)} Q${f(x1)} ${f(y0)} ${f(x1)} ${f(y0 + r)} L${f(x1)} ${f(y1 - r)} ` +
    `Q${f(x1)} ${f(y1)} ${f(x1 - r)} ${f(y1)} L${f(x0 + r)} ${f(y1)} Q${f(x0)} ${f(y1)} ${f(x0)} ${f(y1 - r)} L${f(x0)} ${f(y0 + r)} ` +
    `Q${f(x0)} ${f(y0)} ${f(x0 + r)} ${f(y0)} Z`
  )
}

/** Digits roll up when the count grows and down when it shrinks; each place rolls on its own. */
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

function Badge({ count, reduced }: { count?: number; reduced: boolean }) {
  const motionTokens = useMotionTokens()
  return (
    <AnimatePresence initial={false}>
      {count ? (
        <motion.span
          key="badge"
          aria-hidden="true"
          className="pointer-events-none absolute top-[3px] left-[26px] z-2 inline-flex h-4 min-w-[17px] items-center justify-center rounded-pill bg-foreground px-[5px] text-[11px] leading-none font-medium text-background"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4, transition: { duration: motionTokens.duration.fast, ease: standard } }}
          transition={reduced ? { duration: motionTokens.duration.instant } : motionTokens.spring.snappy}
        >
          <RollingNumber value={count} reduced={reduced} />
        </motion.span>
      ) : null}
    </AnimatePresence>
  )
}

/** The icon swaps with a small blur when a group shows a different member. */
function Glyph({ id, icon, reduced }: { id: string; icon: ReactNode; reduced: boolean }) {
  const motionTokens = useMotionTokens()
  return (
    <span className="relative grid size-5 place-items-center [&_svg]:size-5">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={id}
          className="grid place-items-center"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: `blur(${motionTokens.blur.subtle}px)` }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: motionTokens.duration.instant } }
              : { opacity: 0, scale: 0.6, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast, ease: standard } }
          }
          transition={reduced ? { duration: motionTokens.duration.instant } : motionTokens.spring.snappy}
        >
          {icon}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

const slotClass = [
  "relative grid flex-none cursor-pointer place-items-center border-0 bg-transparent text-text-secondary outline-none",
  "transition-[color] duration-160 ease-standard motion-reduce:transition-none [-webkit-tap-highlight-color:transparent]",
  "pointer-fine:hover:not-data-selected:text-foreground",
].join(" ")

// The tray fades in as a whole a beat after the tab starts to rise; members follow on the item stagger.
function makeVariants(motionTokens: MotionTokens) {
  const trayVariants: Variants = {
    closed: { opacity: 0, transition: { duration: motionTokens.duration.instant, ease: standard } },
    open: { opacity: 1, transition: { duration: motionTokens.duration.fast, delay: 0.11, ease: "linear" } },
  }
  const memberVariants: Variants = {
    closed: { opacity: 0, y: 6, transition: { duration: motionTokens.duration.instant } },
    open: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: { ...motionTokens.spring.snappy, delay: 0.09 + index * motionTokens.stagger.item },
    }),
  }
  const fadeVariants: Variants = {
    closed: { opacity: 0, transition: { duration: motionTokens.duration.instant } },
    open: { opacity: 1, transition: { duration: motionTokens.duration.fast } },
  }
  return { trayVariants, memberVariants, fadeVariants }
}

/**
 * A floating command dock. A label glides between items, a selection springs to the chosen one, and groups grow a tray out
 * of the dock surface: bar and tray tab are one SVG outline whose tab rises from the top edge. Only the focused item is a
 * tab stop; arrows move along the dock, ArrowUp enters a group's tray.
 */
export function Dock({ items, value = null, onValueChange, onItemsChange, label = "Tools", className }: DockProps) {
  const motionTokens = useMotionTokens()
  const { trayVariants, memberVariants, fadeVariants } = useMemo(() => makeVariants(motionTokens), [motionTokens])
  const reduced = useReducedMotion() ?? false
  const uid = useId()
  const root = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const nodes = useRef(new Map<string, HTMLButtonElement>())
  const pendingFocus = useRef<string | null>(null)
  const dragging = useRef<string | null>(null)
  const justDragged = useRef(false)

  const [tabStop, setTabStop] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  // The last opened group: the tab folds back over its slot after the tray closes.
  const [trayId, setTrayId] = useState<string | null>(null)
  const [trayStop, setTrayStop] = useState<string | null>(null)
  const [remembered, setRemembered] = useState<Record<string, string>>({})
  const [lifted, setLifted] = useState<string | null>(null)

  const trayGroup = items.find((item) => item.id === trayId && isGroup(item)) ?? null
  const open = !!openId && trayGroup?.id === openId
  const trayDomId = `${uid}-tray`

  const shownMember = useCallback(
    (group: DockItem) => {
      const members = group.items ?? []
      return members.find((member) => member.id === value) ?? members.find((member) => member.id === remembered[group.id]) ?? members[0]
    },
    [remembered, value],
  )

  const stop = items.some((item) => item.id === tabStop) ? tabStop : (items.find((item) => holds(item, value)) ?? items[0])?.id
  const trayFocusId = trayGroup
    ? ((trayGroup.items ?? []).some((member) => member.id === trayStop) ? trayStop : shownMember(trayGroup)?.id)
    : null

  // Focus lands after the render that makes its target focusable (the tray mounts on open).
  useLayoutEffect(() => {
    const key = pendingFocus.current
    if (!key) return
    pendingFocus.current = null
    nodes.current.get(key)?.focus({ preventScroll: true })
  })

  const register = (key: string) => (node: HTMLButtonElement | null) => {
    if (node) nodes.current.set(key, node)
    else nodes.current.delete(key)
  }
  const focusLater = (key: string) => {
    pendingFocus.current = key
  }

  /* ---------- floating label ---------- */
  const labelX = useMotionValue(0)
  const labelY = useMotionValue(0)
  const [labelKey, setLabelKey] = useState<string | null>(null)
  const [labelShown, setLabelShown] = useState(false)
  const labelTimer = useRef(0)
  const warmUntil = useRef(0)
  const hoverKey = useRef<string | null>(null)
  const focusKey = useRef<string | null>(null)

  const labelFor = useCallback(
    (key: string | null): { text: string; shortcut?: string } | null => {
      if (!key) return null
      const [scope, id] = key.split(":")
      if (scope === "bar") {
        const item = items.find((entry) => entry.id === id)
        if (!item) return null
        if (isGroup(item)) {
          const member = shownMember(item)
          return { text: member ? `${item.label}: ${member.label}` : item.label, shortcut: member?.shortcut }
        }
        return { text: item.label, shortcut: item.shortcut }
      }
      const member = trayGroup?.items?.find((entry) => entry.id === id)
      return member ? { text: member.label, shortcut: member.shortcut } : null
    },
    [items, shownMember, trayGroup],
  )

  /** Pointer wins over keyboard focus. The first label waits a beat; while warm the next follows at once. */
  const updateLabel = useCallback(() => {
    const next = dragging.current ? null : (hoverKey.current ?? focusKey.current)
    window.clearTimeout(labelTimer.current)
    if (!next) {
      setLabelShown((shown) => {
        if (shown) warmUntil.current = performance.now() + LABEL_WARM
        return false
      })
      return
    }
    setLabelKey(next)
    if (performance.now() < warmUntil.current) setLabelShown(true)
    else labelTimer.current = window.setTimeout(() => setLabelShown(true), LABEL_DELAY)
  }, [])

  useEffect(() => () => window.clearTimeout(labelTimer.current), [])

  // A group's label would sit right over its own open tray and cover the members, so it stays hidden while that tray is
  // open and returns when it folds.
  const labelOn = labelShown && !(open && labelKey === `bar:${openId}`)

  const labelVisible = useRef(false)
  const placeLabel = useCallback(() => {
    const host = root.current
    const node = labelKey ? nodes.current.get(labelKey) : undefined
    if (!host || !node) return
    const outer = host.getBoundingClientRect()
    const box = node.getBoundingClientRect()
    const x = box.left - outer.left + box.width / 2
    // The label floats 10px over the surface the item sits on: the bar, or the tray when it is a member.
    const y = box.top - outer.top - PAD - 10
    if (labelVisible.current && labelOn && !reduced) {
      animate(labelX, x, motionTokens.spring.snappy)
      animate(labelY, y, motionTokens.spring.snappy)
    } else {
      labelX.jump(x)
      labelY.jump(y)
    }
    labelVisible.current = labelOn
  }, [labelKey, labelOn, labelX, labelY, motionTokens.spring.snappy, reduced])

  useLayoutEffect(() => {
    placeLabel()
    if (!labelOn) labelVisible.current = false
  }, [placeLabel, labelOn, open])

  const label$ = labelFor(labelKey)

  /* ---------- surface ---------- */
  // The bar and the tray tab are one SVG outline. Its size starts from the item count so the first paint has a body.
  const surfaceW = useMotionValue(barWidth(items.length))
  const surfaceH = useMotionValue(BAR_HEIGHT)
  const tabLeft = useMotionValue(0)
  const tabRight = useMotionValue(0)
  const tabTop = useMotionValue(STROKE / 2)
  const outline = useTransform([surfaceW, surfaceH, tabLeft, tabRight, tabTop], ([w, h, l, r, t]: number[]) =>
    dockPath(w, h, l, r, t),
  )
  const [trayLeft, setTrayLeft] = useState(0)
  const trayCount = trayGroup?.items?.length ?? 0

  const placeTray = useCallback(() => {
    const host = root.current
    const strip = bar.current
    if (!host || !strip) return
    const width = strip.offsetWidth
    surfaceW.set(width)
    surfaceH.set(strip.offsetHeight)
    const node = trayId ? nodes.current.get(`bar:${trayId}`) : undefined
    if (!node || !trayCount) return
    const outer = host.getBoundingClientRect()
    const box = node.getBoundingClientRect()
    const slotLeft = box.left - outer.left
    const slotRight = slotLeft + box.width
    // The tray centres on its group but keeps clear of the bar's corners so the fillets land on the straight edge.
    const tw = trayWidth(trayCount)
    const min = BAR_RADIUS + FILLET
    const max = width - BAR_RADIUS - FILLET - tw
    const centred = slotLeft + box.width / 2 - tw / 2
    const left = max >= min ? Math.min(Math.max(centred, min), max) : (width - tw) / 2
    setTrayLeft(left)

    const half = STROKE / 2
    const flat = tabTop.get() >= half - 0.01
    const target = open
      ? { l: left + half, r: left + tw - half, t: half - TRAY_HEIGHT }
      : { l: slotLeft, r: slotRight, t: half }
    // A closed tab rests flat over its group slot, so opening grows it out of that slot.
    if (flat) {
      tabLeft.jump(slotLeft)
      tabRight.jump(slotRight)
    }
    if (reduced || (flat && !open)) {
      tabLeft.jump(target.l)
      tabRight.jump(target.r)
      tabTop.jump(target.t)
      return
    }
    // Measured: the tab grows on morph (top overshoots ~0.2px, settles ~600ms); folding is critically damped.
    const spring = open ? motionTokens.spring.morph : motionTokens.spring.smooth
    animate(tabLeft, target.l, spring)
    animate(tabRight, target.r, spring)
    animate(tabTop, target.t, spring)
  }, [motionTokens.spring.morph, motionTokens.spring.smooth, open, reduced, surfaceH, surfaceW, tabLeft, tabRight, tabTop, trayCount, trayId])
  useLayoutEffect(() => {
    placeTray()
  }, [placeTray, items])

  // One observer on the bar keeps the tray and label anchored when the dock reflows.
  useEffect(() => {
    const node = bar.current
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      placeTray()
      placeLabel()
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [placeLabel, placeTray])

  // A pointer down outside the dock closes an open tray.
  useEffect(() => {
    if (!openId) return
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpenId(null)
    }
    document.addEventListener("pointerdown", onDown, true)
    return () => document.removeEventListener("pointerdown", onDown, true)
  }, [openId])

  /* ---------- actions ---------- */
  const openTray = (group: DockItem) => {
    setTrayId(group.id)
    setOpenId(group.id)
    setTrayStop(shownMember(group)?.id ?? null)
  }

  const choose = (item: DockItem) => {
    if (justDragged.current) return
    setTabStop(item.id)
    if (!isGroup(item)) {
      setOpenId(null)
      onValueChange?.(item.id)
      return
    }
    const member = shownMember(item)
    if (member) onValueChange?.(member.id)
    if (openId === item.id) setOpenId(null)
    else openTray(item)
  }

  const chooseMember = (group: DockItem, member: DockItem) => {
    setRemembered((current) => ({ ...current, [group.id]: member.id }))
    onValueChange?.(member.id)
    setOpenId(null)
    setTabStop(group.id)
    focusLater(`bar:${group.id}`)
  }

  const move = (index: number, delta: number) => {
    if (!onItemsChange) return
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = items.slice()
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    onItemsChange(next, { type: "move", id: moved.id, index: target })
    focusLater(`bar:${moved.id}`)
  }

  const onBarKey = (event: KeyboardEvent<HTMLButtonElement>, item: DockItem, index: number) => {
    const last = items.length - 1
    let target = -1
    if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      if (!onItemsChange) return
      event.preventDefault()
      move(index, event.key === "ArrowLeft" ? -1 : 1)
      return
    }
    if (event.key === "ArrowRight") target = index === last ? 0 : index + 1
    else if (event.key === "ArrowLeft") target = index === 0 ? last : index - 1
    else if (event.key === "Home") target = 0
    else if (event.key === "End") target = last
    else if (event.key === "ArrowUp" && isGroup(item)) {
      event.preventDefault()
      openTray(item)
      focusLater(`tray:${shownMember(item)?.id}`)
      return
    } else if (event.key === "Escape" && openId) {
      event.preventDefault()
      setOpenId(null)
      return
    }
    if (target < 0) return
    event.preventDefault()
    setTabStop(items[target].id)
    if (openId && items[target].id !== openId) setOpenId(null)
    nodes.current.get(`bar:${items[target].id}`)?.focus()
  }

  const onTrayKey = (event: KeyboardEvent<HTMLButtonElement>, group: DockItem, index: number) => {
    const members = group.items ?? []
    const last = members.length - 1
    let target = -1
    if (event.key === "ArrowRight") target = index === last ? 0 : index + 1
    else if (event.key === "ArrowLeft") target = index === 0 ? last : index - 1
    else if (event.key === "Home") target = 0
    else if (event.key === "End") target = last
    else if (event.key === "ArrowDown" || event.key === "Escape") {
      event.preventDefault()
      setOpenId(null)
      focusLater(`bar:${group.id}`)
      return
    } else if (event.key === "Tab") {
      // Let focus move on, the tray simply folds away.
      setOpenId(null)
      return
    }
    if (target < 0) return
    event.preventDefault()
    setTrayStop(members[target].id)
    nodes.current.get(`tray:${members[target].id}`)?.focus()
  }

  const pointerLabel = (key: string | null) => (event: ReactPointerEvent) => {
    if (key && event.pointerType !== "mouse") return
    hoverKey.current = key
    updateLabel()
  }
  const focusLabel = (key: string | null) => (event: FocusEvent<HTMLElement>) => {
    // Keyboard focus only: a click focuses too, but the pointer already drives the label.
    focusKey.current = key && event.target.matches(":focus-visible") ? key : null
    updateLabel()
  }

  /* ---------- render ---------- */
  const reorderable = !!onItemsChange

  const renderSlot = (item: DockItem, index: number) => {
    const group = isGroup(item)
    const member = group ? shownMember(item) : undefined
    const selected = holds(item, value)
    const name = group
      ? `${accessibleName(`${item.label}: ${member?.label ?? ""}`, member?.shortcut, item.badge)}${selected ? ", selected" : ""}`
      : accessibleName(item.label, item.shortcut, item.badge)
    const key = `bar:${item.id}`
    return (
      <button
        ref={register(key)}
        type="button"
        className={cn(slotClass, "size-11 rounded-[16px] data-selected:text-background")}
        data-selected={selected || undefined}
        aria-label={name}
        aria-pressed={group ? undefined : selected}
        aria-haspopup={group ? "true" : undefined}
        aria-expanded={group ? openId === item.id : undefined}
        // The tray only exists while this group is open, so the reference is only set then.
        aria-controls={group && open && openId === item.id ? trayDomId : undefined}
        tabIndex={item.id === stop ? 0 : -1}
        onClick={() => choose(item)}
        onKeyDown={(event) => onBarKey(event, item, index)}
        onFocus={(event) => {
          setTabStop(item.id)
          focusLabel(key)(event)
        }}
        onBlur={focusLabel(null)}
        onPointerEnter={pointerLabel(key)}
        onPointerLeave={pointerLabel(null)}
      >
        {selected ? (
          <motion.span
            layoutId="selection"
            aria-hidden="true"
            className="absolute inset-0 rounded-[16px] bg-foreground"
            transition={reduced ? { duration: 0 } : selectionSpring}
          />
        ) : null}
        <span className="relative z-1 grid place-items-center">
          <Glyph id={member?.id ?? item.id} icon={member?.icon ?? item.icon} reduced={reduced} />
        </span>
        {group ? (
          // A small dot hints that the slot opens a tray.
          <span aria-hidden="true" className="absolute top-5 left-8 z-1 size-[5px] rounded-full bg-current opacity-55" />
        ) : null}
        <Badge count={item.badge} reduced={reduced} />
      </button>
    )
  }

  const trayItems = trayGroup?.items ?? []

  return (
    <div ref={root} className={cn("relative inline-flex max-w-full", className)}>
      {/* The dock body: one path for the bar and the tray tab, so they share fill and stroke with no seam. */}
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible">
        <motion.path d={outline} className="fill-surface-raised stroke-border" strokeWidth={STROKE} />
      </svg>

      {/* Tray: sits on the tab the outline grows. Mounted while open; it goes inert as it folds away. */}
      <AnimatePresence>
        {open && trayGroup ? (
          <TrayPanel
            key="tray"
            id={trayDomId}
            role="group"
            aria-label={trayGroup.label}
            className="absolute z-3 flex gap-0.5 p-1.5"
            style={{ left: trayLeft, top: -TRAY_HEIGHT, height: TRAY_HEIGHT, width: trayWidth(trayItems.length) }}
            initial="closed"
            animate="open"
            exit="closed"
            variants={reduced ? fadeVariants : trayVariants}
          >
            {trayItems.map((member, index) => {
              const key = `tray:${member.id}`
              const selected = member.id === value
              return (
                <motion.button
                  key={member.id}
                  ref={register(key)}
                  type="button"
                  custom={index}
                  variants={reduced ? fadeVariants : memberVariants}
                  className={cn(
                    slotClass,
                    "size-10 rounded-[14px] data-selected:bg-surface-muted data-selected:text-foreground",
                  )}
                  data-selected={selected || undefined}
                  aria-label={accessibleName(member.label, member.shortcut, member.badge)}
                  aria-pressed={selected}
                  tabIndex={member.id === trayFocusId ? 0 : -1}
                  onClick={() => chooseMember(trayGroup, member)}
                  onKeyDown={(event) => onTrayKey(event, trayGroup, index)}
                  onFocus={(event) => {
                    setTrayStop(member.id)
                    focusLabel(key)(event)
                  }}
                  onBlur={focusLabel(null)}
                  onPointerEnter={pointerLabel(key)}
                  onPointerLeave={pointerLabel(null)}
                >
                  <span className="relative z-1 grid place-items-center [&_svg]:size-5">{member.icon}</span>
                  <Badge count={member.badge} reduced={reduced} />
                </motion.button>
              )
            })}
          </TrayPanel>
        ) : null}
      </AnimatePresence>

      {/* Floating label: decorative, the buttons carry the same text as their names. */}
      <motion.div aria-hidden="true" className="pointer-events-none absolute top-0 left-0 z-4" style={{ x: labelX, y: labelY }}>
        <AnimatePresence>
          {labelOn && label$ ? (
            <motion.div
              key="label"
              className="-translate-x-1/2 -translate-y-full"
              // Measured: rises ~14px out of the dock while scaling .96 -> 1; opacity lands within ~150ms.
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
              transition={
                reduced
                  ? { duration: motionTokens.duration.instant }
                  : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.fast, ease: enter } }
              }
            >
              <DockLabel text={label$.text} shortcut={label$.shortcut} reduced={reduced} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>

      <LayoutGroup id={uid}>
        {reorderable ? (
          <Reorder.Group
            as="div"
            ref={bar}
            axis="x"
            values={items}
            onReorder={(next: DockItem[]) => {
              const id = dragging.current
              if (!id) return
              onItemsChange?.(next, { type: "move", id, index: next.findIndex((item) => item.id === id) })
            }}
            role="toolbar"
            aria-label={label}
            aria-orientation="horizontal"
            className="relative z-1 flex max-w-full gap-0.5 overflow-visible p-1.5"
          >
            {items.map((item, index) => (
              <Reorder.Item
                as="div"
                key={item.id}
                value={item}
                className={cn("relative flex-none rounded-[16px]", lifted === item.id && "z-2")}
                style={{ touchAction: "pan-y" }}
                transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
                whileDrag={reduced ? undefined : { scale: 1.1, boxShadow: "var(--shadow-raised)" }}
                onDragStart={() => {
                  dragging.current = item.id
                  justDragged.current = true
                  setLifted(item.id)
                  setOpenId(null)
                  updateLabel()
                }}
                onDragEnd={() => {
                  dragging.current = null
                  setLifted(null)
                  // The click that ends a drag is not a choice.
                  window.setTimeout(() => {
                    justDragged.current = false
                  }, 0)
                }}
              >
                {renderSlot(item, index)}
              </Reorder.Item>
            ))}
          </Reorder.Group>
        ) : (
          <div
            ref={bar}
            role="toolbar"
            aria-label={label}
            aria-orientation="horizontal"
            className="relative z-1 flex max-w-full gap-0.5 p-1.5"
          >
            {items.map((item, index) => (
              <div key={item.id} className="relative flex-none" style={{ touchAction: "pan-y" }}>
                {renderSlot(item, index)}
              </div>
            ))}
          </div>
        )}
      </LayoutGroup>
    </div>
  )
}

/** The tray goes inert the moment it starts to fold, so focus and clicks cannot land on a leaving member. */
function TrayPanel(props: ComponentProps<typeof motion.div>) {
  const present = useIsPresent()
  return <motion.div {...props} inert={!present} />
}

/** The label pill springs to the width of its text and crossfades between names. */
function DockLabel({ text, shortcut, reduced }: { text: string; shortcut?: string; reduced: boolean }) {
  const motionTokens = useMotionTokens()
  const measure = useRef<HTMLSpanElement>(null)
  const width = useMotionValue<number | "auto">("auto")
  const measured = useRef(false)
  const content = `${text}\u0000${shortcut ?? ""}`
  useLayoutEffect(() => {
    const node = measure.current
    if (!node) return
    const next = node.offsetWidth
    if (!measured.current || reduced) width.jump(next)
    else animate(width, next, motionTokens.spring.morph)
    measured.current = true
  }, [content, motionTokens.spring.morph, reduced, width])
  return (
    <motion.span
      className="relative flex h-[27px] items-center overflow-hidden rounded-[10px] bg-foreground text-[13px] font-medium whitespace-nowrap text-background shadow-raised"
      style={{ width }}
    >
      <span ref={measure} className="invisible absolute flex items-center gap-2 px-2.5">
        {text}
        {shortcut ? <kbd className="font-sans text-xs opacity-60">{shortcut}</kbd> : null}
      </span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={content}
          className="flex items-center gap-2 px-2.5"
          initial={reduced ? { opacity: 0 } : { opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)` }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
          transition={{ duration: motionTokens.duration.fast, ease: enter }}
        >
          {text}
          {shortcut ? <kbd className="font-sans text-xs opacity-60">{shortcut}</kbd> : null}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  )
}

export default Dock
