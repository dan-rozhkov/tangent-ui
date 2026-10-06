"use client"

import { useState, type CSSProperties } from "react"
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react"

import { Avatar } from "@/components/ui/avatar"
import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

export interface AvatarGroupMember {
  name: string
  src?: string
  status?: "online" | "offline"
}
export interface AvatarGroupProps {
  members: AvatarGroupMember[]
  max?: number
  size?: "sm" | "md" | "lg"
  label?: string
}

/** The overflow count rolls the way it moved: more people rise in from below, fewer drop in from above. */
const rise: Variants = {
  hidden: (direction: number) => ({ opacity: 0, y: `${0.4 * direction}em`, filter: `blur(${motionTokens.blur.subtle}px)` }),
  shown: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] },
  },
  gone: (direction: number) => ({
    opacity: 0,
    y: `${-0.4 * direction}em`,
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
  }),
}
// Same keys as `rise` so the settled style is identical whichever branch renders on the server.
const fade: Variants = {
  hidden: { opacity: 0, y: 0, filter: "blur(0px)" },
  shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.instant } },
  gone: { opacity: 0, y: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.instant } },
}
// A person joining or leaving opens or closes their slot, so the rest of the stack slides instead of jumping.
const slot = {
  initial: { width: 0, opacity: 0, scale: 0.9 },
  animate: { width: "auto", opacity: 1, scale: 1 },
  exit: { width: 0, opacity: 0, scale: 0.9 },
}

const sizes = {
  sm: { group: "[--avatar-size:28px]", overflow: "size-7 text-[10px]" },
  md: { group: "[--avatar-size:36px]", overflow: "size-9" },
  lg: { group: "[--avatar-size:48px]", overflow: "size-12 text-(length:--text-sm)" },
} as const

/* Each slot is the avatar's visible width, so a slot that opens or closes moves the rest of the stack smoothly.
   Pointing at the stack loosens its overlap from the center; the person under the pointer lifts and their neighbors ease aside.
   The offsets live on the slot and the lift inherits them, so every hover move is a single translate and the stack never changes size. */
const slotClass = cn(
  "group/slot relative inline-flex h-(--avatar-size) flex-none items-center [--aside:0px] [--fan:0px] [--rise:0px]",
  "pointer-fine:group-hover/avatars:[--fan:calc((var(--index)_-_(var(--count)_-_1)_/_2)_*_4px)]",
  "pointer-fine:hover:z-1 pointer-fine:hover:[--rise:-2px]",
  "[@media(hover:hover)]:pointer-fine:[:hover~&]:[--aside:3px]",
  "[@media(hover:hover)]:pointer-fine:[&:has(~:hover)]:[--aside:-3px]",
)
/* Reduced motion keeps the stack still; the ring and name still answer the pointer. */
const liftBase =
  "relative -ml-1.5 inline-flex rounded-pill [transform:translate(calc(var(--fan)_+_var(--aside)),var(--rise))] motion-reduce:transform-none! motion-reduce:transition-none"
const liftClass = cn(
  liftBase,
  "[transition:transform_var(--duration-standard)_var(--ease-standard),box-shadow_var(--duration-fast)_var(--ease-standard)]",
)
const ringClass = cn(
  "border-2 border-surface shadow-[0_0_0_1px_var(--border)] transition-shadow duration-160 ease-standard",
  "pointer-fine:group-hover/slot:shadow-[0_0_0_1px_var(--border-strong)]",
)
/* The name floats above the stack, outside the layout, so showing it never moves anything. */
const tipClass = cn(
  "pointer-events-none absolute bottom-[calc(100%_+_8px)] left-1/2 z-2 rounded-pill bg-foreground px-2 py-1",
  "text-(length:--text-xs) leading-body font-medium whitespace-nowrap text-background",
  "opacity-0 [transform:translate(-50%,3px)] transition-[opacity,transform] duration-160 ease-standard",
  "pointer-fine:group-hover/slot:opacity-100 pointer-fine:group-hover/slot:[transform:translate(-50%,0)] pointer-fine:group-hover/slot:delay-60",
  "motion-reduce:[transform:translate(-50%,0)] motion-reduce:transition-none",
)

export function AvatarGroup({ members, max = 4, size = "md", label = "Team members" }: AvatarGroupProps) {
  const reduceMotion = !!useReducedMotion()
  const visible = members.slice(0, Math.max(0, max))
  const overflow = Math.max(0, members.length - visible.length)
  const transition = reduceMotion ? { duration: 0 } : motionTokens.spring.morph
  const [count, setCount] = useState({ overflow, direction: 1 })
  if (count.overflow !== overflow) setCount({ overflow, direction: overflow < count.overflow ? -1 : 1 })
  return (
    <div
      className={cn("group/avatars inline-flex h-(--avatar-size) items-center pl-1.5", sizes[size].group)}
      role="group"
      aria-label={label}
      style={{ "--count": visible.length + (overflow > 0 ? 1 : 0) } as CSSProperties}
    >
      <AnimatePresence initial={false}>
        {visible.map((member, index) => (
          <motion.span
            key={member.name}
            className={slotClass}
            style={{ "--index": index } as CSSProperties}
            {...slot}
            transition={transition}
          >
            <span className={liftClass}>
              <Avatar className={ringClass} name={member.name} src={member.src} status={member.status} size={size} />
              <span className={tipClass} aria-hidden="true">
                {member.name}
              </span>
            </span>
          </motion.span>
        ))}
        {overflow > 0 ? (
          <motion.span
            key="overflow"
            className={slotClass}
            style={{ "--index": visible.length } as CSSProperties}
            {...slot}
            transition={transition}
          >
            <span
              // The chip's own box-shadow transition replaces the lift's, as in the original stylesheet.
              className={cn(
                liftBase,
                ringClass,
                "inline-grid place-items-center overflow-hidden bg-surface-muted text-(length:--text-xs) font-medium text-text-secondary tabular-nums",
                sizes[size].overflow,
              )}
              role="img"
              aria-label={`${overflow} more ${label.toLowerCase()}`}
            >
              <AnimatePresence mode="popLayout" initial={false} custom={count.direction}>
                <motion.span
                  key={overflow}
                  className="inline-block"
                  custom={count.direction}
                  variants={reduceMotion ? fade : rise}
                  initial="hidden"
                  animate="shown"
                  exit="gone"
                  aria-hidden="true"
                >
                  +{overflow}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export default AvatarGroup
