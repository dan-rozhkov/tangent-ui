"use client"

import { isValidElement, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { CSSProperties, FocusEvent, KeyboardEvent, PointerEvent, ReactNode, RefObject } from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { cva } from "class-variance-authority"
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react"
import type { TargetAndTransition } from "motion/react"
import { ChevronDown } from "@mynaui/icons-react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export type ButtonGroupVariant = "outline" | "solid"
export type ButtonGroupSize = "sm" | "md"
export type ButtonGroupOrientation = "horizontal" | "vertical"

export interface ButtonGroupItem {
  /** Stable key for the segment. */
  id: string
  /** Visible text and the accessible name. Changing it crossfades in place, so "Share" can answer "Copied". */
  label: string
  /** Every other label this segment can show, such as ["Copied"]. The segment sizes to the widest, so a label change never resizes it. */
  reserve?: string[]
  icon?: ReactNode
  /** Shows only the icon; the label becomes the accessible name and the tooltip. */
  iconOnly?: boolean
  /** Visible content in place of the label, such as a live value. The label stays the accessible name. */
  content?: ReactNode
  onSelect?: () => void
  /** Renders the segment as a link. */
  href?: string
  disabled?: boolean
}

export interface ButtonGroupMenuItem {
  id: string
  label: string
  icon?: ReactNode
  onSelect?: () => void
  href?: string
  disabled?: boolean
  /** Colors the item as a destructive action. */
  destructive?: boolean
}

export interface ButtonGroupMenu {
  /** Accessible name and tooltip of the chevron segment, such as "More actions". */
  label: string
  items: ButtonGroupMenuItem[]
}

export interface ButtonGroupProps {
  items: ButtonGroupItem[]
  /** Adds a trailing chevron segment that opens these actions in a menu aligned to the group's edge. */
  menu?: ButtonGroupMenu
  /** Accessible name of the group, such as "Document actions". */
  label: string
  variant?: ButtonGroupVariant
  size?: ButtonGroupSize
  orientation?: ButtonGroupOrientation
  /** When the row does not fit its container, segments with an icon drop their label and keep the icon. Horizontal only. */
  collapseLabels?: boolean
  /** Disables every segment and the menu. */
  disabled?: boolean
  className?: string
  style?: CSSProperties
}

/* One surface, several actions: a shared border and radius, hairline dividers, no gaps. A single soft highlight travels under the
   segments instead of each one lighting up; the dividers beside it step aside so it reads as one shape. */
const groupVariants = cva(
  [
    "group/bg [--bg-inset:3px] [--bg-radius:var(--radius-control)]",
    "relative isolate inline-flex max-w-full items-stretch rounded-(--bg-radius) border align-middle aria-disabled:opacity-52",
  ],
  {
    variants: {
      variant: {
        outline: [
          "[--bg-divider:var(--border)] [--bg-highlight:var(--surface-muted)] [--bg-muted-ink:var(--text-secondary)]",
          "[--bg-highlight-pressed:color-mix(in_oklab,var(--surface-muted),var(--border-strong)_30%)]",
          "border-border bg-surface text-foreground",
        ],
        /* Solid is the primary group: the foreground fill of a primary button, with the highlight and dividers mixed from the page color. */
        solid: [
          "[--bg-divider:color-mix(in_oklab,var(--background)_20%,var(--foreground))] [--bg-highlight:color-mix(in_oklab,var(--background)_13%,var(--foreground))]",
          "[--bg-highlight-pressed:color-mix(in_oklab,var(--background)_22%,var(--foreground))] [--bg-muted-ink:color-mix(in_oklab,var(--background)_72%,var(--foreground))]",
          "border-foreground bg-foreground text-background",
        ],
      },
      size: {
        sm: "[--bg-h:var(--control-height-sm)] [--bg-pad-x:12px]",
        md: "[--bg-h:var(--control-height-md)] [--bg-pad-x:14px]",
      },
      orientation: {
        horizontal: "overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        vertical: "flex-col overflow-visible [--bg-divider-inset:10px]",
      },
    },
    compoundVariants: [
      { orientation: "horizontal", size: "sm", class: "[--bg-divider-inset:9px]" },
      { orientation: "horizontal", size: "md", class: "[--bg-divider-inset:11px]" },
    ],
  },
)

/* The travelling highlight. Motion sets its box to the active segment; the visible shape sits inset so the border stays crisp. */
const highlightClass = [
  "pointer-events-none absolute top-0 left-0 z-0",
  "before:absolute before:inset-(--bg-inset) before:rounded-[calc(var(--bg-radius)-var(--bg-inset)-1px)] before:bg-(--bg-highlight) before:content-['']",
  "before:transition-colors before:duration-160 before:ease-standard data-pressed:before:bg-(--bg-highlight-pressed) data-pressed:before:duration-120",
  "motion-reduce:before:transition-none",
].join(" ")

const segmentBase = [
  "group/seg relative z-1 m-0 inline-flex h-[calc(var(--bg-h)-2px)] flex-none cursor-pointer items-center rounded-none border-0 bg-transparent",
  "text-sm leading-none font-medium tracking-body whitespace-nowrap text-inherit no-underline select-none [-webkit-tap-highlight-color:transparent]",
  "aria-disabled:cursor-not-allowed group-aria-disabled/bg:cursor-not-allowed",
  /* Collapsed rows keep the icon and drop the label; the label moves to aria-label and the tooltip. */
  "group-data-compact/bg:data-collapsible:w-[calc(var(--bg-h)-2px)] group-data-compact/bg:data-collapsible:px-0",
  /* Hairline dividers sit between segments and fade where the highlight arrives, so it never sits beside a line. */
  "[[data-key]+&]:before:pointer-events-none [[data-key]+&]:before:absolute [[data-key]+&]:before:bg-(--bg-divider) [[data-key]+&]:before:content-['']",
  "[[data-key]+&]:before:transition-opacity [[data-key]+&]:before:duration-160 [[data-key]+&]:before:ease-standard data-quiet:before:opacity-0 motion-reduce:before:transition-none",
].join(" ")
const dividerHorizontal =
  "[[data-key]+&]:before:top-(--bg-divider-inset) [[data-key]+&]:before:bottom-(--bg-divider-inset) [[data-key]+&]:before:-left-[.5px] [[data-key]+&]:before:w-px"
const dividerVertical =
  "[[data-key]+&]:before:-top-[.5px] [[data-key]+&]:before:right-(--bg-divider-inset) [[data-key]+&]:before:left-(--bg-divider-inset) [[data-key]+&]:before:h-px"

const segmentKind = {
  text: { horizontal: "min-w-[calc(var(--bg-h)-2px)] justify-center px-(--bg-pad-x)", vertical: "w-full min-w-[calc(var(--bg-h)-2px)] justify-start px-(--bg-pad-x)" },
  iconOnly: { horizontal: "w-[calc(var(--bg-h)-2px)] min-w-[calc(var(--bg-h)-2px)] justify-center px-0", vertical: "w-full min-w-[calc(var(--bg-h)-2px)] justify-center px-0" },
  trigger: {
    horizontal: "w-[calc(var(--bg-h)-6px)] min-w-0 justify-center px-0",
    vertical: "w-full min-w-0 justify-center px-0",
  },
} as const
const triggerExtra =
  "text-(--bg-muted-ink) transition-colors duration-160 ease-standard data-popup-open:text-inherit motion-reduce:transition-none"

/* The press answers inside the segment: content dips and springs back, the group and its neighbours stay still. */
const contentBase = [
  "relative inline-flex items-center group-aria-disabled/seg:opacity-40",
  "[transition:transform_var(--duration-spring)_var(--ease-spring),opacity_var(--duration-fast)_var(--ease-standard)] motion-reduce:transition-none motion-reduce:[transform:none]!",
].join(" ")
const contentPress = {
  text: "group-[:active:not([aria-disabled=true])]/seg:[transform:scale(.97)] group-[:active:not([aria-disabled=true])]/seg:[transition-duration:var(--duration-instant)] group-[:active:not([aria-disabled=true])]/seg:[transition-timing-function:var(--ease-standard)]",
  iconOnly:
    "group-[:active:not([aria-disabled=true])]/seg:[transform:scale(.9)] group-[:active:not([aria-disabled=true])]/seg:[transition-duration:var(--duration-instant)] group-[:active:not([aria-disabled=true])]/seg:[transition-timing-function:var(--ease-standard)]",
  /* The chevron anchors the menu, so it answers with the deeper highlight only. */
  trigger: "",
} as const

/* The menu grows from the group's edge: offset toward it, scale from the positioner's origin, and leave faster than it arrives.
   Transitions instead of keyframes, so a close that interrupts the open reverses from where the menu is. */
const menuClass = [
  "[--menu-x:0px] [--menu-y:-5px] data-[side=top]:[--menu-y:5px]",
  "data-[side=left]:[--menu-x:5px] data-[side=left]:[--menu-y:0px] data-[side=right]:[--menu-x:-5px] data-[side=right]:[--menu-y:0px]",
  "max-w-(--available-width) min-w-[min(13rem,var(--available-width))] rounded-panel border border-border bg-surface-raised p-[5px] text-foreground shadow-floating outline-none",
  "origin-(--transform-origin) [transition:opacity_var(--duration-fast)_var(--ease-enter),transform_var(--duration-spring)_var(--ease-spring)]",
  "data-starting-style:[transform:translate(var(--menu-x),var(--menu-y))_scale(.97)] data-starting-style:opacity-0",
  "data-ending-style:pointer-events-none data-ending-style:[transform:translate(calc(var(--menu-x)*.5),calc(var(--menu-y)*.5))_scale(.985)] data-ending-style:opacity-0",
  "data-ending-style:[transition:opacity_130ms_var(--ease-standard),transform_130ms_var(--ease-standard)]",
  "motion-reduce:[transform:none]! motion-reduce:[transition:opacity_var(--duration-instant)_linear]!",
].join(" ")
const itemClass = [
  "flex min-h-9 cursor-pointer items-center gap-[10px] rounded-[calc(var(--radius-panel)-6px)] px-[11px] text-sm text-inherit no-underline outline-none",
  "[transition:opacity_var(--duration-standard)_var(--ease-enter)_calc(min(var(--i,0),4)*35ms),transform_var(--duration-standard)_var(--ease-enter)_calc(min(var(--i,0),4)*35ms)]",
  "in-data-starting-style:[transform:translate(calc(var(--menu-x)*.4),calc(var(--menu-y)*.4))] in-data-starting-style:opacity-0",
  "data-highlighted:bg-surface-muted data-disabled:cursor-default data-disabled:opacity-45 motion-reduce:transition-none",
].join(" ")
const destructiveItemClass = "text-danger data-highlighted:bg-[color-mix(in_oklab,var(--danger)_8%,var(--surface))]"

/** Key of the chevron segment. Plain text, because the HTML parser rewrites control characters in server-rendered attributes. */
const MENU = "button-group-menu"

const rest: TargetAndTransition = { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
const textIn: TargetAndTransition = { opacity: 0, y: 4, filter: `blur(${motionTokens.blur.soft}px)` }
const textOut: TargetAndTransition = {
  opacity: 0,
  y: -3,
  filter: `blur(${motionTokens.blur.soft}px)`,
  transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
}
const fadeIn: TargetAndTransition = { ...rest, opacity: 0 }
const fadeOut: TargetAndTransition = { opacity: 0, transition: { duration: motionTokens.duration.instant } }

/** Names the icon element, so swapping Link for Check morphs while a re-render of the same icon stays still. */
function iconKey(node: ReactNode): string {
  if (!isValidElement(node)) return node == null || typeof node === "boolean" ? "" : String(node)
  const type = node.type as string | { displayName?: string; name?: string }
  return typeof type === "string" ? type : (type?.displayName ?? type?.name ?? "icon")
}

/** Springs the slot to the natural width of its content when the label changes; other resizes (a late web font, collapsing labels) jump. */
function useMorphWidth(content: RefObject<HTMLElement | null>, key: string, reduced: boolean) {
  const width = useMotionValue<number | "auto">("auto")
  const lastKey = useRef(key)
  const armedUntil = useRef(0)
  useLayoutEffect(() => {
    if (lastKey.current === key) return
    lastKey.current = key
    armedUntil.current = performance.now() + 700
  }, [key])
  useEffect(() => {
    const node = content.current
    const slot = node?.parentElement
    if (!node || !slot || typeof ResizeObserver === "undefined") return
    let measured = false
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width
      if (!next || !measured || reduced || performance.now() > armedUntil.current) {
        measured = next > 0
        width.jump(next || "auto")
        delete slot.dataset.morphing
        return
      }
      slot.dataset.morphing = ""
      animate(width, next, { ...motionTokens.spring.morph, onComplete: () => void delete slot.dataset.morphing })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [content, reduced, width])
  return width
}

const labelClass = "inline-block group-data-compact/bg:data-collapsible:hidden"

/**
 * Icon and label of one segment. Every reserved label sits invisibly in the same grid cell, so the segment is as wide as its widest
 * state and a new label crossfades inside a fixed box: it rises in from a soft blur while the old one lifts away. A label nobody
 * reserved still never snaps: the slot springs to its width.
 */
function SegmentContent({ item, size, reduced }: { item: ButtonGroupItem; size: ButtonGroupSize; reduced: boolean }) {
  const contentRef = useRef<HTMLSpanElement>(null)
  const key = `${iconKey(item.icon)}|${item.content !== undefined ? "\u0000content" : item.iconOnly ? "" : item.label}`
  const width = useMorphWidth(contentRef, key, reduced)
  const sizers = item.iconOnly || item.content !== undefined ? [] : [...new Set([item.label, ...(item.reserve ?? [])])]
  const phaseClass = cn("inline-flex items-center whitespace-nowrap", size === "sm" ? "gap-1.5" : "gap-2")
  return (
    // Reserved labels and the visible one share one grid cell, so the widest state sets the width and a change crossfades in place.
    // A label nobody reserved springs the slot to its width instead; content is clipped only while that happens.
    <motion.span
      className="relative inline-flex min-w-0 items-center justify-center data-morphing:[clip-path:inset(-50%_calc(var(--space-3)*-1))]"
      style={{ width }}
      aria-hidden="true"
    >
      <span ref={contentRef} className="inline-grid flex-none items-center justify-items-center *:[grid-area:1/1]">
        {sizers.map(text => (
          <span key={text} className={cn(phaseClass, "pointer-events-none invisible")}>
            {item.icon ? <span className="inline-block size-4 flex-none" /> : null}
            <span className={labelClass} data-collapsible={item.icon ? "" : undefined}>
              {text}
            </span>
          </span>
        ))}
        <AnimatePresence initial={false}>
          <motion.span
            key={key}
            className={phaseClass}
            initial={reduced ? fadeIn : textIn}
            animate={rest}
            exit={reduced ? fadeOut : textOut}
            transition={
              reduced
                ? { duration: motionTokens.duration.instant }
                : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }
            }
          >
            {item.icon ? (
              <span className="inline-flex flex-none [&_svg]:size-4 [&_svg]:[stroke-width:1.75]">{item.icon}</span>
            ) : null}
            {item.content !== undefined ? (
              <span className="inline-flex items-center tabular-nums">{item.content}</span>
            ) : item.iconOnly ? null : (
              <span className={labelClass} data-collapsible={item.icon ? "" : undefined}>
                {item.label}
              </span>
            )}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.span>
  )
}

const inside = (node: HTMLElement, x: number, y: number) => {
  const rect = node.getBoundingClientRect()
  return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom
}
/** Segments are found by their data-key, so the group needs no ref per segment. */
const segmentsIn = (root: HTMLElement | null) =>
  Array.from(root?.querySelectorAll<HTMLElement>(":scope > [data-key]") ?? [])
const segmentIn = (root: HTMLElement | null, key: string | null) =>
  key === null ? undefined : segmentsIn(root).find(node => node.dataset.key === key)
/** The segment's box inside the group at sub-pixel precision, undoing any scale an ancestor applies. */
function boxOf(group: HTMLElement, node: HTMLElement) {
  const outer = group.getBoundingClientRect()
  const inner = node.getBoundingClientRect()
  // offsetWidth is rounded to whole pixels, so only a real transform (more than a pixel apart) counts as scale.
  const scale =
    group.offsetWidth && Math.abs(outer.width - group.offsetWidth) > 1 ? outer.width / group.offsetWidth : 1
  return [
    (inner.left - outer.left) / scale - group.clientLeft + group.scrollLeft,
    (inner.top - outer.top) / scale - group.clientTop + group.scrollTop,
    inner.width / scale,
    inner.height / scale,
  ]
}
const inert = (node: HTMLElement) =>
  (node as HTMLButtonElement).disabled || node.getAttribute("aria-disabled") === "true"

/**
 * Related actions joined into one surface: a shared border and radius, hairline dividers, no gaps. One soft highlight glides
 * between segments under the pointer or keyboard focus, the pressed segment answers in place, and an optional chevron
 * segment opens more actions in a menu aligned to the group's edge.
 */
export function ButtonGroup({
  items,
  menu,
  label,
  variant = "outline",
  size = "md",
  orientation = "horizontal",
  collapseLabels = true,
  disabled = false,
  className,
  style,
}: ButtonGroupProps) {
  const reduced = useReducedMotion() ?? false
  const root = useRef<HTMLDivElement>(null)
  const vertical = orientation === "vertical"
  const axis = vertical ? "vertical" : "horizontal"

  // The highlight sits on the pointer's segment, else the pressed one (touch), else the open menu's chevron, else keyboard focus.
  const [hover, setHover] = useState<string | null>(null)
  const [pressed, setPressed] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const active = hover ?? pressed ?? (menuOpen ? MENU : null) ?? focused
  const keys = [...items.map(item => item.id), ...(menu ? [MENU] : [])]
  const activeIndex = active ? keys.indexOf(active) : -1
  const inertKey = `${disabled}${items.map(item => (item.disabled ? 1 : 0)).join("")}`

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const width = useMotionValue(0)
  const height = useMotionValue(0)
  const opacity = useMotionValue(0)
  const shown = useRef<string | null>(null)

  useLayoutEffect(() => {
    const node = segmentIn(root.current, active)
    // Hovering a disabled segment shows nothing; focus on one still shows where the keyboard is.
    if (!node || (inert(node) && active !== focused)) {
      if (shown.current)
        animate(opacity, 0, {
          duration: reduced ? motionTokens.duration.instant : motionTokens.duration.fast,
          ease: [...motionTokens.ease.standard],
        })
      shown.current = null
      return
    }
    const target = boxOf(root.current!, node)
    const values = [x, y, width, height]
    if (!shown.current || reduced) {
      // Arriving from nowhere, it appears in place; only moves between segments travel.
      values.forEach((value, index) => value.jump(target[index]))
      animate(opacity, 1, {
        duration: reduced ? motionTokens.duration.instant : motionTokens.duration.fast,
        ease: [...motionTokens.ease.standard],
      })
    } else {
      values.forEach((value, index) => animate(value, target[index], motionTokens.spring.snappy))
      animate(opacity, 1, { duration: motionTokens.duration.fast })
    }
    shown.current = active
    // inertKey re-checks a segment that turns disabled under a still pointer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, inertKey, reduced, x, y, width, height, opacity])

  // Segments resize when a label morphs or labels collapse; the highlight stays locked to its segment.
  const keyList = keys.join("\u0000")
  useEffect(() => {
    const group = root.current
    if (!group || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      const node = segmentIn(group, shown.current)
      if (!node) return
      const target = boxOf(group, node)
      ;[x, y, width, height].forEach((value, index) => {
        if (Math.abs(value.get() - target[index]) < 0.01) return
        if (value.isAnimating() && !reduced) animate(value, target[index], motionTokens.spring.snappy)
        else value.jump(target[index])
      })
    })
    observer.observe(group)
    segmentsIn(group).forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [keyList, reduced, x, y, width, height])

  // Labels collapse to icons when the row overflows, and come back once the container is wide enough for the full row again.
  const [overflowing, setCompact] = useState(false)
  const fullWidth = useRef(0)
  const blockedAt = useRef(0)
  const collapsible =
    collapseLabels && !vertical && items.some(item => item.icon && !item.iconOnly && item.content === undefined)
  const compact = collapsible && overflowing
  useEffect(() => {
    const group = root.current
    const parent = group?.parentElement
    if (!group || !parent || !collapsible || typeof ResizeObserver === "undefined") return
    const check = () => {
      const box = getComputedStyle(parent)
      const available = parent.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight)
      if (group.dataset.compact === undefined) {
        if (group.scrollWidth > group.clientWidth + 1) {
          fullWidth.current = group.scrollWidth + 2
          blockedAt.current = available
          setCompact(true)
        }
      } else if (available > blockedAt.current && available >= fullWidth.current) setCompact(false)
    }
    const observer = new ResizeObserver(check)
    observer.observe(group)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [collapsible, keyList])

  // Pressing tracks the segment under the finger, so touch gets the same highlight a pointer gets on hover.
  useEffect(() => {
    if (!pressed) return
    const release = () => setPressed(null)
    window.addEventListener("pointerup", release)
    window.addEventListener("pointercancel", release)
    return () => {
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", release)
    }
  }, [pressed])

  const hit = (event: PointerEvent) => {
    for (const node of segmentsIn(root.current))
      if (inside(node, event.clientX, event.clientY)) return inert(node) ? null : (node.dataset.key ?? null)
    return null
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") setHover(hit(event))
  }
  const onPointerLeave = () => setHover(null)
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button === 0) setPressed(hit(event))
  }

  // Keyboard focus shows the highlight; a mouse click focuses without it, so nothing stays lit after the pointer leaves.
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const key = target.dataset.key
    if (key === undefined) return
    let visible = true
    try {
      visible = target.matches(":focus-visible")
    } catch {
      /* older engines */
    }
    setFocused(visible ? key : null)
  }
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!root.current?.contains(event.relatedTarget as Node | null)) setFocused(null)
  }

  // Tab visits every segment in order; arrow keys along the orientation, Home and End also move between them.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return
    // Disabled segments stay focusable (aria-disabled), so the keyboard can find them and hear why nothing happens.
    const list = segmentsIn(root.current).filter(node => !(node as HTMLButtonElement).disabled)
    const index = list.findIndex(node => node === document.activeElement)
    if (index < 0) return
    const rtl = !vertical && getComputedStyle(root.current!).direction === "rtl"
    const forward = vertical ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight"
    const backward = vertical ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft"
    const last = list.length - 1
    const target =
      event.key === forward
        ? index === last
          ? 0
          : index + 1
        : event.key === backward
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1
    if (target < 0) return
    event.preventDefault()
    list[target].focus()
  }

  // A label that changes right after its segment is pressed, such as "Copied", is announced once; the quiet revert is not.
  const [announcement, setAnnouncement] = useState("")
  const labels = useRef<Map<string, string> | null>(null)
  const activated = useRef({ key: "", at: 0 })
  const labelList = items.map(item => `${item.id}\u0000${item.label}`).join("\u0001")
  useEffect(() => {
    const previous = labels.current
    labels.current = new Map(items.map(item => [item.id, item.label]))
    if (!previous) return
    const recent = performance.now() - activated.current.at < 1000
    const changed = items.filter(
      item =>
        recent &&
        item.id === activated.current.key &&
        previous.has(item.id) &&
        previous.get(item.id) !== item.label &&
        item.content === undefined,
    )
    if (changed.length) setAnnouncement(changed.map(item => item.label).join(", "))
    // labelList carries the only part of items this effect reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelList])

  const select = (item: ButtonGroupItem) => {
    activated.current = { key: item.id, at: performance.now() }
    item.onSelect?.()
  }
  const quiet = (index: number) =>
    activeIndex >= 0 && (index === activeIndex || index === activeIndex + 1) ? "" : undefined
  const divider = vertical ? dividerVertical : dividerHorizontal

  const segments = items.map((item, index) => {
    const off = item.disabled && !disabled
    const named = item.iconOnly || item.content !== undefined || (compact && !!item.icon)
    const kind = item.iconOnly ? "iconOnly" : "text"
    const common = {
      className: cn(segmentBase, divider, segmentKind[kind][axis]),
      "data-key": item.id,
      "data-quiet": quiet(index),
      "data-collapsible": item.icon && !item.iconOnly && item.content === undefined ? "" : undefined,
      "aria-label": named ? item.label : undefined,
      title: item.iconOnly || (compact && item.icon) ? item.label : undefined,
    }
    const body = (
      <span className={cn(contentBase, contentPress[kind])}>
        <SegmentContent item={item} size={size} reduced={reduced} />
      </span>
    )
    if (item.href && !off && !disabled)
      return (
        <a key={item.id} {...common} href={item.href} onClick={() => select(item)}>
          {body}
          {named ? null : <span className="sr-only">{item.label}</span>}
        </a>
      )
    return (
      <button
        key={item.id}
        {...common}
        type="button"
        disabled={disabled}
        aria-disabled={off || undefined}
        onClick={off ? undefined : () => select(item)}
      >
        {body}
        {named ? null : <span className="sr-only">{item.label}</span>}
      </button>
    )
  })

  const group = (
    <div
      ref={root}
      className={cn(groupVariants({ variant, size, orientation }), className)}
      style={style}
      role="group"
      aria-label={label}
      aria-disabled={disabled || undefined}
      data-orientation={orientation}
      data-compact={compact ? "" : undefined}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      <motion.span
        className={highlightClass}
        style={{ x, y, width, height, opacity }}
        data-pressed={pressed && pressed === active ? "" : undefined}
        aria-hidden="true"
      />
      {segments}
      {menu ? (
        <MenuPrimitive.Trigger
          className={cn(segmentBase, divider, segmentKind.trigger[axis], triggerExtra)}
          data-key={MENU}
          data-quiet={quiet(items.length)}
          aria-label={menu.label}
          title={menu.label}
          disabled={disabled}
        >
          <span className={cn(contentBase, contentPress.trigger)}>
            <ChevronDown
              className="size-4 [transition:rotate_var(--duration-spring)_var(--ease-spring)] group-data-popup-open/seg:rotate-180 motion-reduce:transition-none"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </span>
        </MenuPrimitive.Trigger>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  )

  if (!menu) return group
  // Non-modal: no scroll lock, so opening the menu never shifts the page by a scrollbar's width.
  return (
    <MenuPrimitive.Root open={menuOpen} onOpenChange={open => setMenuOpen(open)} modal={false}>
      {group}
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner
          className="z-60"
          side="bottom"
          align={vertical ? "start" : "end"}
          alignOffset={-1}
          sideOffset={6}
          collisionPadding={12}
        >
          <MenuPrimitive.Popup className={menuClass}>
            {menu.items.map((action, index) => {
              const classes = cn(itemClass, action.destructive && destructiveItemClass)
              const body = (
                <>
                  {action.icon ? (
                    <span
                      className={cn(
                        "inline-flex flex-none text-text-secondary [&_svg]:size-4 [&_svg]:[stroke-width:1.75]",
                        action.destructive && "text-danger",
                      )}
                      aria-hidden="true"
                    >
                      {action.icon}
                    </span>
                  ) : null}
                  <span className="min-w-0 truncate">{action.label}</span>
                </>
              )
              const itemStyle = { "--i": index } as CSSProperties
              // A disabled link has no Base UI link-item state, so it renders as a disabled plain item.
              return action.href && !action.disabled ? (
                <MenuPrimitive.LinkItem
                  key={action.id}
                  className={classes}
                  style={itemStyle}
                  href={action.href}
                  closeOnClick
                  onClick={action.onSelect}
                >
                  {body}
                </MenuPrimitive.LinkItem>
              ) : (
                <MenuPrimitive.Item
                  key={action.id}
                  className={classes}
                  style={itemStyle}
                  disabled={action.disabled}
                  onClick={action.onSelect}
                >
                  {body}
                </MenuPrimitive.Item>
              )
            })}
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  )
}

export default ButtonGroup
