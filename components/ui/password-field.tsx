"use client"

import { forwardRef, useEffect, useId, useRef, useState } from "react"
import type { InputHTMLAttributes } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

export interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string
  description?: string
}

/** One eye that a slash draws across, cutting the outline beneath it, instead of swapping two icons. */
function EyeMorph({ slashed }: { slashed: boolean }) {
  const reduced = useReducedMotion()
  const maskId = `eye-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  const slash = { pathLength: slashed ? 1 : 0, opacity: slashed ? 1 : 0 }
  const transition = reduced
    ? { duration: 0 }
    : {
        pathLength: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard] },
        opacity: { duration: motionTokens.duration.instant },
      }
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect width="24" height="24" fill="white" stroke="none" />
        <motion.path d="M2 2l20 20" stroke="black" strokeWidth={5} initial={false} animate={slash} transition={transition} />
      </mask>
      <g mask={`url(#${maskId})`}>
        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
        <circle cx="12" cy="12" r="3" />
      </g>
      <motion.path d="M2 2l20 20" initial={false} animate={slash} transition={transition} />
    </svg>
  )
}

/** Changed words rise in and unblur while unchanged words hold still. Assistive tech reads the plain copy. */
function MotionText({ text }: { text: string }) {
  const reduced = useReducedMotion()
  const words = text.split(" ")
  return (
    <>
      <span className="sr-only">{text}</span>
      {/* Words are measured against this box when they pop out to leave, so it must be the positioned parent. */}
      <span className="relative block" aria-hidden="true">
        <AnimatePresence initial={false} mode="popLayout">
          {words.map((word, index) => (
            <motion.span
              key={`${index}:${word}`}
              className="inline-block whitespace-pre"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.35em", filter: `blur(${motionTokens.blur.soft}px)` }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={
                reduced
                  ? { opacity: 0, transition: { duration: 0 } }
                  : {
                      opacity: 0,
                      y: "-0.35em",
                      filter: `blur(${motionTokens.blur.subtle}px)`,
                      transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.exit] },
                    }
              }
              transition={
                reduced
                  ? { duration: motionTokens.duration.instant }
                  : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }
              }
            >
              {index < words.length - 1 ? `${word} ` : word}
            </motion.span>
          ))}
        </AnimatePresence>
      </span>
    </>
  )
}

/** Helper and error copy: the row opens its height on a spring, then the words settle in. */
function FieldMessage({ id, text, className, alert }: { id?: string; text?: string; className: string; alert?: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {text ? <MessageRow key="message" id={id} text={text} className={className} alert={alert} /> : null}
    </AnimatePresence>
  )
}

/** The row tracks the measured copy, so a longer message that wraps opens its next line instead of snapping. */
function MessageRow({ id, text, className, alert }: { id?: string; text: string; className: string; alert?: boolean }) {
  const reduced = useReducedMotion()
  const copyRef = useRef<HTMLSpanElement>(null)
  const [height, setHeight] = useState<number | "auto">("auto")
  useEffect(() => {
    const node = copyRef.current
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return (
    /* The row's space is padding inside the clipped slot, so the height animates from a true zero. */
    <motion.span
      className="block overflow-hidden"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height, opacity: 1 }}
      exit={{
        height: 0,
        opacity: 0,
        transition: reduced
          ? { duration: 0 }
          : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.instant } },
      }}
      transition={
        reduced ? { duration: 0 } : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } }
      }
    >
      <motion.span
        ref={copyRef}
        id={id}
        className={cn("block pt-2 text-xs leading-body", className)}
        role={alert ? "alert" : undefined}
        initial={reduced ? false : { y: "0.35em", filter: `blur(${motionTokens.blur.soft}px)` }}
        animate={{ y: 0, filter: "blur(0px)" }}
        transition={{ duration: reduced ? 0 : motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
      >
        <MotionText text={text} />
      </motion.span>
    </motion.span>
  )
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { label, description, id, className, ...props },
  ref
) {
  const generated = useId()
  const controlId = id ?? generated
  const reduced = useReducedMotion()
  const [visible, setVisible] = useState(false)
  const [toggled, setToggled] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const hintId = description ? `${controlId}-description` : undefined
  const setRefs = (node: HTMLInputElement | null) => {
    inputRef.current = node
    if (typeof ref === "function") ref(node)
    else if (ref) ref.current = node
  }
  // Switching between dots and characters resolves in place instead of snapping. Only a toggle plays it, never the mount.
  useEffect(() => {
    if (!toggled || reduced) return
    inputRef.current?.animate(
      [
        { opacity: 0.35, filter: "blur(2px)" },
        { opacity: 1, filter: "blur(0px)" },
      ],
      {
        duration: motionTokens.duration.standard * 1000,
        easing: `cubic-bezier(${motionTokens.ease.enter.join(",")})`,
      }
    )
  }, [visible, toggled, reduced])
  // data-reveal only appears after the first toggle, so the value resolves on each change but never on mount.
  return (
    /* No row gap: grid tracks clamp a negative margin at zero, so a closed message row would still pay the gap. Each row carries its own space instead. */
    <div className="grid min-w-0">
      <label className="mb-2 text-sm font-medium" htmlFor={controlId}>
        {label}
      </label>
      {/* Focus shows as a darker border only; the shell never changes size. The toggle sits with an even inset on top, bottom and right. */}
      <div
        className={cn(
          "flex min-h-control-md items-center rounded-control border border-border-strong bg-surface pr-[calc((var(--control-height-md)-2px-30px)/2)] pl-3",
          "transition-[border-color] duration-160 ease-standard motion-reduce:transition-none",
          "focus-within:border-foreground has-[input[aria-invalid=true]]:border-danger pointer-fine:hover:not-focus-within:border-foreground"
        )}
      >
        <input
          {...props}
          ref={setRefs}
          id={controlId}
          type={visible ? "text" : "password"}
          data-reveal={toggled ? (visible ? "shown" : "hidden") : undefined}
          aria-describedby={[props["aria-describedby"], hintId].filter(Boolean).join(" ") || undefined}
          className={cn(
            "w-full min-w-0 border-0 bg-transparent text-sm leading-body text-foreground outline-none placeholder:text-text-muted",
            className
          )}
        />
        <button
          type="button"
          onClick={() => {
            setVisible(current => !current)
            setToggled(true)
          }}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className={cn(
            "grid size-[30px] flex-none cursor-pointer place-items-center rounded-control border-0 bg-transparent p-0 text-text-muted",
            "[transition:background-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard),transform_var(--duration-spring)_var(--ease-spring)]",
            "aria-pressed:text-foreground pointer-fine:hover:bg-surface-muted pointer-fine:hover:text-foreground",
            "active:[transform:scale(.96)] active:[transition:background-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard),transform_100ms_var(--ease-standard)]",
            "motion-reduce:transition-none motion-reduce:active:transform-none"
          )}
        >
          <EyeMorph slashed={visible} />
        </button>
      </div>
      <FieldMessage id={hintId} text={description} className="text-text-muted" />
    </div>
  )
})

PasswordField.displayName = "PasswordField"
