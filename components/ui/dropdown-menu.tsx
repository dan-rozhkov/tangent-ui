"use client"

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { CSSProperties, FocusEvent, ReactNode } from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { AnimatePresence, motion } from "motion/react"
import { ChevronDown } from "@mynaui/icons-react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface DropdownItem {
  label: string
  onSelect?: () => void
  disabled?: boolean
  icon?: ReactNode
  destructive?: boolean
  separatorBefore?: boolean
}
export interface DropdownMenuProps {
  label: string
  items: DropdownItem[]
  icon?: ReactNode
}

type Highlight = { top: number; height: number; danger: boolean; glide: boolean }

/* The trigger anchors the menu, so press feedback stays in color. A scaled rect would be measured on press and shift the menu. */
const triggerClass = [
  "group/trigger inline-flex max-w-full min-h-control-sm cursor-pointer items-center gap-2 rounded-control border border-border bg-surface px-3",
  "text-sm font-medium text-foreground",
  "[transition:background-color_var(--duration-instant)_var(--ease-standard),border-color_var(--duration-fast)_var(--ease-standard),box-shadow_var(--duration-fast)_var(--ease-standard)] motion-reduce:transition-none",
  "pointer-fine:hover:not-active:not-data-popup-open:border-border-strong pointer-fine:hover:not-active:not-data-popup-open:bg-surface-muted pointer-fine:hover:not-active:not-data-popup-open:shadow-resting",
  "data-popup-open:not-active:border-border-strong data-popup-open:not-active:bg-surface-muted data-popup-open:shadow-none",
  "active:border-border-strong active:bg-[color-mix(in_oklab,var(--surface-muted),var(--border)_55%)] active:shadow-none",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)",
].join(" ")

/* The menu grows from the trigger edge: offset toward the trigger, scale from the positioner's origin, fade quickly.
   Transitions instead of keyframes, so a close that interrupts the open (or a reopen during the close) reverses from where it is.
   Base UI waits for the running transitions before it unmounts, so no timing keyframe is needed. */
const menuClass = [
  "[--menu-x:0px] [--menu-y:-5px] data-[side=top]:[--menu-y:5px]",
  "data-[side=left]:[--menu-x:5px] data-[side=left]:[--menu-y:0px] data-[side=right]:[--menu-x:-5px] data-[side=right]:[--menu-y:0px]",
  "relative max-w-(--available-width) min-w-[min(12rem,var(--available-width))] rounded-panel border border-border bg-surface-raised p-[5px] shadow-floating outline-none",
  "origin-(--transform-origin) [transition:opacity_var(--duration-fast)_var(--ease-enter),transform_var(--duration-spring)_var(--ease-spring)]",
  "data-starting-style:[transform:translate(var(--menu-x),var(--menu-y))_scale(.97)] data-starting-style:opacity-0",
  "data-ending-style:pointer-events-none data-ending-style:[transform:translate(calc(var(--menu-x)*.5),calc(var(--menu-y)*.5))_scale(.985)] data-ending-style:opacity-0",
  "data-ending-style:[transition:opacity_130ms_var(--ease-standard),transform_130ms_var(--ease-standard)]",
  "motion-reduce:[transform:none]! motion-reduce:[transition:opacity_var(--duration-instant)_linear]!",
].join(" ")

const itemClass = [
  "relative flex min-h-9 cursor-pointer items-center gap-[10px] rounded-[calc(var(--radius-panel)-6px)] px-[11px] text-sm text-foreground outline-none focus-visible:outline-none",
  "[transition:color_var(--duration-fast)_var(--ease-standard),opacity_var(--duration-standard)_var(--ease-enter)_calc(min(var(--i,0),4)*35ms),transform_var(--duration-standard)_var(--ease-enter)_calc(min(var(--i,0),4)*35ms)]",
  "in-data-starting-style:[transform:translate(calc(var(--menu-x)*.4),calc(var(--menu-y)*.4))] in-data-starting-style:opacity-0",
  "data-disabled:cursor-default data-disabled:opacity-45 motion-reduce:transition-none",
].join(" ")

