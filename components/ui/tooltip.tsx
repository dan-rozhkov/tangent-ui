"use client"

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import type { ReactElement, ReactNode } from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { motionTokens } from "@/lib/motion-tokens"

export interface TooltipProps {
  content: ReactNode
  children: ReactElement
  side?: "top" | "bottom"
}

const DELAY = 250
const SKIP_WINDOW = 300

/* Every Tooltip stands alone, so the skip window is shared here: while any tooltip is open, and briefly after the last one closes, the next opens without delay or travel. */
let warm = false
let openCount = 0
let coolTimer = 0
const listeners = new Set<() => void>()
const warmth = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  get: () => warm,
  set(next: boolean) {
    if (warm === next) return
    warm = next
    listeners.forEach((listener) => listener())
  },
  opened() {
    openCount += 1
    window.clearTimeout(coolTimer)
    warmth.set(true)
  },
  closed() {
    openCount = Math.max(0, openCount - 1)
    if (openCount) return
    window.clearTimeout(coolTimer)
    coolTimer = window.setTimeout(() => warmth.set(false), SKIP_WINDOW)
  },
}

const lineWidth = "max-w-[calc(15rem-2*var(--space-4)-2px)]"

/** String content crossfades when it changes while open, and the bubble springs to the new text size. */
function TooltipText({ text }: { text: string }) {
  const reduced = useReducedMotion()
  const measure = useRef<HTMLSpanElement>(null)
  const measured = useRef<string | null>(null)
  const [size, setSize] = useState<{ width: number; height: number; animate: boolean } | null>(null)
  useLayoutEffect(() => {
    const node = measure.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.borderBoxSize?.[0]
      const current = node.textContent
      const animate = measured.current !== null && measured.current !== current
      measured.current = current
      setSize({
        width: Math.ceil(box?.inlineSize ?? node.offsetWidth),
        height: Math.ceil(box?.blockSize ?? node.offsetHeight),
        animate,
      })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return (
    <motion.span
      className="relative block overflow-clip [overflow-clip-margin:var(--space-2)]"
      initial={false}
      animate={size ? { width: size.width, height: size.height } : undefined}
      transition={size?.animate && !reduced ? motionTokens.spring.morph : { duration: 0 }}
    >
      <span ref={measure} className={`pointer-events-none invisible absolute top-0 left-0 w-max ${lineWidth}`} aria-hidden="true">
        {text}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          className={`block w-max ${lineWidth}`}
          initial={reduced ? false : { opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.soft}px)` }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0 } }
              : {
                  opacity: 0,
                  y: "-0.3em",
                  filter: `blur(${motionTokens.blur.subtle}px)`,
                  transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] },
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

/* The first tooltip waits, then rises a few pixels from its trigger. Within the skip window the next one only fades.
   Transitions instead of keyframes, so returning to the trigger while it fades out reverses the fade instead of restarting it.
   Base UI writes its own data-instant, so the skip window travels as data-warm. */
const tooltipClass = [
  "[--tooltip-y:3px] data-[side=bottom]:[--tooltip-y:-3px]",
  "max-w-60 rounded-control border border-[color-mix(in_oklab,var(--background)_14%,var(--foreground))] bg-foreground px-4 py-3 text-background shadow-raised",
  "text-sm leading-body font-normal origin-(--transform-origin)",
  "[transition:opacity_var(--duration-fast)_var(--ease-enter),transform_var(--duration-fast)_var(--ease-enter)]",
  "data-starting-style:opacity-0 data-starting-style:[transform:translateY(var(--tooltip-y))_scale(.97)] data-warm:data-starting-style:[transform:none]",
  "data-warm:data-open:[transition:opacity_var(--duration-instant)_var(--ease-standard),transform_var(--duration-instant)_var(--ease-standard)]",
  "data-ending-style:opacity-0 data-ending-style:[transform:scale(.98)]",
  "data-ending-style:[transition:opacity_var(--duration-instant)_var(--ease-standard),transform_var(--duration-instant)_var(--ease-standard)]",
  "motion-reduce:[transform:none]! motion-reduce:[transition:opacity_var(--duration-instant)_var(--ease-standard)]!",
].join(" ")

export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  const isWarm = useSyncExternalStore(warmth.subscribe, warmth.get, () => false)
  // Controlled so the instant flag lands in the same render that mounts the content.
  const [open, setOpen] = useState(false)
  const [instant, setInstant] = useState(false)
  useEffect(() => {
    if (!open) return
    warmth.opened()
    return warmth.closed
  }, [open])
  return (
    <TooltipPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setInstant(warmth.get())
        setOpen(next)
      }}
    >
      <TooltipPrimitive.Trigger delay={isWarm ? 0 : DELAY} render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner className="z-90" side={side} sideOffset={8} collisionPadding={12}>
          <TooltipPrimitive.Popup className={tooltipClass} data-warm={instant || undefined}>
            {typeof content === "string" || typeof content === "number" ? <TooltipText text={String(content)} /> : content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export default Tooltip
