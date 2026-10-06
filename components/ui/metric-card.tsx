"use client"

import { useEffect, useRef, useState } from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react"
import type { Variants } from "motion/react"

import { AnimatedCounter } from "@/components/ui/animated-counter"
import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

export interface MetricCardProps {
  label: string
  value: number
  suffix?: string
  context: string
  change?: string
}

/** Copy that holds a number enters from the side it moved toward: a larger value rises from below, a smaller one drops from above. */
const rise: Variants = {
  hidden: (direction: number) => ({
    opacity: 0,
    y: `${0.3 * direction}em`,
    filter: `blur(${motionTokens.blur.soft}px)`,
  }),
  shown: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: motionTokens.duration.standard,
      ease: [...motionTokens.ease.enter],
    },
  },
  gone: (direction: number) => ({
    opacity: 0,
    y: `${-0.3 * direction}em`,
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: {
      duration: motionTokens.duration.fast,
      ease: [...motionTokens.ease.standard],
    },
  }),
}
const fade: Variants = {
  hidden: { opacity: 0, y: 0, filter: "blur(0px)" },
  shown: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: motionTokens.duration.instant },
  },
  gone: {
    opacity: 0,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: motionTokens.duration.instant },
  },
}
const amountIn = (text: string) =>
  Number(text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0] ?? NaN)

/** New copy rises in while the old copy leaves; `morph` springs the wrapper to the new text's width instead of letting it snap.
 *  The outgoing copy is popped out of flow so the wrapper never holds both widths. */
function Swap({
  text,
  morph = false,
  block = false,
}: {
  text: string
  morph?: boolean
  block?: boolean
}) {
  const reduceMotion = !!useReducedMotion()
  const sizer = useRef<HTMLSpanElement>(null)
  const width = useMotionValue<number | "auto">("auto")
  const [shown, setShown] = useState({ text, direction: 1 })
  if (shown.text !== text)
    setShown({
      text,
      direction: amountIn(text) < amountIn(shown.text) ? -1 : 1,
    })
  useEffect(() => {
    const node = sizer.current
    if (!node || typeof ResizeObserver === "undefined") return
    let measured: string | null = null
    // Layout size, not the transformed rect, so a scaling parent never leaves the text clipped. Only a new text springs; font loads jump.
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.borderBoxSize?.[0]?.inlineSize ?? node.offsetWidth
      if (
        next &&
        measured !== null &&
        measured !== node.textContent &&
        !reduceMotion
      )
        animate(width, next, motionTokens.spring.morph)
      else width.jump(next || "auto")
      measured = next ? node.textContent : null
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [morph, reduceMotion, width])
  return (
    <motion.span
      className={cn(
        "relative max-w-full",
        block
          ? "block"
          : "inline-flex overflow-x-clip align-top whitespace-nowrap"
      )}
      style={morph ? { width } : undefined}
    >
      {morph && (
        <span
          ref={sizer}
          className="pointer-events-none invisible absolute top-0 left-0 whitespace-nowrap"
          aria-hidden="true"
        >
          {text}
        </span>
      )}
      <AnimatePresence
        mode="popLayout"
        initial={false}
        custom={shown.direction}
      >
        <motion.span
          key={text}
          className={block ? "block" : "inline-block"}
          custom={shown.direction}
          variants={reduceMotion ? fade : rise}
          initial="hidden"
          animate="shown"
          exit="gone"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  )
}

export function MetricCard({
  label,
  value,
  suffix,
  context,
  change,
}: MetricCardProps) {
  const reduceMotion = !!useReducedMotion()
  return (
    <article className="min-w-0 rounded-surface border border-border bg-surface p-6 shadow-resting max-[380px]:p-4">
      <div className="mb-8 flex items-center justify-between gap-3 max-[380px]:mb-6 max-[380px]:flex-wrap max-[380px]:items-start [&_span]:text-[length:var(--text-sm)] [&_span]:text-text-secondary">
        <span>
          <Swap text={label} block />
        </span>
        <AnimatePresence initial={false}>
          {change && (
            <motion.small
              key="change"
              /* A signed change reads its direction in color as well as sign: a faint tint behind, the color on the text. */
              className={cn(
                "inline-flex flex-none rounded-pill border border-border px-2 py-[3px] text-[length:var(--text-sm)] text-text-secondary tabular-nums",
                "data-trend:border-transparent data-trend:transition-[color,background-color] data-trend:duration-160 data-trend:ease-standard data-trend:[&_span]:text-inherit",
                "data-[trend=up]:bg-[color-mix(in_oklab,var(--success)_11%,transparent)] data-[trend=up]:text-success",
                "data-[trend=down]:bg-[color-mix(in_oklab,var(--danger)_11%,transparent)] data-[trend=down]:text-danger"
              )}
              data-trend={
                /^[+]/.test(change)
                  ? "up"
                  : /^[-−]/.test(change)
                    ? "down"
                    : undefined
              }
              initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{
                opacity: 0,
                scale: reduceMotion ? 1 : 0.96,
                transition: {
                  duration: motionTokens.duration.fast,
                  ease: [...motionTokens.ease.standard],
                },
              }}
              transition={
                reduceMotion ? { duration: 0 } : motionTokens.spring.snappy
              }
            >
              <Swap text={change} morph />
            </motion.small>
          )}
        </AnimatePresence>
      </div>
      <AnimatedCounter value={value} suffix={suffix} animateOnView />
      <p className="mt-4 text-[length:var(--text-sm)] leading-body text-text-muted">
        <Swap text={context} block />
      </p>
    </article>
  )
}

export default MetricCard
