"use client"

import { useEffect, useId, useRef, useState } from "react"
import type { ChangeEvent, ClipboardEvent, FocusEvent, KeyboardEvent } from "react"
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react"
import type { Transition } from "motion/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

export interface OtpInputProps {
  length?: number
  value?: string
  onChange?: (value: string) => void
  label: string
  description?: string
  error?: string
  autoFocus?: boolean
  disabled?: boolean
  inputMode?: "numeric" | "text"
  className?: string
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
                      transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] },
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
        className={cn("block pt-2 text-(length:--text-xs) leading-body", className)}
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

export function OtpInput({
  length = 6,
  value = "",
  onChange,
  label,
  description,
  error,
  autoFocus = false,
  disabled = false,
  inputMode = "numeric",
  className,
}: OtpInputProps) {
  const generatedId = useId()
  const reduced = useReducedMotion()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const values = Array.from({ length }, (_, index) => value[index] ?? "")
  const hintId = description ? `${generatedId}-description` : undefined
  const errorId = error ? `${generatedId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined
  const focusAt = (index: number) => inputRefs.current[Math.max(0, Math.min(index, length - 1))]?.focus()
  const sanitize = (next: string) => (inputMode === "numeric" ? next.replace(/\D/g, "") : next)
  // One ring for the whole row. It glides between slots while focus stays inside, and fades in where focus lands when it arrives from outside.
  const [ring, setRing] = useState({ x: 0, width: 0, shown: false, glide: false })
  // A paste fills several slots in one update; those digits land as a short left to right wave.
  const [fill, setFill] = useState({ value, wave: false })
  if (fill.value !== value)
    setFill({
      value,
      wave:
        Array.from({ length }, (_, index) => (fill.value[index] ?? "") !== (value[index] ?? "")).filter(Boolean).length > 1,
    })
  const lastError = useRef(error)

  useEffect(() => {
    if (autoFocus) inputRefs.current[0]?.focus()
  }, [autoFocus])

  // Slots shrink at narrow widths; keep the ring on the focused slot when the row resizes.
  useEffect(() => {
    const row = scope.current
    if (!row || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      const slot = (row.contains(document.activeElement) ? document.activeElement?.parentElement : null) as HTMLElement | null
      if (slot)
        setRing((current) =>
          current.x === slot.offsetLeft && current.width === slot.offsetWidth
            ? current
            : { ...current, x: slot.offsetLeft, width: slot.offsetWidth, glide: false },
        )
    })
    observer.observe(row)
    return () => observer.disconnect()
  }, [scope])

  // A new error nudges the row side to side once, so a rejected code reads as a response to the attempt.
  useEffect(() => {
    if (error && error !== lastError.current && !reduced && scope.current)
      animate(scope.current, { x: [0, -6, 5, -3, 2, 0] }, { duration: 0.36, ease: [...motionTokens.ease.standard] })
    lastError.current = error
  }, [error, reduced, animate, scope])

  const updateAt = (index: number, raw: string) => {
    const next = values.slice()
    const clean = sanitize(raw).slice(-1)
    next[index] = clean
    onChange?.(next.join(""))
    if (clean && index < length - 1) focusAt(index + 1)
  }

  const handleChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const raw = sanitize(event.target.value)
    if (raw.length <= 1) {
      updateAt(index, raw)
      return
    }

    const next = values.slice()
    raw
      .slice(0, length - index)
      .split("")
      .forEach((character, offset) => {
        next[index + offset] = character
      })
    onChange?.(next.join(""))
    focusAt(Math.min(index + raw.length, length - 1))
  }
  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const pasted = sanitize(event.clipboardData.getData("text")).slice(0, length - index)
    if (!pasted) return
    const next = values.slice()
    pasted.split("").forEach((character, offset) => {
      next[index + offset] = character
    })
    onChange?.(next.join(""))
    focusAt(Math.min(index + pasted.length, length - 1))
  }

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      focusAt(index - 1)
    }
    if (event.key === "ArrowRight") {
      event.preventDefault()
      focusAt(index + 1)
    }
    if (event.key === "Backspace" && !values[index] && index > 0) {
      event.preventDefault()
      const next = values.slice()
      next[index - 1] = ""
      onChange?.(next.join(""))
      focusAt(index - 1)
    }
    if (event.key === "Delete" && values[index]) {
      const next = values.slice()
      next[index] = ""
      onChange?.(next.join(""))
    }
  }
  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    const slot = event.currentTarget.parentElement as HTMLElement
    setRing((current) => ({ x: slot.offsetLeft, width: slot.offsetWidth, shown: true, glide: current.shown }))
  }
  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (!scope.current?.contains(event.relatedTarget as Node | null))
      setRing((current) => ({ ...current, shown: false, glide: false }))
  }
  const glyphTransition = (index: number): Transition =>
    reduced
      ? { duration: motionTokens.duration.instant }
      : {
          duration: motionTokens.duration.standard,
          ease: [...motionTokens.ease.enter],
          delay: fill.wave ? index * motionTokens.stagger.item : 0,
        }

  return (
    /* No row gap: grid tracks clamp a negative margin at zero, so a closed message row would still pay the gap. Each row carries its own space instead. */
    <div className={cn("grid min-w-0", className)}>
      <span className="mb-2 text-(length:--text-sm) leading-body font-medium text-foreground">{label}</span>
      <div
        ref={scope}
        className="group/otp relative flex w-fit max-w-full gap-2 max-[360px]:gap-1.5"
        role="group"
        aria-label={label}
        data-invalid={error ? "true" : undefined}
      >
        {values.map((character, index) => (
          <div key={`${generatedId}-${index}`} className="relative grid h-12 w-[42px] min-w-0 flex-[0_1_42px] max-[360px]:h-11">
            <input
              ref={(node) => {
                inputRefs.current[index] = node
              }}
              className={cn(
                /* The native text is transparent (caret stays visible); the glyph draws the digit so it can rise in. */
                "peer size-full min-w-0 rounded-control border border-border bg-surface text-center text-(length:--text-lg) text-transparent tabular-nums caret-accent outline-none",
                "transition-[border-color,background-color] duration-160 ease-standard motion-reduce:transition-none",
                "pointer-fine:hover:not-disabled:not-data-[filled='true']:not-aria-invalid:border-border-strong pointer-fine:hover:not-disabled:not-data-[filled='true']:not-aria-invalid:bg-surface-muted",
                "data-[filled='true']:border-accent data-[filled='true']:bg-accent-subtle",
                "focus-visible:outline-none",
                "aria-invalid:border-danger aria-invalid:bg-[color-mix(in_srgb,var(--danger)_7%,var(--surface))]",
                "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-48",
                "forced-colors:text-[CanvasText] forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-offset-2 forced-colors:focus-visible:outline-[color:CanvasText]",
              )}
              aria-label={`${label}, digit ${index + 1} of ${length}`}
              aria-describedby={describedBy}
              aria-invalid={error ? true : undefined}
              value={character}
              data-filled={character ? "true" : undefined}
              maxLength={1}
              inputMode={inputMode}
              autoComplete={index === 0 ? "one-time-code" : "off"}
              disabled={disabled}
              onChange={(event) => handleChange(index, event)}
              onPaste={(event) => handlePaste(index, event)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
            {/* The input text is transparent; this copy of the digit rises into the slot and unblurs. */}
            <AnimatePresence initial={false}>
              {character ? (
                <motion.span
                  key={character}
                  className="pointer-events-none absolute inset-0 grid place-items-center text-(length:--text-lg) text-foreground tabular-nums peer-disabled:opacity-48 forced-colors:hidden"
                  aria-hidden="true"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.35em", filter: `blur(${motionTokens.blur.soft}px)` }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={
                    reduced
                      ? { opacity: 0, transition: { duration: 0 } }
                      : {
                          opacity: 0,
                          scale: 0.9,
                          filter: `blur(${motionTokens.blur.subtle}px)`,
                          transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] },
                        }
                  }
                  transition={glyphTransition(index)}
                >
                  {character}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
        ))}
        {/* One ring per field. It glides to the focused slot and morphs to the danger color with the error state. */}
        <motion.span
          className="pointer-events-none absolute top-0 left-0 z-2 h-full rounded-control border border-accent-strong transition-[border-color] duration-160 ease-standard group-data-[invalid='true']/otp:border-danger motion-reduce:transition-none forced-colors:hidden"
          aria-hidden="true"
          initial={false}
          animate={{ x: ring.x, width: ring.width, opacity: ring.shown ? 1 : 0, scale: ring.shown ? 1 : 0.94 }}
          transition={
            reduced
              ? { duration: 0 }
              : {
                  x: ring.glide ? motionTokens.spring.snappy : { duration: 0 },
                  width: { duration: 0 },
                  scale: motionTokens.spring.snappy,
                  opacity: { duration: motionTokens.duration.fast },
                }
          }
        />
      </div>
      <FieldMessage id={hintId} text={description} className="text-text-muted" />
      <FieldMessage id={errorId} text={error} className="text-danger" alert />
    </div>
  )
}

export default OtpInput
