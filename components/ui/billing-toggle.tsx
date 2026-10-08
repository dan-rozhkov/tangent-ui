"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"
import type { KeyboardEvent } from "react"
import { AnimatePresence, motion } from "motion/react"
import type { Transition, Variants } from "motion/react"

import { AnimatedCounter } from "@/components/ui/animated-counter"
import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface BillingToggleOption {
  value: string
  label: string
  /** Short savings note, e.g. "Save 20%". */
  badge?: string
  /** Badge text once this option is selected, e.g. "You save $48". Defaults to `badge`. */
  activeBadge?: string
}

export interface BillingToggleProps {
  value: string
  onValueChange: (value: string) => void
  options?: BillingToggleOption[]
  /** Accessible name of the group. */
  label?: string
  size?: "md" | "lg"
  className?: string
}

const { duration, ease, blur } = motionTokens

/** Critically damped: the thumb glides and lands without overshoot. */
const glide: Transition = { type: "spring", visualDuration: 0.34, bounce: 0 }

const DEFAULT_OPTIONS: BillingToggleOption[] = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly", badge: "Save 20%" },
]

const swap: Variants = {
  hidden: { opacity: 0, y: "0.45em", filter: `blur(${blur.subtle}px)` },
  shown: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: duration.standard, ease: [...ease.enter] },
  },
  gone: {
    opacity: 0,
    y: "-0.45em",
    filter: `blur(${blur.subtle}px)`,
    transition: { duration: duration.fast, ease: [...ease.standard] },
  },
}
const still: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: duration.fast } },
  gone: { opacity: 0, transition: { duration: 0 } },
}

/* Stacked swap: every candidate reserves the cell, the visible one crossfades on top. */
const swapClass =
  "relative inline-grid justify-items-center overflow-y-clip [overflow-clip-margin:2px]"

/**
 * Text that swaps in place. Every candidate sits in the same grid cell, so the box always has the
 * width of the longest one and nothing around it moves when the text changes.
 */
