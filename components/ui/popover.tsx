"use client"

import { forwardRef } from "react"
import type { ComponentPropsWithoutRef } from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "@/lib/utils"

export const Popover = PopoverPrimitive.Root
export const PopoverClose = PopoverPrimitive.Close

export type PopoverTriggerProps = Omit<ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>, "className"> & { className?: string }

/** The trigger anchors the panel, so it opts out of press-scale: a scaled rect measured on open would shift the panel as the trigger springs back. */
export const PopoverTrigger = forwardRef<HTMLButtonElement, PopoverTriggerProps>(function PopoverTrigger({ className, ...props }, ref) {
  return <PopoverPrimitive.Trigger {...props} ref={ref} className={cn("active:not-disabled:transform-none", className)} />
})

PopoverTrigger.displayName = "PopoverTrigger"

type PositionerProps = PopoverPrimitive.Positioner.Props

export interface PopoverContentProps extends Omit<PopoverPrimitive.Popup.Props, "className"> {
  className?: string
  side?: PositionerProps["side"]
  align?: PositionerProps["align"]
  sideOffset?: PositionerProps["sideOffset"]
  alignOffset?: PositionerProps["alignOffset"]
  collisionPadding?: PositionerProps["collisionPadding"]
  collisionBoundary?: PositionerProps["collisionBoundary"]
  collisionAvoidance?: PositionerProps["collisionAvoidance"]
  sticky?: PositionerProps["sticky"]
  /** A parent element to portal the panel into instead of the page body. */
  container?: PopoverPrimitive.Portal.Props["container"]
}

/* The panel starts a few pixels toward its trigger and settles on a spring; it leaves faster than it arrives.
   Transitions instead of keyframes, so a close that interrupts the open, or a reopen during the close, reverses from where the panel is.
   Base UI waits for the running transitions before it unmounts the panel, so no timing keyframe is needed. */
const contentClass = [
  "[--popover-x:0px] [--popover-y:-5px] data-[side=top]:[--popover-y:5px]",
  "data-[side=left]:[--popover-x:5px] data-[side=left]:[--popover-y:0px] data-[side=right]:[--popover-x:-5px] data-[side=right]:[--popover-y:0px]",
  "min-w-48 max-w-[min(22rem,calc(100vw-20px))] rounded-panel border border-border bg-surface-raised p-4 text-foreground shadow-floating outline-none",
  "origin-(--transform-origin) [transition:opacity_var(--duration-fast)_var(--ease-enter),transform_var(--duration-spring)_var(--ease-spring)]",
  "data-starting-style:opacity-0 data-starting-style:[transform:translate(var(--popover-x),var(--popover-y))_scale(.97)]",
  "data-ending-style:opacity-0 data-ending-style:[transform:translate(calc(var(--popover-x)*.5),calc(var(--popover-y)*.5))_scale(.98)]",
  "data-ending-style:[transition:opacity_var(--duration-fast)_var(--ease-standard),transform_var(--duration-fast)_var(--ease-standard)]",
  "data-closed:pointer-events-none",
  "motion-reduce:[transform:none]! motion-reduce:[transition:opacity_var(--duration-instant)_var(--ease-standard)]!",
].join(" ")

export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(function PopoverContent(
  {
    className,
    side,
    align = "start",
    sideOffset = 6,
    alignOffset,
    collisionPadding = 10,
    collisionBoundary,
    collisionAvoidance,
    sticky,
    container,
    ...props
  },
  ref,
) {
  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Positioner
        className="z-80"
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
        collisionBoundary={collisionBoundary}
        collisionAvoidance={collisionAvoidance}
        sticky={sticky}
      >
        <PopoverPrimitive.Popup {...props} ref={ref} className={cn(contentClass, className)} />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
})

PopoverContent.displayName = "PopoverContent"
