"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { ButtonHTMLAttributes, RefObject } from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react"
import type { TargetAndTransition, Variants } from "motion/react"
import { ArrowRight } from "lucide-react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface ActionButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "onDrag" | "onDragEnd" | "onDragStart" | "onAnimationStart"> {
  label: string
  successLabel?: string
  pendingLabel?: string
  onAction: () => void | Promise<void>
  resetAfterMs?: number
  onActionError?: (error: unknown) => void
}

/* The button hugs its label: text morphs in place and the width follows on a spring, so no state ever snaps the layout. */
const actionButtonClass = [
  "relative inline-flex min-h-control-md cursor-pointer items-center justify-center overflow-hidden rounded-control border border-foreground bg-foreground px-5",
  "text-sm leading-body font-medium text-background [-webkit-tap-highlight-color:transparent]",
  "transition-[background,border-color,color,box-shadow,opacity] duration-160 ease-standard motion-reduce:transition-none",
  "pointer-fine:hover:not-disabled:shadow-resting",
  "disabled:cursor-not-allowed [&:disabled:not([data-state=pending])]:opacity-70 data-[state=pending]:cursor-progress",
].join(" ")

const pressVariants: Variants = {
  pressed: (button: RefObject<HTMLButtonElement | null>) => ({
    scale: (button.current?.offsetWidth ?? 0) > 220 ? 0.985 : 0.97,
    transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] },
  }),
}
const rest: TargetAndTransition = { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
const glyphIn: TargetAndTransition = { opacity: 0, y: 5, filter: `blur(${motionTokens.blur.soft}px)` }
const glyphOut: TargetAndTransition = {
  opacity: 0,
  y: -4,
  filter: `blur(${motionTokens.blur.subtle}px)`,
  transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
}
const iconIn: TargetAndTransition = { opacity: 0, scale: 0.6, filter: `blur(${motionTokens.blur.subtle}px)` }
const iconOut: TargetAndTransition = {
  ...iconIn,
  transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
}
/** The arrow leaves in the direction of the action and returns from behind once the button resets. */
const arrowIn: TargetAndTransition = { opacity: 0, x: -6, filter: `blur(${motionTokens.blur.subtle}px)` }
const arrowOut: TargetAndTransition = {
  opacity: 0,
  x: 8,
  filter: `blur(${motionTokens.blur.subtle}px)`,
  transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
}
const iconRest: TargetAndTransition = { ...rest, x: 0 }
const fadeIn: TargetAndTransition = { ...rest, opacity: 0 }
const fadeOut: TargetAndTransition = { opacity: 0, transition: { duration: motionTokens.duration.instant } }
/** Scale rides the spring; opacity and blur tween so blur never overshoots below zero. */
const iconEnter = {
  ...motionTokens.spring.snappy,
  opacity: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.enter] },
  filter: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.enter] },
} as const

/** Springs the wrapper to the natural width of its content when the text changes, so new text never snaps the layout.
 *  Other resizes (a late web font, a parent reflow) jump straight to the new width, so nothing wobbles on first paint. */
function useMorphWidth(content: RefObject<HTMLElement | null>, key: string, reduced: boolean) {
  const width = useMotionValue<number | "auto">("auto")
  const lastKey = useRef(key)
  const armedUntil = useRef(0)
  useLayoutEffect(() => {
    if (lastKey.current === key) return
    lastKey.current = key
    armedUntil.current = performance.now() + 700
  }, [key])
  useEffect(() => {
    const node = content.current
    const slot = node?.parentElement
    if (!node || !slot || typeof ResizeObserver === "undefined") return
    let measured = false
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width
      if (!next || !measured || reduced || performance.now() > armedUntil.current) {
        measured = next > 0
        width.jump(next || "auto")
        delete slot.dataset.morphing
        return
      }
      slot.dataset.morphing = ""
      animate(width, next, { ...motionTokens.spring.morph, onComplete: () => void delete slot.dataset.morphing })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [content, reduced, width])
  return width
}

/** The success tick draws itself from its short stroke, the way a hand would write it. */
function DrawnCheck({ reduced }: { reduced: boolean }) {
  return (
    <svg
      className="text-current"
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <motion.path
        d="M4 12l5 5L20 6"
        initial={reduced ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{
          pathLength: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter], delay: 0.05 },
          opacity: { duration: 0.05, delay: 0.05 },
        }}
      />
    </svg>
  )
}

type Glyph = { id: string; char: string; order: number }
const toGlyphs = (chars: string[], seq: number): Glyph[] =>
  chars.map((char, order) => ({ id: `${seq}:${order}`, char, order }))