/** A new trigger label rises in while the old one leaves, and the trigger width springs to the measured text instead of snapping. */
function TriggerLabel({ text }: { text: string }) {
  const reduced = useReducedMotion()
  const measure = useRef<HTMLSpanElement>(null)
  const measured = useRef<string | null>(null)
  const [size, setSize] = useState<{ width: number | "auto"; animate: boolean }>({ width: "auto", animate: false })
  useLayoutEffect(() => {
    const node = measure.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      const current = node.textContent
      // Only a text change morphs; the first measure and font swaps settle instantly.
      const animate = measured.current !== null && measured.current !== current
      measured.current = current
      setSize({ width: Math.ceil(entry.borderBoxSize?.[0]?.inlineSize ?? node.offsetWidth), animate })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return (
    <motion.span
      className="relative inline-flex min-w-0 flex-[0_1_auto] overflow-x-clip"
      initial={false}
      animate={{ width: size.width }}
      transition={size.animate && !reduced ? motionTokens.spring.morph : { duration: 0 }}
    >
      <span
        ref={measure}
        className="pointer-events-none invisible absolute top-0 left-0 whitespace-nowrap"
        aria-hidden="true"
      >
        {text}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          className="block min-w-0 truncate"
          initial={reduced ? false : { opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.soft}px)` }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0 } }
              : {
                  opacity: 0,
                  y: "-0.3em",
                  filter: `blur(${motionTokens.blur.subtle}px)`,
                  transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
                }
          }
          transition={{ duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  )
}

export function DropdownMenu({ label, items, icon }: DropdownMenuProps) {
  const reduced = useReducedMotion()
  const [highlight, setHighlight] = useState<Highlight | null>(null)
  const pointer = useRef(false)
  const clearTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(clearTimer.current), [])
  // Base UI focuses the highlighted item (pointer or keyboard) and the popup when the pointer leaves an item.
  function onMenuFocus(event: FocusEvent<HTMLDivElement>) {
    const item = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[role="menuitem"]') : null
    window.clearTimeout(clearTimer.current)
    if (!item) {
      // A short grace period keeps the highlight gliding across separators and item gaps.
      clearTimer.current = window.setTimeout(() => setHighlight(null), pointer.current ? 70 : 0)
      return
    }
    const next = { top: item.offsetTop, height: item.offsetHeight, danger: item.dataset.tone === "danger" }
    const glide = pointer.current
    setHighlight(current => ({ ...next, glide: glide && current !== null }))
  }
  return (
    <MenuPrimitive.Root
      onOpenChange={open => {
        if (open) {
          window.clearTimeout(clearTimer.current)
          setHighlight(null)
        }
      }}
    >
      <MenuPrimitive.Trigger className={triggerClass} type="button">
        {icon && (
          <span className="inline-flex flex-none text-text-secondary" aria-hidden="true">
            {icon}
          </span>
        )}
        <TriggerLabel text={label} />
        <ChevronDown
          className="flex-none text-text-muted [transition:rotate_var(--duration-spring)_var(--ease-spring),color_var(--duration-fast)_var(--ease-standard)] group-data-popup-open/trigger:rotate-180 motion-reduce:transition-none"
          size={15}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner className="z-60" sideOffset={6} align="end" collisionPadding={12}>
          <MenuPrimitive.Popup
            className={menuClass}
            onFocus={onMenuFocus}
            onPointerMoveCapture={() => {
              pointer.current = true
            }}
            onKeyDownCapture={() => {
              pointer.current = false
            }}
          >
            {/* One highlight glides between items for the pointer and jumps instantly for the keyboard. */}
            <motion.span
              className="pointer-events-none absolute top-0 right-[5px] left-[5px] rounded-[calc(var(--radius-panel)-6px)] bg-surface-muted opacity-0 transition-colors duration-160 ease-standard data-[tone=danger]:bg-[color-mix(in_oklab,var(--danger)_8%,var(--surface))] motion-reduce:transition-none"
              data-tone={highlight?.danger ? "danger" : undefined}
              aria-hidden="true"
              initial={false}
              animate={highlight ? { y: highlight.top, height: highlight.height, opacity: 1 } : { opacity: 0 }}
              transition={{
                default: highlight?.glide && !reduced ? motionTokens.spring.snappy : { duration: 0 },
                opacity: { duration: reduced ? 0 : 0.08 },
              }}
            />
            {items.map((item, index) => (
              <Fragment key={item.label}>
                {item.separatorBefore && <MenuPrimitive.Separator className="-mx-1 my-1 h-px bg-border-subtle" />}
                <MenuPrimitive.Item
                  className={cn(itemClass, item.destructive && "text-danger")}
                  data-tone={item.destructive ? "danger" : undefined}
                  style={{ "--i": index } as CSSProperties}
                  disabled={item.disabled}
                  onClick={item.onSelect}
                >
                  {item.icon && (
                    <span
                      className={cn("inline-flex w-[17px] text-text-secondary", item.destructive && "text-danger")}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                  )}
                  {item.label}
                </MenuPrimitive.Item>
              </Fragment>
            ))}
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  )
}

export default DropdownMenu
