"use client"

import { forwardRef, useId, useState } from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { AnimatePresence, motion } from "motion/react"
import type { Variants } from "motion/react"
import { CaretDownIcon, CaretUpIcon, CheckIcon } from "@phosphor-icons/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

type RootProps = SelectPrimitive.Root.Props<string>

export interface SelectProps
  extends Pick<RootProps, "open" | "defaultOpen" | "name" | "form" | "autoComplete" | "required" | "disabled" | "readOnly" | "modal" | "inputRef"> {
  label: string
  description?: string
  placeholder?: string
  id?: string
  className?: string
  options: { value: string; label: string; disabled?: boolean }[]
  /** The selected value. An empty string shows the placeholder. */
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  onOpenChange?: (open: boolean) => void
}

/** The shown value rolls in the direction of the list: a later option rises from below, an earlier one drops from above. */
const valueRoll: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${direction * 0.35}em`, filter: `blur(${motionTokens.blur.soft}px)` }),
  center: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] },
  },
  exit: (direction: number) => ({
    opacity: 0,
    y: `${direction * -0.3}em`,
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
  }),
}
/** Reduced motion keeps a short crossfade; the resting state matches valueRoll so server and client markup agree. */
const valueFade: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.instant } },
  exit: { opacity: 0, transition: { duration: motionTokens.duration.instant } },
}

/* The trigger anchors the floating menu. Base UI opens on press and measures this box, so it never scales: press feedback is color only. */
const triggerClass = [
  "relative box-border flex min-h-control-md w-full cursor-pointer items-center justify-between gap-3 rounded-control border border-border bg-surface px-3",
  "text-left text-sm text-foreground outline-none",
  "[transition:border-color_var(--duration-fast)_var(--ease-standard),background-color_var(--duration-fast)_var(--ease-standard),box-shadow_var(--duration-fast)_var(--ease-standard)]",
  "pointer-fine:hover:not-data-disabled:border-border-strong pointer-fine:hover:not-data-disabled:bg-surface-muted",
  "active:not-data-disabled:border-border-strong active:not-data-disabled:bg-surface-muted data-popup-open:border-border-strong data-popup-open:bg-surface-muted",
  "focus-visible:border-border-strong data-disabled:cursor-not-allowed data-disabled:opacity-50 motion-reduce:transition-none",
].join(" ")

/* The menu grows from the trigger edge. Keyframes, like the original, so every open replays from the edge; Base UI waits for them before it hides the menu. */
const popupClass = [
  "[--menu-x:0px] [--menu-y:-6px] data-[side=top]:[--menu-y:6px]",
  "data-[side=left]:[--menu-x:6px] data-[side=left]:[--menu-y:0px] data-[side=right]:[--menu-x:-6px] data-[side=right]:[--menu-y:0px]",
  "box-border w-(--anchor-width) min-w-(--anchor-width) max-w-[min(24rem,calc(100vw-20px))] max-h-[min(320px,var(--available-height))] overflow-hidden",
  "flex flex-col rounded-[calc(var(--radius-control)+2px)] border border-border bg-surface-raised p-1.5 text-foreground shadow-floating outline-none origin-(--transform-origin)",
  "data-open:animate-in data-open:[--tw-enter-opacity:0] data-open:[--tw-enter-translate-x:var(--menu-x)] data-open:[--tw-enter-translate-y:var(--menu-y)] data-open:[--tw-enter-scale:.97]",
  "data-open:[--tw-animation-duration:var(--duration-standard)] data-open:[--tw-ease:var(--ease-enter)] data-open:[--tw-animation-fill-mode:both]",
  "data-closed:animate-out data-closed:[--tw-exit-opacity:0] data-closed:[--tw-exit-translate-x:calc(var(--menu-x)/2)] data-closed:[--tw-exit-translate-y:calc(var(--menu-y)/2)] data-closed:[--tw-exit-scale:.98]",
  "data-closed:[--tw-animation-duration:var(--duration-instant)] data-closed:[--tw-ease:var(--ease-standard)] data-closed:[--tw-animation-fill-mode:both]",
  "motion-reduce:data-open:[--tw-enter-translate-x:0] motion-reduce:data-open:[--tw-enter-translate-y:0] motion-reduce:data-open:[--tw-enter-scale:1] motion-reduce:data-open:[--tw-animation-duration:var(--duration-instant)]",
  "motion-reduce:data-closed:[--tw-exit-translate-x:0] motion-reduce:data-closed:[--tw-exit-translate-y:0] motion-reduce:data-closed:[--tw-exit-scale:1]",
].join(" ")

const itemClass = [
  "relative flex min-h-9 cursor-default items-center rounded-[calc(var(--radius-control)-4px)] pr-[34px] pl-[11px] text-sm text-foreground outline-none select-none",
  "[transition:background-color_var(--duration-instant)_var(--ease-standard),color_var(--duration-instant)_var(--ease-standard)]",
  "data-highlighted:bg-surface-muted data-disabled:opacity-45 motion-reduce:transition-none",
].join(" ")

/* The check settles in a beat after the menu, from a small blurred mark. The menu is hidden while closed, so this replays on every open. */
const indicatorClass = [
  "absolute right-2.5 inline-flex items-center text-foreground",
  "animate-in fade-in [--tw-enter-scale:.6] [--tw-enter-blur:2px] [--tw-animation-duration:var(--duration-standard)] [--tw-ease:var(--ease-enter)] [--tw-animation-delay:40ms] [--tw-animation-fill-mode:both]",
  "motion-reduce:animate-none",
].join(" ")

const scrollClass = "grid h-7 flex-none cursor-default place-items-center text-text-muted"

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { label, description, placeholder = "Select an option", options, id, className, disabled, onValueChange, value, defaultValue, ...rootProps },
  ref,
) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const hintId = description ? `${controlId}-description` : undefined
  const reduceMotion = useReducedMotion()
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? "")
  const currentValue = value ?? uncontrolledValue
  const index = options.findIndex((option) => option.value === currentValue)
  const shown = currentValue ? (options[index]?.label ?? "") : placeholder
  const [previousIndex, setPreviousIndex] = useState(index)
  const [direction, setDirection] = useState(1)
  if (previousIndex !== index) {
    setPreviousIndex(index)
    setDirection(index > previousIndex ? 1 : -1)
  }

  return (
    <div className="grid min-w-0 gap-2">
      <label htmlFor={controlId} className="text-sm font-medium">
        {label}
      </label>
      <SelectPrimitive.Root<string>
        {...rootProps}
        items={options}
        disabled={disabled}
        // Base UI keeps "no value" as null; the field speaks in strings, with "" for the placeholder.
        value={value === undefined ? undefined : value || null}
        defaultValue={defaultValue || null}
        onValueChange={(next) => {
          setUncontrolledValue(next ?? "")
          onValueChange?.(next ?? "")
        }}
      >
        <SelectPrimitive.Trigger ref={ref} id={controlId} aria-describedby={hintId} className={cn(triggerClass, "group/trigger", className)}>
          {/* Base UI keeps the real value for assistive tech; the visible copy below animates between values. */}
          <span className="sr-only">
            <SelectPrimitive.Value placeholder={placeholder} />
          </span>
          <span
            className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] *:col-start-1 *:row-start-1 *:min-w-0 *:truncate *:data-placeholder:text-text-muted"
            aria-hidden="true"
          >
            <AnimatePresence initial={false} custom={direction}>
              <motion.span
                key={currentValue ? `value-${currentValue}` : "placeholder"}
                data-placeholder={currentValue ? undefined : ""}
                custom={direction}
                variants={reduceMotion ? valueFade : valueRoll}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {shown}
              </motion.span>
            </AnimatePresence>
          </span>
          <SelectPrimitive.Icon
            className={[
              "inline-flex flex-none text-text-muted group-data-popup-open/trigger:[transform:rotate(180deg)]",
              "[transition:transform_var(--duration-spring)_var(--ease-spring),color_var(--duration-fast)_var(--ease-standard)] motion-reduce:transition-none",
            ].join(" ")}
          >
            <CaretDownIcon size={16} aria-hidden="true" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Positioner className="z-1000" alignItemWithTrigger={false} sideOffset={4} collisionPadding={12}>
            <SelectPrimitive.Popup className={popupClass}>
              <SelectPrimitive.ScrollUpArrow className={scrollClass}>
                <CaretUpIcon size={16} aria-hidden="true" />
              </SelectPrimitive.ScrollUpArrow>
              <SelectPrimitive.List className="min-h-0 overflow-y-auto py-0.5">
                {options.map((option) => (
                  <SelectPrimitive.Item key={option.value} value={option.value} disabled={option.disabled} label={option.label} className={itemClass}>
                    <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className={indicatorClass}>
                      <CheckIcon size={16} aria-hidden="true" />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.List>
              <SelectPrimitive.ScrollDownArrow className={scrollClass}>
                <CaretDownIcon size={16} aria-hidden="true" />
              </SelectPrimitive.ScrollDownArrow>
            </SelectPrimitive.Popup>
          </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {description && (
        <span id={hintId} className="text-xs text-text-muted">
          {description}
        </span>
      )}
    </div>
  )
})
