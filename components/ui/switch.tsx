"use client"

import { forwardRef, useEffect, useRef, useState } from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { animate, motion, useMotionValue } from "motion/react"
import type { Transition } from "motion/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface SwitchProps
  extends Omit<SwitchPrimitive.Root.Props, "className" | "render" | "nativeButton" | "onCheckedChange"> {
  className?: string
  onCheckedChange?: (checked: boolean) => void
  label?: string
}

/** Track inner width (42 - 6 padding) minus the 18px thumb; keep in sync with the track and thumb classes. */
const size = 18
const travel = 18
/** How far the thumb widens toward the other side while pressed. */
const stretch = 5
/** Critically damped: the thumb lands on its end without overshooting the state it reports. */
const glide: Transition = { type: "spring", visualDuration: 0.3, bounce: 0 }

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  {
    label,
    className,
    checked,
    defaultChecked,
    onCheckedChange,
    onPointerDown,
    onPointerUp,
    onPointerLeave,
    onPointerCancel,
    onKeyDown,
    onKeyUp,
    onBlur,
    ...props
  },
  ref,
) {
  const reduceMotion = useReducedMotion()
  const [internal, setInternal] = useState(defaultChecked ?? false)
  const [pressed, setPressed] = useState(false)
  const on = checked ?? internal
  // A brief stretch along the travel, so the thumb reads as moving mass rather than a sliding dot.
  const scaleX = useMotionValue(1)
  const shown = useRef(on)
  // A pointer or Space press already stretched the thumb, so its release should not add a second stretch on top.
  const releasedAt = useRef(-Infinity)
  useEffect(() => {
    if (shown.current === on) return
    shown.current = on
    const fromPress = performance.now() - releasedAt.current < 250
    if (reduceMotion || fromPress) return
    const controls = animate(scaleX, [1, 1.16, 1], { duration: 0.34, times: [0, 0.4, 1], ease: ["easeOut", "easeInOut"] })
    return () => controls.stop()
  }, [on, reduceMotion, scaleX])
  const extra = pressed && !reduceMotion && !props.disabled ? stretch : 0

  return (
    <SwitchPrimitive.Root
      {...props}
      ref={ref}
      checked={on}
      onCheckedChange={next => {
        if (checked === undefined) setInternal(next)
        onCheckedChange?.(next)
      }}
      onPointerDown={event => {
        onPointerDown?.(event)
        if (event.button === 0) setPressed(true)
      }}
      onPointerUp={event => {
        onPointerUp?.(event)
        if (pressed && !props.disabled) releasedAt.current = performance.now()
        setPressed(false)
      }}
      onPointerLeave={event => {
        onPointerLeave?.(event)
        setPressed(false)
      }}
      onPointerCancel={event => {
        onPointerCancel?.(event)
        setPressed(false)
      }}
      onKeyDown={event => {
        onKeyDown?.(event)
        if (event.key === " ") setPressed(true)
      }}
      onKeyUp={event => {
        onKeyUp?.(event)
        if (pressed && !props.disabled) releasedAt.current = performance.now()
        setPressed(false)
      }}
      onBlur={event => {
        onBlur?.(event)
        setPressed(false)
      }}
      // A native button, like the Radix original: Space and Enter toggle it and the label inside names it.
      nativeButton
      render={<button type="button" />}
      className={cn(
        "group/switch inline-flex min-h-control-md cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-sm text-foreground [-webkit-tap-highlight-color:transparent]",
        "focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      aria-label={props["aria-label"] ?? label}
    >
      {/* Fixed box: the thumb moves inside it with transforms, so nothing around the switch shifts. The track crossfades between the two fills. */}
      <span
        className={cn(
          "relative isolate box-border flex h-6 w-[42px] flex-none items-center rounded-pill bg-control-track p-[3px]",
          "transition-[background-color] duration-160 ease-standard",
          "before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:bg-control-on before:opacity-0 before:transition-opacity before:duration-240 before:ease-standard",
          "group-data-checked/switch:before:opacity-100",
          "pointer-fine:group-hover/switch:group-data-unchecked/switch:group-enabled/switch:bg-control-track-hover",
          "motion-reduce:transition-none motion-reduce:before:transition-none",
        )}
      >
        {/* The thumb stretches like a held finger and keeps its far edge anchored, then travels on a spring. */}
        <motion.span
          className={cn(
            "size-[18px] flex-none rounded-pill bg-control-thumb shadow-[var(--control-thumb-shadow)] will-change-transform",
            "transition-[background-color] duration-240 ease-standard group-data-checked/switch:bg-control-thumb-on motion-reduce:transition-none",
          )}
          style={{ scaleX }}
          initial={false}
          animate={{ x: on ? travel - extra : 0, width: size + extra }}
          transition={reduceMotion ? { duration: 0 } : { x: glide, width: motionTokens.spring.snappy }}
        />
      </span>
      {label ? <span className="leading-body">{label}</span> : null}
    </SwitchPrimitive.Root>
  )
})

Switch.displayName = "Switch"

export default Switch