/** Shared leading and trailing characters keep their identity, so only the changed run of text is replaced. */
function useGlyphs(text: string) {
  const [state, setState] = useState(() => ({ text, seq: 0, glyphs: toGlyphs([...text], 0) }))
  if (state.text === text) return state.glyphs
  const prev = [...state.text]
  const next = [...text]
  let start = 0
  let end = 0
  while (start < prev.length && start < next.length && prev[start] === next[start]) start++
  while (
    end < prev.length - start &&
    end < next.length - start &&
    prev[prev.length - 1 - end] === next[next.length - 1 - end]
  )
    end++
  if (start < 2) start = 0
  if (end < 2) end = 0
  const seq = state.seq + 1
  const glyphs = [
    ...state.glyphs.slice(0, start),
    ...toGlyphs(next.slice(start, next.length - end), seq),
    ...state.glyphs.slice(state.glyphs.length - end),
  ]
  setState({ text, seq, glyphs })
  return glyphs
}

/** Morphs one label into the next: kept letters glide into place, new ones rise in from a soft blur, and the width follows on a spring. */
function MorphText({ text, reduced }: { text: string; reduced: boolean }) {
  const glyphs = useGlyphs(text)
  const rowRef = useRef<HTMLSpanElement>(null)
  const width = useMorphWidth(rowRef, text, reduced)
  return (
    <motion.span
      className="inline-flex min-w-0 data-morphing:[clip-path:inset(-.6em_0_-.6em_-.3em)]"
      style={{ width }}
      aria-hidden="true"
    >
      <span ref={rowRef} className="relative inline-flex flex-none whitespace-pre">
        <AnimatePresence mode="popLayout" initial={false}>
          {glyphs.map(glyph => (
            <motion.span
              key={glyph.id}
              className="inline-block"
              layout={reduced ? false : "position"}
              layoutDependency={text}
              initial={reduced ? fadeIn : glyphIn}
              animate={rest}
              exit={reduced ? fadeOut : glyphOut}
              transition={
                reduced
                  ? { duration: motionTokens.duration.instant }
                  : {
                      duration: motionTokens.duration.standard,
                      ease: [...motionTokens.ease.enter],
                      delay: Math.min(glyph.order * motionTokens.stagger.char, 0.1),
                      layout: motionTokens.spring.morph,
                    }
              }
            >
              {glyph.char}
            </motion.span>
          ))}
        </AnimatePresence>
      </span>
    </motion.span>
  )
}

export function ActionButton({
  label,
  successLabel = "Saved",
  pendingLabel = "Saving",
  onAction,
  resetAfterMs = 2400,
  onActionError,
  className,
  disabled,
  ...props
}: ActionButtonProps) {
  const [state, setState] = useState<"idle" | "pending" | "success">("idle")
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const reduceMotion = useReducedMotion() ?? false
  const text = state === "pending" ? pendingLabel : state === "success" ? successLabel : label

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    },
    [],
  )

  async function run() {
    if (state === "pending") return
    if (resetTimer.current) clearTimeout(resetTimer.current)
    setState("pending")
    try {
      await onAction()
      setState("success")
      if (resetAfterMs > 0) resetTimer.current = setTimeout(() => setState("idle"), resetAfterMs)
    } catch (error) {
      setState("idle")
      onActionError?.(error)
    }
  }

  const pending = state === "pending"
  const arrow = state === "idle"

  // Pending stays focusable (aria-disabled instead of disabled), so a keyboard user keeps focus through the whole save.
  return (
    <ButtonPrimitive
      {...props}
      ref={buttonRef}
      tabIndex={props.tabIndex ?? 0}
      type={props.type ?? "button"}
      className={cn(actionButtonClass, className)}
      disabled={disabled}
      aria-disabled={pending ? true : props["aria-disabled"]}
      aria-busy={pending}
      data-state={state}
      onClick={() => void run()}
      render={
        <motion.button
          custom={buttonRef}
          variants={pressVariants}
          whileTap={reduceMotion || disabled || pending ? undefined : "pressed"}
          transition={motionTokens.spring.snappy}
        />
      }
    >
      <span className="inline-flex min-h-5 items-center justify-center gap-2 whitespace-nowrap" aria-hidden="true">
        <MorphText text={text} reduced={reduceMotion} />
        <span className="grid size-[17px] flex-[0_0_17px] place-items-center">
          <AnimatePresence initial={false}>
            <motion.span
              key={state}
              className="[grid-area:1/1] grid size-[17px] place-items-center"
              initial={reduceMotion ? fadeIn : arrow ? arrowIn : iconIn}
              animate={iconRest}
              exit={reduceMotion ? fadeOut : arrow ? arrowOut : iconOut}
              transition={reduceMotion ? { duration: motionTokens.duration.instant } : iconEnter}
            >
              {pending ? (
                <span className="inline-block size-4 animate-spin rounded-pill border-[1.5px] border-current border-r-transparent [animation-duration:.7s] motion-reduce:animate-none" />
              ) : state === "success" ? (
                <DrawnCheck reduced={reduceMotion} />
              ) : (
                <ArrowRight className="flex-none" width={17} height={17} />
              )}
            </motion.span>
          </AnimatePresence>
        </span>
      </span>
      <span className="sr-only">{label}</span>
      <span className="sr-only" role="status">
        {state === "pending" ? pendingLabel : state === "success" ? successLabel : ""}
      </span>
    </ButtonPrimitive>
  )
}

export default ActionButton
