"use client"

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { CSSProperties, FocusEvent, KeyboardEvent, ReactElement, ReactNode } from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { AnimatePresence, animate, motion, useIsPresent, useMotionValue } from "motion/react"
import type { TargetAndTransition } from "motion/react"

import { Tooltip } from "@/components/ui/tooltip"
import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export type FloatingButtonGroupVariant = "muted" | "floating"
export type FloatingButtonGroupSize = "sm" | "md"
export type FloatingButtonGroupOrientation = "horizontal" | "vertical"

export interface FloatingButtonGroupAction {
  type?: "action"
  /** Stable key, also passed to onAction. */
  id: string
  /** Visible label, and the accessible name when the item shows only its icon. */
  label: string
  icon?: ReactNode
  /** Shows only the icon. The label moves into a tooltip and the accessible name. Overrides the group's iconOnly. */
  iconOnly?: boolean
  onSelect?: () => void
  disabled?: boolean
  /** Marks an action that switches a mode on, such as Present. Sets aria-pressed and keeps a quiet tint while on. */
  pressed?: boolean
  /** A shortcut hint shown in the tooltip, such as "⌘Z". The component does not bind the key. */
  shortcut?: string
  /** Other labels this item can switch to, such as ["Copied"] for Share. The button keeps the width of the widest, so a label change never moves anything. */
  reserveLabels?: readonly string[]
}

export interface FloatingButtonGroupSeparator {
  type: "separator"
  id?: string
}

export type FloatingButtonGroupItem = FloatingButtonGroupAction | FloatingButtonGroupSeparator

export interface FloatingButtonGroupProps {
  items: readonly FloatingButtonGroupItem[]
  /** Accessible name of the toolbar, such as "Board actions". */
  label: string
  /** muted sits quietly on a page; floating raises the tray with the floating shadow for overlays such as a selection toolbar. */
  variant?: FloatingButtonGroupVariant
  size?: FloatingButtonGroupSize
  orientation?: FloatingButtonGroupOrientation
  /** Shows every item as an icon only, with its label in a tooltip. Items with their own iconOnly win. */
  iconOnly?: boolean
  /** Side of the item tooltips. Defaults to top for a row and right for a column. */
  tooltipSide?: "top" | "bottom" | "left" | "right"
  /** Called with the item id after the item's own onSelect. */
  onAction?: (id: string) => void
  className?: string
  style?: CSSProperties
}

const isAction = (item: FloatingButtonGroupItem): item is FloatingButtonGroupAction => item.type !== "separator"
const standard = [...motionTokens.ease.standard] as [number, number, number, number]
const enter = [...motionTokens.ease.enter] as [number, number, number, number]

const rest: TargetAndTransition = { opacity: 1, y: 0, filter: "blur(0px)" }
const textIn: TargetAndTransition = { opacity: 0, y: 4, filter: `blur(${motionTokens.blur.soft}px)` }
const textOut: TargetAndTransition = {
  opacity: 0,
  y: -3,
  filter: `blur(${motionTokens.blur.soft}px)`,
  transition: { duration: motionTokens.duration.fast, ease: standard },
}
const fadeIn: TargetAndTransition = { opacity: 0 }
const fadeOut: TargetAndTransition = { opacity: 0, transition: { duration: motionTokens.duration.instant } }

/* Separate soft buttons in a quiet tray, with real gaps between them. The tray always keeps its natural size and never wraps or clips its buttons. The buttons stay transparent: one shared highlight
   moves underneath their content, so there is only ever one moving surface. Corners are concentric with the tray.
   The muted tray is a translucent tint, not --surface-muted, so it still reads when it sits on a muted surface. */
