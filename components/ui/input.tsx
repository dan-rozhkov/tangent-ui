"use client"

import { forwardRef, useEffect, useId, useRef, useState } from "react"
import type { InputHTMLAttributes } from "react"
import { AnimatePresence, motion } from "motion/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  description?: string
  error?: string
}

/* Digits roll up when a number grows and down when it shrinks; `custom` hands the latest direction to digits already leaving. */
const digit = {
  enter: (direction: number) => ({ opacity: 0, y: `${direction * 0.6}em`, filter: `blur(${motionTokens.blur.subtle}px)` }),
  center: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: (direction: number) => ({ opacity: 0, y: `${direction * -0.6}em`, filter: `blur(${motionTokens.blur.subtle}px)` }),
}
const isNumber = (word: string) => /^\d[\d.,/:]*%?$/.test(word)

/** A count in the copy, such as "12 characters", rolls only the digits that changed; a gained or lost digit opens or closes its width. */
function RollingNumber({ word }: { word: string }) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState({ word, direction: 1 })
  if (shown.word !== word)
    setShown({ word, direction: parseFloat(word.replace(/,/g, "")) < parseFloat(shown.word.replace(/,/g, "")) ? -1 : 1 })
  const characters = word.split("")
  const transition = reduced
    ? { duration: 0 }
    : {
        y: motionTokens.spring.snappy,
        width: motionTokens.spring.morph,
        opacity: { duration: motionTokens.duration.fast },
        filter: { duration: motionTokens.duration.fast },
      }
  return (
    <AnimatePresence initial={false}>
      {characters.map((character, index) => (
        /* One column per character of a count. Tabular digits keep columns equal, so only a gained or lost digit changes the width. */
        <motion.span
          key={characters.length - index}
          className="relative inline-flex justify-center tabular-nums *:inline-block"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "auto", opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={transition}
        >
          <AnimatePresence initial={false} mode="popLayout" custom={shown.direction}>
            <motion.span key={character} custom={shown.direction} variants={digit} initial="enter" animate="center" exit="exit" transition={transition}>
              {character}
            </motion.span>
          </AnimatePresence>
        </motion.span>
      ))}
    </AnimatePresence>
  )
}

/** Changed words rise in and unblur while unchanged words hold still, and numbers roll. Assistive tech reads the plain copy. */
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
              key={`${index}:${isNumber(word) ? "#" : word}`}
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
                      transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.standard] },
                    }
              }
              transition={
                reduced
                  ? { duration: motionTokens.duration.instant }
                  : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }
              }
            >
              {isNumber(word) ? <RollingNumber word={word} /> : word}
              {index < words.length - 1 ? " " : null}
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
  // Reduced motion mounts the row at full height: a zero-duration open would still paint one collapsed frame. The presence starts
  // with initial={false}, so rows present at hydration render the same on server and client either way.
  return (
    /* The row's space is padding inside the clipped slot, so the height animates from a true zero. */
    <motion.span
      className="block overflow-hidden"
      initial={reduced ? false : { height: 0, opacity: 0 }}
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

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, description, error, id, className, ...props },
  ref,
) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const hintId = description ? `${controlId}-description` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy = [props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined
  return (
    /* No row gap: grid tracks clamp a negative margin at zero, so a closed message row would still pay the gap. Each row carries its own space instead. */
    <div className="grid min-w-0">
      <label className="mb-2 text-sm leading-body font-medium text-foreground" htmlFor={controlId}>
        {label}
      </label>
      <input
        {...props}
        id={controlId}
        ref={ref}
        className={cn(
          /* Focus answers with the border colour alone (no rings or halos); the field itself never changes size. */
          "min-h-control-md w-full rounded-control border border-border-strong bg-surface px-3 text-sm leading-body tracking-body text-foreground outline-none",
          "transition-[border-color,background-color] duration-160 ease-standard motion-reduce:duration-[.01ms]",
          "placeholder:text-text-muted",
          "pointer-fine:hover:not-disabled:not-aria-invalid:border-foreground focus-visible:border-foreground aria-invalid:border-danger",
          "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-50",
          className,
        )}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={describedBy}
      />
      <FieldMessage id={hintId} text={description} className="text-text-muted" />
      <FieldMessage id={errorId} text={error} className="text-danger" alert />
    </div>
  )
})

Input.displayName = "Input"
