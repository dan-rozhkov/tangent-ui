"use client"

import { useState } from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva } from "class-variance-authority"
import { AnimatePresence, motion, type TargetAndTransition, type Transition } from "motion/react"
import { CopyIcon, WarningCircleIcon } from "@phosphor-icons/react"

import { motionTokens } from "@/lib/motion-tokens"
import { useCopyFeedback } from "@/lib/use-copy-feedback"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface CopyButtonProps {
  value: string
  label?: string
  className?: string
  iconOnly?: boolean
  variant?: "outline" | "plain"
  disabled?: boolean
  onCopied?: () => void
}

/* Width never changes: the label cell reserves its widest state while icon and letters crossfade inside it. Press releases on the spring curve. */
const copyButtonVariants = cva(
  [
    "inline-flex w-max max-w-full min-h-control-sm cursor-pointer items-center justify-center gap-2 rounded-control border px-3",
    "text-sm font-medium [-webkit-tap-highlight-color:transparent]",
    "[transition:background-color_var(--duration-fast)_var(--ease-standard),border-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard),transform_var(--duration-spring)_var(--ease-spring)]",
    "active:not-disabled:[transition-duration:var(--duration-fast),var(--duration-fast),var(--duration-fast),var(--duration-instant)] active:not-disabled:[transition-timing-function:var(--ease-standard)]",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "motion-reduce:transition-none! motion-reduce:active:not-disabled:[transform:none]!",
  ],
  {
    variants: {
      variant: {
        outline:
          "border-border bg-surface text-foreground pointer-fine:hover:not-disabled:border-border-strong pointer-fine:hover:not-disabled:bg-surface-muted",
        plain:
          "border-transparent bg-transparent text-text-secondary pointer-fine:hover:not-disabled:border-transparent pointer-fine:hover:not-disabled:bg-surface-muted pointer-fine:hover:not-disabled:text-foreground",
      },
      iconOnly: {
        true: "w-control-sm px-0 active:not-disabled:[transform:scale(.96)]",
        false: "active:not-disabled:[transform:scale(.97)]",
      },
    },
    defaultVariants: { variant: "outline", iconOnly: false },
  },
)

/** Copy feedback is deliberately unhurried: a slow, almost critically damped spring and long, soft crossfades read as calm, never busy.
 *  The same motion plays in reverse when the confirmation hands back to idle, so nothing ever snaps. */
const settle = { type: "spring", visualDuration: 0.5, bounce: 0.06 } as const
const enter = { duration: 0.36, ease: [...motionTokens.ease.enter] } as const
const leave = { duration: 0.2, ease: [...motionTokens.ease.standard] } as const
const instant = { duration: motionTokens.duration.instant } as const
const soft = `blur(${motionTokens.blur.soft}px)`
const rest: TargetAndTransition = { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
const fadeIn: TargetAndTransition = { ...rest, opacity: 0 }
const fadeOut: TargetAndTransition = { opacity: 0, transition: instant }
/** Icons trade places in one soft breath: the old glyph shrinks into a blur while the new one grows out of it on the slow spring. */
const iconIn: TargetAndTransition = { opacity: 0, scale: 0.6, filter: soft }
const iconOut: TargetAndTransition = {
  opacity: 0,
  scale: 0.6,
  filter: soft,
  transition: { duration: 0.24, ease: [...motionTokens.ease.standard] },
}
const iconEnter: Transition = { scale: settle, opacity: { ...enter, delay: 0.03 }, filter: { ...enter, delay: 0.03 } }
/** Letters rise about .3em out of a soft blur; the outgoing ones lift away a little faster. */
const glyphIn: TargetAndTransition = { opacity: 0, y: 4, filter: soft }
const glyphOut: TargetAndTransition = { opacity: 0, y: -3, filter: soft, transition: leave }

/** The success tick draws itself from its short stroke, the way a hand would write it: quick to start, then easing into place while the icon settles. */
function DrawnCheck({ reduced }: { reduced: boolean }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <motion.path
        d="M4 12l5 5L20 6"
        initial={reduced ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{
          pathLength: { duration: 0.5, ease: [...motionTokens.ease.standard], delay: 0.05 },
          opacity: { duration: 0.01, delay: 0.05 },
        }}
      />
    </svg>
  )
}

type Glyph = { id: string; char: string; order: number }
const toGlyphs = (chars: string[], seq: number): Glyph[] =>
  chars.map((char, order) => ({ id: `${seq}:${order}`, char, order }))

/** Shared leading and trailing characters keep their identity, so "Copy" to "Copied" only replaces the changed letters. */
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

/**
 * The label cell already reserves its widest state, so the row stays put and only the letters move. It is a layout root:
 * the letters measure their glide inside the label only, so when the button itself moves (a page entering, a panel
 * sliding, a list reflowing) they ride along instead of flying in from where the button used to be.
 */
function MorphText({ text, reduced }: { text: string; reduced: boolean }) {
  const glyphs = useGlyphs(text)
  return (
    <motion.span className="relative inline-flex justify-self-start whitespace-pre [grid-area:1/1]" layoutRoot>
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
            transition={reduced ? instant : { ...enter, delay: Math.min(glyph.order * 0.02, 0.12), layout: settle }}
          >
            {glyph.char}
          </motion.span>
        ))}
      </AnimatePresence>
    </motion.span>
  )
}

const measureClass = "invisible [grid-area:1/1]"

export function CopyButton({
  value,
  label = "Copy",
  className,
  iconOnly = false,
  variant = "outline",
  disabled,
  onCopied,
}: CopyButtonProps) {
  const { state, copy } = useCopyFeedback()
  const reduced = useReducedMotion() ?? false
  const text = state === "copied" ? "Copied" : state === "error" ? "Failed" : label

  async function handleCopy() {
    if (await copy(value)) onCopied?.()
  }

  return (
    <>
      <ButtonPrimitive
        type="button"
        className={cn(copyButtonVariants({ variant, iconOnly }), className)}
        onClick={() => void handleCopy()}
        aria-label={label}
        data-copy-state={state}
        disabled={disabled}
      >
        {/* Each icon carries its own color, so the outgoing glyph never tints on its way out. */}
        <span className="relative grid size-4 flex-none" aria-hidden="true">
          <AnimatePresence initial={false}>
            <motion.span
              key={state}
              className="absolute inset-0 grid place-items-center data-[state=copied]:text-success data-[state=error]:text-danger"
              data-state={state}
              initial={reduced ? fadeIn : iconIn}
              animate={rest}
              exit={reduced ? fadeOut : iconOut}
              transition={reduced ? instant : iconEnter}
            >
              {state === "copied" ? (
                <DrawnCheck reduced={reduced} />
              ) : state === "error" ? (
                <WarningCircleIcon size={16} />
              ) : (
                <CopyIcon size={16} />
              )}
            </motion.span>
          </AnimatePresence>
        </span>
        {/* The inline padding gives blurred edge letters room before the horizontal clip; the negative margin keeps the box the same size. */}
        {!iconOnly && (
          <span className="-mx-1 grid min-w-0 overflow-x-clip px-1 text-left whitespace-nowrap" aria-hidden="true">
            <span className={measureClass}>{label}</span>
            <span className={measureClass}>Copied</span>
            <span className={measureClass}>Failed</span>
            <MorphText text={text} reduced={reduced} />
          </span>
        )}
      </ButtonPrimitive>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "idle" ? "" : state === "error" ? `${label}: Could not copy` : `${label}: Copied`}
      </span>
    </>
  )
}

export default CopyButton
