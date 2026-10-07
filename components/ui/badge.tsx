"use client"

import { isValidElement, useEffect, useLayoutEffect, useRef } from "react"
import type { HTMLAttributes, ReactNode } from "react"
import { cva } from "class-variance-authority"
import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  type AnimationPlaybackControls,
  type HTMLMotionProps,
  type TargetAndTransition,
  type Transition,
} from "motion/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export type BadgeTone = "neutral" | "success" | "info" | "warning" | "danger"
export type BadgeSize = "sm" | "md"

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  size?: BadgeSize
  icon?: ReactNode
}

/* Clip keeps the inline baseline while the pill morphs around swapped text. */
const badgeVariants = cva(
  [
    "inline-flex items-center overflow-clip rounded-pill border border-(color:--badge-border) bg-(--badge-background)",
    "text-(color:--badge-foreground) font-medium tracking-[-.01em] whitespace-nowrap",
    "transition-[border-color,background-color,color] duration-240 ease-standard motion-reduce:duration-120",
    "pointer-fine:hover:border-[color-mix(in_oklab,var(--badge-color)_32%,var(--border))] pointer-fine:hover:bg-[color-mix(in_oklab,var(--badge-color)_10%,var(--surface))]",
  ],
  {
    variants: {
      tone: {
        neutral:
          "[--badge-background:var(--surface-muted)] [--badge-border:var(--border)] [--badge-color:var(--text-secondary)] [--badge-foreground:var(--text-secondary)]",
        success:
          "[--badge-background:color-mix(in_oklab,var(--success)_10%,var(--surface))] [--badge-border:color-mix(in_oklab,var(--success)_25%,var(--border))] [--badge-color:var(--success)] [--badge-foreground:var(--success)]",
        info: "[--badge-background:var(--accent-subtle)] [--badge-border:color-mix(in_oklab,var(--accent)_24%,var(--border))] [--badge-color:var(--accent)] [--badge-foreground:var(--accent-strong)]",
        warning:
          "[--badge-background:color-mix(in_oklab,var(--warning)_11%,var(--surface))] [--badge-border:color-mix(in_oklab,var(--warning)_27%,var(--border))] [--badge-color:var(--warning)] [--badge-foreground:var(--warning)]",
        danger:
          "[--badge-background:color-mix(in_oklab,var(--danger)_10%,var(--surface))] [--badge-border:color-mix(in_oklab,var(--danger)_26%,var(--border))] [--badge-color:var(--danger)] [--badge-foreground:var(--danger)]",
      },
      size: {
        sm: "min-h-[22px] px-2 text-[11px] leading-none",
        md: "min-h-[26px] px-2.5 text-(length:--text-xs) leading-none",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
)

const exitFast: Transition = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }
const textIn: TargetAndTransition = { opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.soft}px)` }
const textOut: TargetAndTransition = { opacity: 0, y: "-0.3em", filter: `blur(${motionTokens.blur.subtle}px)`, transition: exitFast }
const iconIn: TargetAndTransition = { opacity: 0, scale: 0.6, filter: `blur(${motionTokens.blur.subtle}px)` }
const shown: TargetAndTransition = { opacity: 1, y: "0em", scale: 1, filter: "blur(0px)" }
const fadeOnly: TargetAndTransition = { opacity: 0, transition: { duration: motionTokens.duration.instant } }

/** Outgoing copies are hidden from assistive tech while they fade, so only the current text is read. */
function Swap(props: HTMLMotionProps<"span">) {
  const present = useIsPresent()
  return <motion.span {...props} aria-hidden={present ? props["aria-hidden"] : true} />
}

/** A new icon component crossfades in; re-rendering the same icon stays still. */
function iconKey(icon: ReactNode) {
  if (!isValidElement(icon)) return "icon"
  const type = icon.type as string | { displayName?: string; name?: string }
  return typeof type === "string" ? type : (type.displayName ?? type.name ?? "icon")
}

export function Badge({ tone = "neutral", size = "md", icon, className, children, ...props }: BadgeProps) {
  const reduce = useReducedMotion()
  const text = typeof children === "string" || typeof children === "number" ? String(children) : null
  const glyphKey = icon ? iconKey(icon) : ""
  const body = useRef<HTMLSpanElement>(null)
  const content = useRef<HTMLSpanElement>(null)
  // Width stays auto at rest. Only a new label or icon springs it from the old size to the new one; passive reflows (a font swap, a hidden parent) follow instantly.
  const width = useMotionValue<number | "auto">("auto")
  const changedAt = useRef(0)
  useLayoutEffect(() => {
    changedAt.current = performance.now()
  }, [text, glyphKey])
  useEffect(() => {
    const node = content.current
    if (!node || typeof ResizeObserver === "undefined") return
    let last: number | undefined
    let controls: AnimationPlaybackControls | undefined
    const settle = () => {
      width.jump("auto")
      if (body.current) body.current.style.width = "auto"
    }
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.borderBoxSize?.[0]?.inlineSize ?? node.offsetWidth
      const current = width.get()
      const from = typeof current === "number" ? current : last
      last = next
      controls?.stop()
      if (reduce || from === undefined || from === next || performance.now() - changedAt.current > 120) return settle()
      // Pin the old width before this frame paints, then spring to the new one.
      if (body.current) body.current.style.width = `${from}px`
      controls = animate(width, [from, next], { ...motionTokens.spring.morph, onComplete: settle })
    })
    observer.observe(node)
    return () => {
      observer.disconnect()
      controls?.stop()
    }
  }, [width, reduce])
  const enter: Transition = reduce
    ? { duration: motionTokens.duration.instant }
    : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }
  // The pill follows its content: text and icon swap in place while the width springs to the new size.
  return (
    <span {...props} className={cn(badgeVariants({ tone, size }), className)}>
      <motion.span ref={body} className="block" style={{ width }}>
        <span ref={content} className={cn("relative inline-flex w-max items-center", size === "sm" ? "gap-1" : "gap-[5px]")}>
          {icon ? (
            <span
              className="relative inline-flex h-auto w-auto flex-none items-center justify-center leading-none text-(color:--badge-color)"
              aria-hidden="true"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <Swap
                  key={glyphKey}
                  className="relative inline-flex items-center"
                  initial={reduce ? { opacity: 0 } : iconIn}
                  animate={shown}
                  exit={reduce ? fadeOnly : { ...iconIn, transition: exitFast }}
                  transition={reduce ? enter : motionTokens.spring.snappy}
                >
                  {icon}
                </Swap>
              </AnimatePresence>
            </span>
          ) : null}
          {text === null ? (
            children
          ) : (
            <span className="relative inline-flex items-center">
              <AnimatePresence mode="popLayout" initial={false}>
                <Swap
                  key={text}
                  className="block"
                  initial={reduce ? { opacity: 0 } : textIn}
                  animate={shown}
                  exit={reduce ? fadeOnly : textOut}
                  transition={enter}
                >
                  {text}
                </Swap>
              </AnimatePresence>
            </span>
          )}
        </span>
      </motion.span>
    </span>
  )
}

export { badgeVariants }
export default Badge
