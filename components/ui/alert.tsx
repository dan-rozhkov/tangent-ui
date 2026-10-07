"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { HTMLAttributes, ReactNode } from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  type AnimationPlaybackControls,
  type HTMLMotionProps,
  type MotionProps,
  type TargetAndTransition,
  type Transition,
} from "motion/react"
import { CheckIcon, InfoIcon, WarningIcon, XCircleIcon, XIcon } from "@phosphor-icons/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export type AlertTone = "info" | "success" | "warning" | "danger"
export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone
  title: string
  children?: ReactNode
  /** Controls presence. Hiding the alert collapses its height and fades it out. */
  open?: boolean
  /** Shows a dismiss button. An uncontrolled alert collapses first, then calls this. */
  onDismiss?: () => void
}
type AlertBoxProps = Omit<AlertProps, "open"> & { reduce: boolean | null; animateIcon?: boolean }

const icons = { info: InfoIcon, success: CheckIcon, warning: WarningIcon, danger: XCircleIcon }
const toneIcon: Record<AlertTone, string> = {
  info: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
}
const exitFast: Transition = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }
const textIn: TargetAndTransition = { opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.soft}px)` }
const textOut: TargetAndTransition = { opacity: 0, y: "-0.3em", filter: `blur(${motionTokens.blur.subtle}px)`, transition: exitFast }
const iconIn: TargetAndTransition = { opacity: 0, scale: 0.6, filter: `blur(${motionTokens.blur.subtle}px)` }
const shown: TargetAndTransition = { opacity: 1, y: "0em", scale: 1, filter: "blur(0px)" }
const fadeOut: TargetAndTransition = { opacity: 0, transition: { duration: motionTokens.duration.instant } }

/** Outgoing copies are hidden from assistive tech while they fade, so the live region reads only the current text. */
function Swap(props: HTMLMotionProps<"span">) {
  const present = useIsPresent()
  return <motion.span {...props} aria-hidden={present ? props["aria-hidden"] : true} />
}

/** Follows its content height. After `morphKey` changes, the height springs from the old size to the new one and then returns to auto, so passive reflows (a resize, a font swap) follow instantly. It clips only while moving, so focus rings stay visible at rest. */
function HeightFrame({ className, reduce, morphKey, children }: { className?: string; reduce: boolean | null; morphKey: string; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const height = useMotionValue<number | "auto">("auto")
  const changedAt = useRef(0)
  useLayoutEffect(() => {
    changedAt.current = performance.now()
  }, [morphKey])
  useEffect(() => {
    const node = content.current
    if (!node || typeof ResizeObserver === "undefined") return
    let last: number | undefined
    let controls: AnimationPlaybackControls | undefined
    const settle = () => {
      height.jump("auto")
      if (frame.current) Object.assign(frame.current.style, { overflow: "", height: "auto" })
    }
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight
      const current = height.get()
      const from = typeof current === "number" ? current : last
      last = next
      controls?.stop()
      if (reduce || from === undefined || from === next || performance.now() - changedAt.current > 120) return settle()
      // Pin the old height before this frame paints, then spring to the new one.
      if (frame.current) Object.assign(frame.current.style, { overflow: "hidden", height: `${from}px` })
      controls = animate(height, [from, next], { ...motionTokens.spring.smooth, onComplete: settle })
    })
    observer.observe(node)
    return () => {
      observer.disconnect()
      controls?.stop()
    }
  }, [height, reduce])
  return (
    <motion.div ref={frame} className={className} style={{ height }}>
      <div ref={content} className="relative">
        {children}
      </div>
    </motion.div>
  )
}

function AlertBox({ tone = "info", title, children, className, reduce, onDismiss, animateIcon = false, ...props }: AlertBoxProps) {
  const Icon = icons[tone]
  const text = typeof children === "string" || typeof children === "number" ? String(children) : null
  const hasDetails = children !== undefined && children !== null && children !== false && children !== ""
  const enter: Transition = reduce
    ? { duration: motionTokens.duration.instant }
    : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }
  const swap: MotionProps = { initial: reduce ? { opacity: 0 } : textIn, animate: shown, exit: reduce ? fadeOut : textOut, transition: enter }
  return (
    <div
      {...props}
      className={cn("flex items-start gap-3 rounded-control border border-border bg-surface p-4 shadow-resting", className)}
      role={tone === "danger" ? "alert" : "status"}
    >
      {/* A new tone morphs its icon in place; a newly shown alert gives the icon a small settle. */}
      <motion.span
        className={cn("relative mt-px grid size-[18px] flex-none place-items-center [&_svg]:block", toneIcon[tone])}
        initial={animateIcon && !reduce ? iconIn : false}
        animate={shown}
        transition={motionTokens.spring.snappy}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <Swap
            key={tone}
            className="relative grid flex-none place-items-center"
            initial={reduce ? { opacity: 0 } : iconIn}
            animate={shown}
            exit={reduce ? fadeOut : { ...iconIn, transition: exitFast }}
            transition={reduce ? enter : motionTokens.spring.snappy}
          >
            <Icon width={18} height={18} aria-hidden="true" />
          </Swap>
        </AnimatePresence>
      </motion.span>
      {/* The copy column follows its content height, so longer or shorter messages never snap the alert. */}
      <HeightFrame className="min-w-0 flex-1" reduce={reduce} morphKey={`${title}\n${hasDetails}\n${text ?? ""}`}>
        <strong className="relative block text-(length:--text-sm) font-medium">
          <AnimatePresence mode="popLayout" initial={false}>
            <Swap key={title} className="block" {...swap}>
              {title}
            </Swap>
          </AnimatePresence>
        </strong>
        <AnimatePresence mode="popLayout" initial={false}>
          {hasDetails && (
            <motion.p key="details" className="relative mt-1 mb-0 text-(length:--text-xs) text-text-secondary" {...swap}>
              {text === null ? (
                children
              ) : (
                <AnimatePresence mode="popLayout" initial={false}>
                  <Swap key={text} className="block" {...swap}>
                    {text}
                  </Swap>
                </AnimatePresence>
              )}
            </motion.p>
          )}
        </AnimatePresence>
      </HeightFrame>
      {onDismiss && (
        <button
          type="button"
          className={cn(
            "-mr-1.5 -my-[5px] grid size-7 flex-none cursor-pointer place-items-center rounded-pill border-0 bg-transparent text-text-muted",
            "[transition:transform_var(--duration-spring)_var(--ease-spring),background-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard)]",
            "active:[transform:scale(.96)] active:[transition:transform_var(--duration-instant)_var(--ease-standard),background-color_var(--duration-instant)_var(--ease-standard),color_var(--duration-instant)_var(--ease-standard)]",
            "pointer-fine:hover:bg-surface-muted pointer-fine:hover:text-foreground",
            "motion-reduce:transition-none motion-reduce:active:transform-none",
          )}
          aria-label={`Dismiss: ${title}`}
          onClick={onDismiss}
        >
          <XIcon size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export function Alert({ open, onDismiss, ...props }: AlertProps) {
  const reduce = useReducedMotion()
  const [dismissed, setDismissed] = useState(false)
  const shell = useRef<HTMLDivElement>(null)
  const setClip = (value: string) => {
    if (shell.current) shell.current.style.overflow = value
  }
  if (open === undefined && !onDismiss) return <AlertBox {...props} reduce={reduce} />
  const isOpen = open ?? !dismissed
  const dismiss = onDismiss && (() => (open === undefined ? setDismissed(true) : onDismiss()))
  const presence: Transition = reduce
    ? { duration: 0 }
    : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] } }
  const exit: TargetAndTransition = {
    height: 0,
    opacity: 0,
    transition: reduce ? { duration: 0 } : { height: motionTokens.spring.smooth, opacity: exitFast },
  }
  // Presence collapses the height with the fade, so the content below closes the gap instead of jumping.
  return (
    <AnimatePresence
      initial={false}
      onExitComplete={() => {
        if (open === undefined) onDismiss?.()
      }}
    >
      {isOpen && (
        <motion.div
          key="alert"
          className="min-w-0"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={exit}
          transition={presence}
          ref={shell}
          onAnimationStart={() => setClip("hidden")}
          onAnimationComplete={() => setClip("")}
        >
          <AlertBox {...props} reduce={reduce} onDismiss={dismiss} animateIcon />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default Alert