const groupBase = [
  "relative isolate inline-flex flex-none flex-nowrap items-center gap-(--fbg-gap) rounded-(--fbg-outer) border border-(--fbg-tray-edge) bg-(--fbg-tray) p-(--fbg-pad)",
  "font-body tracking-body text-text-secondary [-webkit-tap-highlight-color:transparent]",
  "[--fbg-radius:calc(var(--fbg-outer)-var(--fbg-pad)-1px)]",
  "[--fbg-highlight:color-mix(in_oklab,var(--foreground)_7%,transparent)] [--fbg-highlight-press:color-mix(in_oklab,var(--foreground)_12%,transparent)]",
  "[--fbg-on:color-mix(in_oklab,var(--control-on)_12%,transparent)] [--fbg-rule:color-mix(in_oklab,var(--foreground)_12%,transparent)]",
  "[--fbg-tray:color-mix(in_oklab,var(--foreground)_4.5%,transparent)] [--fbg-tray-edge:color-mix(in_oklab,var(--foreground)_3%,transparent)]",
  "dark:[--fbg-highlight:color-mix(in_oklab,var(--foreground)_9%,transparent)] dark:[--fbg-highlight-press:color-mix(in_oklab,var(--foreground)_15%,transparent)]",
  "dark:[--fbg-on:color-mix(in_oklab,var(--control-on)_16%,transparent)] dark:[--fbg-tray:color-mix(in_oklab,var(--foreground)_6%,transparent)]",
  "dark:[--fbg-tray-edge:color-mix(in_oklab,var(--foreground)_5%,transparent)]",
].join(" ")
const sizeVars = {
  sm: "[--fbg-h:30px] [--fbg-pad:3px] [--fbg-gap:3px] [--fbg-pad-x:10px] [--fbg-outer:calc(var(--radius-control)-3px)]",
  md: "[--fbg-h:36px] [--fbg-pad:4px] [--fbg-gap:4px] [--fbg-pad-x:12px] [--fbg-outer:var(--radius-control)]",
} as const

const reducedTransition =
  "motion-reduce:[transition:color_var(--duration-instant)_linear,background-color_var(--duration-instant)_linear,opacity_var(--duration-instant)_linear]"

function Phase({ children, reduced }: { children: ReactNode; reduced: boolean }) {
  const present = useIsPresent()
  return (
    <motion.span
      className="inline-flex items-center gap-1.5 whitespace-nowrap"
      aria-hidden={present ? undefined : true}
      initial={reduced ? fadeIn : textIn}
      animate={rest}
      exit={reduced ? fadeOut : textOut}
      transition={{ duration: reduced ? motionTokens.duration.instant : motionTokens.duration.standard, ease: enter }}
    >
      {children}
    </motion.span>
  )
}

/**
 * Icon and label. Every label the item can show is laid out invisibly in the same grid cell, so the button always has the width
 * of the widest one: a label change crossfades in place and never resizes the button, its neighbours or the tray.
 */
