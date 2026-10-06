"use client"

import Image from "next/image"
import { useLayoutEffect, useRef, useState, type HTMLAttributes } from "react"
import { cva } from "class-variance-authority"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name: string
  src?: string
  size?: "sm" | "md" | "lg" | "xl"
  status?: "online" | "offline"
}

const avatarVariants = cva(
  "relative inline-grid flex-none place-items-center overflow-visible rounded-pill border border-border bg-surface-muted text-foreground text-(length:--text-xs) font-medium",
  {
    variants: {
      size: {
        sm: "size-7 text-[10px]",
        md: "size-9",
        lg: "size-12 text-(length:--text-sm)",
        xl: "size-[88px] text-(length:--text-xl)",
      },
    },
    defaultVariants: { size: "md" },
  },
)

const statusVariants = cva(
  "absolute right-0 bottom-0 z-2 size-2.5 rounded-pill border-2 border-surface shadow-[0_0_0_1px_color-mix(in_oklab,var(--border)_70%,transparent)]",
  {
    variants: {
      size: { sm: "size-2 border-[1.5px]", md: "", lg: "size-3", xl: "right-1 bottom-1 size-3.5" },
      status: { online: "bg-success", offline: "bg-text-muted" },
    },
  },
)

export function Avatar({ name, src, size = "md", status, className, ...props }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("")
  const reduceMotion = !!useReducedMotion()
  const image = useRef<HTMLImageElement>(null)
  const [failedSrc, setFailedSrc] = useState<string>()
  // A photo that is already decoded shows at once. One that is still loading waits, then fades in from a soft blur.
  useLayoutEffect(() => {
    const node = image.current
    if (node && !node.complete) node.dataset.loading = ""
  }, [src])
  const showImage = src && failedSrc !== src
  return (
    <span
      {...props}
      className={cn(avatarVariants({ size }), className)}
      role="img"
      aria-label={`${name}${status ? `, ${status}` : ""}`}
    >
      {showImage ? (
        <Image
          key={src}
          ref={image}
          src={src}
          alt=""
          fill
          sizes={size === "xl" ? "88px" : size === "lg" ? "48px" : size === "md" ? "36px" : "28px"}
          // Set only while a photo is still downloading after mount, so cached photos never fade.
          className={cn(
            "pointer-events-none rounded-[inherit] object-cover transition-[opacity,filter] duration-240 ease-enter",
            "data-loading:opacity-0 data-loading:blur-[4px] data-loading:transition-none",
            "motion-reduce:transition-none motion-reduce:data-loading:filter-none",
          )}
          onLoad={event => {
            delete event.currentTarget.dataset.loading
          }}
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span
          className={src ? "animate-in fade-in fill-mode-both duration-240 ease-enter motion-reduce:animate-none" : undefined}
          aria-hidden="true"
        >
          {initials}
        </span>
      )}
      <AnimatePresence initial={false}>
        {status && (
          <motion.i
            key={status}
            className={statusVariants({ size, status })}
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6, transition: { duration: reduceMotion ? 0 : motionTokens.duration.fast } }}
            transition={reduceMotion ? { duration: 0 } : motionTokens.spring.snappy}
          />
        )}
      </AnimatePresence>
    </span>
  )
}

export { avatarVariants }
export default Avatar