function StableSwap({
  text,
  candidates,
  reduced,
  className,
}: {
  text: string
  candidates: string[]
  reduced: boolean
  className?: string
}) {
  return (
    <span className={cn(swapClass, className)}>
      {[...new Set(candidates)].map((candidate) => (
        <span
          key={candidate}
          className="invisible [grid-area:1/1]"
          aria-hidden="true"
        >
          {candidate}
        </span>
      ))}
      <AnimatePresence initial={false}>
        <motion.span
          key={text}
          className="inline-block [grid-area:1/1]"
          variants={reduced ? still : swap}
          initial="hidden"
          animate="shown"
          exit="gone"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

type Thumb = { x: number; width: number }

/** One thumb for the whole track. Its position and width are measured from the selected option. */
const thumbClass =
  "pointer-events-none absolute -z-1 rounded-pill bg-surface-raised shadow-[0_0_0_1px_var(--border-subtle),0_1px_2px_color-mix(in_oklab,var(--shade)_6%,transparent),0_2px_6px_color-mix(in_oklab,var(--shade)_4%,transparent)] dark:shadow-[0_0_0_1px_var(--border),inset_0_1px_0_color-mix(in_oklab,var(--sheen)_5%,transparent),0_1px_2px_color-mix(in_oklab,var(--shade)_30%,transparent)]"

/**
 * A billing period switch. One thumb glides between the options on a critically damped spring, and
 * the savings note on the cheaper period tints and rewrites itself in place once it is chosen.
 */
export function BillingToggle({
  value,
  onValueChange,
  options = DEFAULT_OPTIONS,
  label = "Billing period",
  size = "md",
  className,
}: BillingToggleProps) {
  const reduced = !!useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const [thumb, setThumb] = useState<Thumb | null>(null)
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  )

  const measure = useCallback(() => {
    const node = refs.current[selectedIndex]
    if (!node) return
    setThumb((current) =>
      current &&
      current.x === node.offsetLeft &&
      current.width === node.offsetWidth
        ? current
        : { x: node.offsetLeft, width: node.offsetWidth }
    )
  }, [selectedIndex])

  useLayoutEffect(() => {
    measure()
    const root = rootRef.current
    if (!root || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [measure])

  const onKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0
    const target =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : step
            ? (index + step + options.length) % options.length
            : -1
    if (target < 0) return
    event.preventDefault()
    onValueChange(options[target].value)
    refs.current[target]?.focus()
  }

  const large = size === "lg"

  return (
    <div
      ref={rootRef}
      role="radiogroup"
      aria-label={label}
      /* Override --billing-accent on any ancestor to recolor the savings note. */
      className={cn(
        "relative isolate inline-flex max-w-full items-center rounded-pill border border-border-subtle bg-surface-muted font-sans leading-none tracking-body",
        "[--bt-accent:var(--billing-accent,var(--success))]",
        large
          ? "text-[length:var(--text-base)] [--bt-h:42px] [--bt-pad:4px]"
          : "text-[length:var(--text-sm)] [--bt-h:34px] [--bt-pad:3px]",
        "p-[var(--bt-pad)]",
        className
      )}
      data-size={size}
    >
      {thumb ? (
        <motion.span
          className={cn(
            thumbClass,
            "top-[var(--bt-pad)] bottom-[var(--bt-pad)] left-0 will-change-[transform,width]"
          )}
          aria-hidden="true"
          initial={false}
          animate={{ x: thumb.x, width: thumb.width }}
          transition={reduced ? { duration: 0 } : glide}
        />
      ) : null}
      {options.map((option, index) => {
        const selected = index === selectedIndex
        const badgeText = selected
          ? (option.activeBadge ?? option.badge)
          : option.badge
        const candidates = [option.badge, option.activeBadge].filter(
          (text): text is string => !!text
        )
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={cn(
              "group/option relative inline-flex h-[var(--bt-h)] min-w-0 cursor-pointer items-center rounded-pill border-0 bg-transparent tracking-[inherit] whitespace-nowrap text-text-muted [font:inherit]",
              "transition-[color] duration-160 ease-standard [-webkit-tap-highlight-color:transparent]",
              large ? "px-[18px]" : "px-[14px]",
              badgeText && (large ? "pr-[6px]" : "pr-[5px]"),
              "data-selected:cursor-default data-selected:text-foreground",
              "pointer-fine:hover:not-data-selected:text-text-secondary"
            )}
            data-selected={selected || undefined}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {selected && !thumb ? (
              <span className={cn(thumbClass, "inset-0")} aria-hidden="true" />
            ) : null}
            <span className="relative inline-flex items-center gap-2 transition-transform duration-160 ease-standard group-[:not([data-selected]):active]/option:scale-[.97] motion-reduce:transition-none">
              <span className="font-medium">{option.label}</span>
              {badgeText ? (
                /* The savings note: quiet until its option is chosen, then it takes the accent tint. */
                <span
                  className={cn(
                    "inline-flex h-[calc(var(--bt-h)-10px)] items-center rounded-pill bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] px-2 text-[length:var(--text-xs)] font-medium text-text-secondary tabular-nums",
                    "transition-[background-color,color] duration-240 ease-standard motion-reduce:transition-none",
                    selected &&
                      "bg-[color-mix(in_oklab,var(--bt-accent)_13%,transparent)] text-[color-mix(in_oklab,var(--bt-accent)_88%,var(--foreground))] dark:bg-[color-mix(in_oklab,var(--bt-accent)_18%,transparent)] dark:text-(--bt-accent)"
                  )}
                  data-active={selected || undefined}
                >
                  <StableSwap
                    text={badgeText}
                    candidates={candidates}
                    reduced={reduced}
                  />
                </span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export interface BillingPriceProps {
  amount: number
  currency?: string
  /** Period after the price, e.g. "per month". Swaps in place when it changes. */
  period?: string
  /** Previous price, shown struck through when it is higher than `amount`. */
  was?: number
  decimals?: number
  className?: string
}

const clip: Transition = { type: "spring", visualDuration: 0.36, bounce: 0 }

/** A price that rolls to its new amount. The old price and the period ease their width, so nothing beside them jumps. */
export function BillingPrice({
  amount,
  currency = "$",
  period,
  was,
  decimals = 0,
  className,
}: BillingPriceProps) {
  const reduced = !!useReducedMotion()
  const showWas = was !== undefined && was > amount
  const periodRef = useRef<HTMLSpanElement>(null)
  const [periodWidth, setPeriodWidth] = useState<number | null>(null)

  useLayoutEffect(() => {
    const sizer = periodRef.current
    if (sizer) setPeriodWidth(sizer.offsetWidth)
  }, [period])

  return (
    <span
      className={cn(
        "inline-flex min-w-0 flex-wrap items-end gap-x-2.5 gap-y-1",
        className
      )}
    >
      <span className="inline-flex items-start font-display text-[length:var(--text-3xl)] leading-none font-normal tracking-display text-foreground tabular-nums">
        <span className="mt-[.12em] mr-[.04em] text-[.55em] text-text-secondary">
          {currency}
        </span>
        <span className="inline-flex [&>span]:![letter-spacing:inherit] [&>span]:![font:inherit]">
          <AnimatedCounter value={amount} decimals={decimals} />
        </span>
      </span>
      <span className="inline-flex items-baseline pb-[.3em] text-[length:var(--text-sm)] leading-body whitespace-nowrap text-text-muted">
        <AnimatePresence initial={false}>
          {showWas ? (
            <motion.span
              key="was"
              className="inline-block overflow-x-clip"
              initial={reduced ? { opacity: 0 } : { opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={
                reduced
                  ? { opacity: 0, transition: { duration: 0 } }
                  : {
                      opacity: 0,
                      width: 0,
                      transition: {
                        ...clip,
                        opacity: { duration: duration.fast },
                      },
                    }
              }
              transition={
                reduced
                  ? { duration: duration.fast }
                  : {
                      ...clip,
                      opacity: {
                        duration: duration.standard,
                        ease: [...ease.enter],
                      },
                    }
              }
            >
              <del className="inline-block pr-1.5 text-text-muted tabular-nums [text-decoration-thickness:1px]">
                {currency}
                {was.toFixed(decimals)}
              </del>
            </motion.span>
          ) : null}
        </AnimatePresence>
        {period ? (
          <motion.span
            className="relative inline-block overflow-x-clip [overflow-clip-margin:2px]"
            initial={false}
            animate={periodWidth === null ? undefined : { width: periodWidth }}
            transition={reduced ? { duration: 0 } : clip}
          >
            <span
              ref={periodRef}
              className="invisible inline-block"
              aria-hidden="true"
            >
              {period}
            </span>
            <AnimatePresence initial={false}>
              <motion.span
                key={period}
                className="absolute top-0 left-0 inline-block"
                variants={reduced ? still : swap}
                initial="hidden"
                animate="shown"
                exit="gone"
              >
                {period}
              </motion.span>
            </AnimatePresence>
          </motion.span>
        ) : null}
      </span>
    </span>
  )
}

export default BillingToggle