function ItemBody({
  label,
  icon,
  iconOnly,
  reserve,
  reduced,
  vertical,
}: {
  label: string
  icon?: ReactNode
  iconOnly: boolean
  reserve: readonly string[]
  reduced: boolean
  vertical: boolean
}) {
  const ghosts = iconOnly ? [] : Array.from(new Set([label, ...reserve]))
  return (
    <span className={cn("relative z-2 inline-grid items-center *:[grid-area:1/1]", vertical ? "justify-items-start" : "justify-items-center")}>
      {ghosts.map(text => (
        <span key={text} className="pointer-events-none invisible inline-flex items-center gap-1.5 whitespace-nowrap" aria-hidden="true">
          {icon ? <span className="block size-4 flex-none" /> : null}
          <span className="block">{text}</span>
        </span>
      ))}
      <AnimatePresence initial={false}>
        <Phase key={label} reduced={reduced}>
          {icon ? (
            <span className="inline-flex flex-none [&_svg]:size-4 [&_svg]:stroke-[1.75]" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          {iconOnly ? null : <span className="block">{label}</span>}
        </Phase>
      </AnimatePresence>
    </span>
  )
}

function TipContent({ label, shortcut }: { label: string; shortcut?: string }) {
  return (
    <span className="inline-flex items-baseline gap-3 whitespace-nowrap">
      {label}
      {shortcut ? (
        <kbd className="[font-family:inherit] text-[length:inherit] text-[color-mix(in_oklab,var(--background)_58%,var(--foreground))] tabular-nums">
          {shortcut}
        </kbd>
      ) : null}
    </span>
  )
}

/* Side tooltips for a column match the library tooltip, rising a few pixels away from the rail instead of up. */
const sideTipClass = [
  "[--tip-x:-3px] data-[side=left]:[--tip-x:3px]",
  "max-w-60 rounded-control border border-[color-mix(in_oklab,var(--background)_14%,var(--foreground))] bg-foreground px-4 py-3 text-background shadow-raised",
  "font-body text-sm leading-body font-normal tracking-body origin-(--transform-origin)",
  "[transition:opacity_var(--duration-fast)_var(--ease-enter),transform_var(--duration-fast)_var(--ease-enter)]",
  "data-starting-style:opacity-0 data-starting-style:[transform:translateX(var(--tip-x))_scale(.97)]",
  "data-ending-style:opacity-0 data-ending-style:[transform:scale(.98)]",
  "data-ending-style:[transition:opacity_110ms_var(--ease-standard),transform_110ms_var(--ease-standard)]",
  "motion-reduce:[transform:none]! motion-reduce:[transition:opacity_90ms_linear]!",
].join(" ")

/** Side tooltips for a column. The library Tooltip opens above or below, which would cover the neighbouring button. */
function SideTip({ side, content, children }: { side: "left" | "right"; content: ReactNode; children: ReactElement }) {
  return (
    <TooltipPrimitive.Root disableHoverablePopup>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner className="z-90" side={side} sideOffset={10} collisionPadding={12}>
          <TooltipPrimitive.Popup className={sideTipClass}>{content}</TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

/**
 * Separate soft buttons in a quiet tray. One shared highlight morphs, in position and size, to whichever button the pointer
 * or keyboard focus is on, fades when the pointer leaves the tray, and settles darker in place while a button is pressed.
 * It is the toolbar's only hover and focus indicator. Arrow keys move focus, Home and End jump to the ends, Enter and Space act.
 */
export function FloatingButtonGroup({
  items,
  label,
  variant = "muted",
  size = "md",
  orientation = "horizontal",
  iconOnly: groupIconOnly = false,
  tooltipSide,
  onAction,
  className,
  style,
}: FloatingButtonGroupProps) {
  const reduced = useReducedMotion() ?? false
  const tray = useRef<HTMLDivElement>(null)
  const nodes = useRef(new Map<string, HTMLButtonElement>())
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [pressing, setPressing] = useState(false)
  const [tabStop, setTabStop] = useState<string | null>(null)

  const actions = items.filter(isAction)
  const byId = new Map(actions.map(action => [action.id, action]))
  const enabled = (id: string | null) => !!id && !!byId.get(id) && !byId.get(id)?.disabled
  // Pointer wins over keyboard focus while it is in the tray; a disabled item under the pointer hands back to focus.
  const activeId = enabled(hoverId) ? hoverId : focusId && byId.has(focusId) ? focusId : null
  const stop = enabled(tabStop) ? tabStop : (actions.find(action => !action.disabled)?.id ?? null)
  const vertical = orientation === "vertical"
  const side = tooltipSide ?? (vertical ? "right" : "top")
  const idsKey = actions.map(action => action.id).join("\u0000")

  // The highlight lives in motion values so moving it never re-renders the buttons.
  const x = useMotionValue(0),
    y = useMotionValue(0),
    width = useMotionValue(0),
    height = useMotionValue(0)
  const opacity = useMotionValue(0),
    scale = useMotionValue(1)
  const traveling = useRef(false)
  const activeRef = useRef(activeId)
  const pressingRef = useRef(pressing)

  /** The button's box in tray coordinates, exact to the device pixel (offsetLeft rounds to whole pixels) and free of ancestor transforms. */
  const measure = useCallback((node: HTMLElement) => {
    const root = tray.current
    if (!root) return null
    const outer = root.getBoundingClientRect(),
      box = node.getBoundingClientRect()
    const unscale = outer.width ? root.offsetWidth / outer.width : 1
    const dpr = window.devicePixelRatio || 1
    const snap = (value: number) => Math.round(value * unscale * dpr) / dpr
    return {
      x: snap(box.left - outer.left) - root.clientLeft,
      y: snap(box.top - outer.top) - root.clientTop,
      width: snap(box.width),
      height: snap(box.height),
    }
  }, [])

  const place = useCallback(
    (id: string | null, mode: "move" | "follow") => {
      const node = id ? nodes.current.get(id) : undefined
      if (!node) {
        animate(opacity, 0, { duration: reduced ? motionTokens.duration.instant : motionTokens.duration.standard, ease: standard })
        return
      }
      const rect = measure(node)
      if (!rect) return
      const visible = opacity.get() > 0.15
      // Travel between buttons on the morph spring. Appearing from nothing, and every move with reduced motion, lands in place.
      const travel = !reduced && visible && (mode === "move" || traveling.current)
      if (travel) {
        traveling.current = true
        animate(x, rect.x, motionTokens.spring.morph)
        animate(y, rect.y, motionTokens.spring.morph)
        animate(width, rect.width, motionTokens.spring.morph)
        animate(height, rect.height, {
          ...motionTokens.spring.morph,
          onComplete: () => {
            traveling.current = false
          },
        })
      } else {
        traveling.current = false
        x.jump(rect.x)
        y.jump(rect.y)
        width.jump(rect.width)
        height.jump(rect.height)
        if (!visible && !reduced) {
          scale.jump(0.94)
          animate(scale, pressingRef.current ? 0.965 : 1, motionTokens.spring.snappy)
        }
      }
      if (opacity.get() !== 1)
        animate(opacity, 1, { duration: reduced ? motionTokens.duration.instant : motionTokens.duration.fast, ease: standard })
    },
    [height, measure, opacity, reduced, scale, width, x, y],
  )

  useLayoutEffect(() => {
    activeRef.current = activeId
    place(activeId, "move")
  }, [activeId, place])

  useEffect(() => {
    pressingRef.current = pressing
    animate(scale, pressing && activeId ? 0.965 : 1, reduced ? { duration: 0 } : motionTokens.spring.snappy)
  }, [activeId, pressing, reduced, scale])

  // A font that loads or a container that reflows moves the buttons; the highlight follows without travel.
  useEffect(() => {
    const root = tray.current
    if (!root || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      if (activeRef.current) place(activeRef.current, "follow")
    })
    observer.observe(root)
    nodes.current.forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [idsKey, place])

  // A native listener, because React bubbles pointer events through portals: moving from a button onto its tooltip
  // would not count as leaving the tray, and the highlight would stay behind.
  useEffect(() => {
    const root = tray.current
    if (!root) return
    const leave = () => {
      setHoverId(null)
      setPressing(false)
    }
    root.addEventListener("pointerleave", leave)
    return () => root.removeEventListener("pointerleave", leave)
  }, [])

  const buttons = () => Array.from(tray.current?.querySelectorAll<HTMLButtonElement>("[data-fbg-item]") ?? [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const all = buttons()
    const index = all.findIndex(node => node === document.activeElement)
    if (index < 0) return
    const next = vertical ? "ArrowDown" : "ArrowRight"
    const previous = vertical ? "ArrowUp" : "ArrowLeft"
    const usable = (node: HTMLButtonElement) => node.getAttribute("aria-disabled") !== "true"
    let target: HTMLButtonElement | undefined
    if (event.key === "Home") target = all.find(usable)
    else if (event.key === "End") target = [...all].reverse().find(usable)
    else if (event.key === next || event.key === previous) {
      const step = event.key === next ? 1 : -1
      for (let offset = 1; offset <= all.length; offset += 1) {
        const candidate = all[(index + step * offset + all.length * offset) % all.length]
        if (usable(candidate)) {
          target = candidate
          break
        }
      }
    } else return
    event.preventDefault()
    if (!target) return
    // The keyboard takes the highlight back until the pointer moves again.
    setHoverId(null)
    target.focus()
  }

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (tray.current?.contains(event.relatedTarget as Node | null)) return
    setFocusId(null)
    setPressing(false)
  }

  const group = (
    <div
      ref={tray}
      className={cn(
        groupBase,
        sizeVars[size],
        // Raised for overlays such as a selection toolbar: the floating layer shadow and a hairline edge.
        variant === "floating" && "border-border bg-surface-raised shadow-floating",
        vertical && "flex-col items-stretch",
        className,
      )}
      style={style}
      role="toolbar"
      aria-label={label}
      aria-orientation={orientation}
      data-variant={variant}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      {/* The highlight paints above the buttons' own backgrounds (a pressed tint) and below their content. */}
      <motion.span
        className={cn(
          "pointer-events-none absolute top-0 left-0 z-1 rounded-(--fbg-radius) bg-(--fbg-highlight)",
          "[transition:background-color_var(--duration-fast)_var(--ease-standard)] data-pressing:bg-(--fbg-highlight-press) data-pressing:[transition-duration:var(--duration-instant)]",
          reducedTransition,
        )}
        data-pressing={pressing && activeId ? "" : undefined}
        style={{ x, y, width, height, opacity, scale }}
        aria-hidden="true"
      />
      {items.map((item, position) => {
        if (!isAction(item))
          return (
            <span
              key={item.id ?? `separator-${position}`}
              className={cn(
                "flex-none self-center rounded-[1px] bg-(--fbg-rule)",
                vertical ? "my-0.5 h-px w-[calc(var(--fbg-h)*.5)]" : "mx-0.5 h-[calc(var(--fbg-h)*.5)] w-px",
              )}
              role="separator"
              aria-orientation={vertical ? "horizontal" : "vertical"}
            />
          )
        const { id, label: itemLabel, icon, onSelect, disabled = false, pressed, shortcut, reserveLabels = [] } = item
        const iconOnly = !!icon && (item.iconOnly ?? groupIconOnly)
        const active = activeId === id
        const button = (
          /* Buttons are not positioned, so the highlight measures them against the tray and stacks above their background. */
          <button
            ref={node => {
              if (node) nodes.current.set(id, node)
              else nodes.current.delete(id)
            }}
            type="button"
            className={cn(
              size === "sm" ? "text-xs" : "text-sm",
              "m-0 inline-flex h-(--fbg-h) min-w-(--fbg-h) flex-none cursor-pointer touch-manipulation items-center justify-center rounded-(--fbg-radius) border-0 bg-transparent px-(--fbg-pad-x)",
              "leading-none font-medium whitespace-nowrap text-inherit select-none [-webkit-tap-highlight-color:transparent]",
              "[transition:color_var(--duration-fast)_var(--ease-standard),background-color_var(--duration-fast)_var(--ease-standard),opacity_var(--duration-fast)_var(--ease-standard)]",
              reducedTransition,
              icon && !iconOnly && "pl-[calc(var(--fbg-pad-x)-2px)]",
              iconOnly && "w-(--fbg-h) p-0",
              vertical && (iconOnly ? "self-center" : "justify-start"),
              pressed && "bg-(--fbg-on)",
              disabled ? "cursor-not-allowed text-text-muted opacity-50" : (active || pressed) && "text-foreground",
            )}
            data-fbg-item=""
            data-active={active ? "" : undefined}
            data-icon={icon ? "" : undefined}
            data-icon-only={iconOnly ? "" : undefined}
            aria-label={itemLabel}
            aria-pressed={pressed === undefined ? undefined : pressed}
            aria-disabled={disabled || undefined}
            tabIndex={stop === id ? 0 : -1}
            onPointerMove={event => {
              if (event.pointerType === "mouse" || event.pointerType === "pen") setHoverId(id)
            }}
            onPointerDown={event => {
              if (disabled || event.button !== 0) return
              setHoverId(id)
              setPressing(true)
            }}
            onPointerUp={() => setPressing(false)}
            onPointerCancel={() => setPressing(false)}
            onPointerLeave={() => setPressing(false)}
            onKeyDown={event => {
              if ((event.key === "Enter" || event.key === " ") && !event.repeat && !disabled) setPressing(true)
            }}
            onKeyUp={event => {
              if (event.key === "Enter" || event.key === " ") setPressing(false)
            }}
            onFocus={event => {
              setTabStop(id)
              let keyboard = false
              try {
                keyboard = event.currentTarget.matches(":focus-visible")
              } catch {
                keyboard = false
              }
              setFocusId(keyboard ? id : null)
            }}
            onClick={() => {
              if (disabled) return
              onSelect?.()
              onAction?.(id)
            }}
          >
            <ItemBody label={itemLabel} icon={icon} iconOnly={iconOnly} reserve={reserveLabels} reduced={reduced} vertical={vertical} />
          </button>
        )
        // Tooltips render no wrapper element, so every button stays a direct child of the tray and measures against it.
        if (!iconOnly && !shortcut) return <Fragment key={id}>{button}</Fragment>
        const tip = <TipContent label={itemLabel} shortcut={shortcut} />
        return side === "top" || side === "bottom" ? (
          <Tooltip key={id} side={side} content={tip}>
            {button}
          </Tooltip>
        ) : (
          <SideTip key={id} side={side} content={tip}>
            {button}
          </SideTip>
        )
      })}
    </div>
  )

  return side === "left" || side === "right" ? (
    <TooltipPrimitive.Provider delay={250} timeout={300}>
      {group}
    </TooltipPrimitive.Provider>
  ) : (
    group
  )
}

export default FloatingButtonGroup
