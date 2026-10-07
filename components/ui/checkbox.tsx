"use client"

import { forwardRef, useId, useState } from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { motion } from "motion/react"
import type { Transition } from "motion/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

/** Ticked, unticked, or mixed. Base UI splits mixed into its own `indeterminate` prop; this keeps the single-value API. */
export type CheckedState = boolean | "indeterminate"

export interface CheckboxProps
  extends Omit<
    CheckboxPrimitive.Root.Props,
    "checked" | "defaultChecked" | "onCheckedChange" | "indeterminate" | "className" | "render" | "nativeButton"
  > {
  checked?: CheckedState
  defaultChecked?: CheckedState
  onCheckedChange?: (checked: CheckedState) => void
  className?: string
  label?: string
  description?: string
}

/** Both marks share three points, so the check morphs into the dash and back instead of swapping. */
const checkPath = "M4.25 9.25 L7.25 12.25 L13.75 5.75"
const dashPath = "M4.75 9 L9 9 L13.25 9"

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { label, description, id, className, checked, defaultChecked, onCheckedChange, ...props },
  ref,
) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const reduced = useReducedMotion()
  const [internal, setInternal] = useState<CheckedState>(defaultChecked ?? false)
  const state = checked ?? internal
  const on = state !== false
  // A mixed box reports unticked to Base UI, so a press ticks it, as a native mixed checkbox does.
  const change = (next: CheckedState) => {
    if (checked === undefined) setInternal(next)
    onCheckedChange?.(next)
  }
  const fade: Transition = {
    duration: on ? motionTokens.duration.instant : motionTokens.duration.fast,
    ease: [...motionTokens.ease.standard],
  }
  return (
    <div className="inline-flex min-w-0 items-start gap-0">
      <CheckboxPrimitive.Root
        {...props}
        id={controlId}
        ref={ref}
        checked={state === true}
        indeterminate={state === "indeterminate"}
        onCheckedChange={next => change(next)}
        // A native button keeps the id, so the label below points at the control itself.
        nativeButton
        render={<button type="button" />}
        className={cn(
          "group/checkbox relative grid size-control-md flex-none cursor-pointer place-items-center rounded-control border-0 bg-transparent p-0 text-control-glyph [-webkit-tap-highlight-color:transparent]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        aria-describedby={description ? `${controlId}-description` : undefined}
        aria-label={props["aria-label"] ?? (label ? undefined : "Checkbox")}
      >
        {/* The square is the only part that reacts to a press, so the hit area and label never move. */}
        <span
          className={cn(
            "relative block size-[18px] rounded-[5px] border border-border-strong bg-surface",
            "[transition:border-color_var(--duration-fast)_var(--ease-standard),transform_var(--duration-spring)_var(--ease-spring)]",
            "group-data-checked/checkbox:border-control-on group-data-indeterminate/checkbox:border-control-on",
            "pointer-fine:group-hover/checkbox:group-data-unchecked/checkbox:group-enabled/checkbox:border-text-muted",
            "motion-safe:group-active/checkbox:group-enabled/checkbox:[transform:scale(.95)]",
            "motion-safe:group-active/checkbox:group-enabled/checkbox:[transition:border-color_var(--duration-fast)_var(--ease-standard),transform_var(--duration-instant)_var(--ease-standard)]",
            "motion-reduce:transition-none",
          )}
          aria-hidden="true"
        >
          <motion.span
            className="absolute -inset-px rounded-[inherit] bg-control-on"
            initial={false}
            animate={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.6 }}
            transition={reduced ? { duration: 0 } : { scale: motionTokens.spring.snappy, opacity: fade }}
          />
          <svg className="absolute -inset-px size-[18px] overflow-visible" viewBox="0 0 18 18" fill="none" focusable="false">
            <motion.path
              initial={false}
              animate={{
                d: state === "indeterminate" ? dashPath : checkPath,
                pathLength: on ? 1 : 0,
                opacity: on ? 1 : 0,
              }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { d: motionTokens.spring.morph, pathLength: motionTokens.spring.snappy, opacity: fade }
              }
              stroke="currentColor"
              strokeWidth={1.125}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </CheckboxPrimitive.Root>
      {label || description ? (
        /* The label's first line centers on the square: (44px box - 19.6px line) / 2. */
        <div className="ml-px grid min-w-0 gap-0.5 pt-[calc((var(--control-height-md)-var(--text-sm)*1.4)/2)]">
          {label ? (
            <label htmlFor={controlId} className="cursor-pointer text-sm leading-body font-medium text-foreground">
              {label}
            </label>
          ) : null}
          {description ? (
            <span id={`${controlId}-description`} className="text-xs leading-body text-text-muted">
              {description}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
})

Checkbox.displayName = "Checkbox"
