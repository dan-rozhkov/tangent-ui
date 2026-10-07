"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Moon, Sun } from "@mynaui/icons-react"

import { Button } from "@/components/ui/button"
import { useMotionTokens, type MotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export type ThemeSwitchVariant = "reveal" | "eclipse" | "split" | "rise"
export type Theme = "light" | "dark"

export interface ThemeSwitchProps {
  theme: Theme
  variant?: ThemeSwitchVariant
  onThemeChange: (next: Theme, variant: ThemeSwitchVariant, trigger: HTMLElement) => void
  label?: string
  iconOnly?: boolean
}

function createMotion(motionTokens: MotionTokens) {
  /** Rotation and scale ride the spring; opacity and blur tween so the blur never overshoots below zero. */
  const iconSpring = {
    ...motionTokens.spring.snappy,
    opacity: {
      duration: motionTokens.duration.fast,
      ease: [...motionTokens.ease.enter],
    },
    filter: {
      duration: motionTokens.duration.fast,
      ease: [...motionTokens.ease.enter],
    },
  } as const
  const iconExit = {
    duration: motionTokens.duration.fast,
    ease: [...motionTokens.ease.standard],
  } as const
  const blur = `blur(${motionTokens.blur.subtle}px)`
  return { iconSpring, iconExit, blur }
}

/* Each transition uses the same library Button, which owns the press scale; this file only animates the icon in place. */
const switchClass = "group/theme-switch relative w-auto px-3 pointer-fine:hover:not-disabled:border-border-strong"
const iconOnlyClass =
  "size-[38px] min-h-[38px] min-w-[38px] rounded-[12px] p-0 pointer-fine:hover:not-disabled:bg-surface-muted pointer-fine:hover:not-disabled:shadow-none"

/* Each variant nudges the icon the way its page transition travels, and eases back when the theme returns. */
const nudge: Record<ThemeSwitchVariant, string> = {
  reveal: "group-data-[theme=dark]/theme-switch:[transform:scale(1.08)]",
  eclipse: "group-data-[theme=dark]/theme-switch:[transform:translateX(-2px)]",
  split: "group-data-[theme=dark]/theme-switch:[transform:translateX(1px)]",
  rise: "group-data-[theme=dark]/theme-switch:[transform:translateY(-2px)]",
}

/** A stored preference usually reaches the theme prop just after hydration. That correction swaps the icon in place;
 *  only changes after the first painted frames animate, so a page that loads in dark mode never spins its switches. */
function useSettled() {
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setSettled(true))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [])
  return settled
}

/** Both icons turn the same way (clockwise into dark, back out of it), so the swap reads as one rotation rather than two fades. */
function ThemeIcon({ theme, reduced, settled }: { theme: Theme; reduced: boolean; settled: boolean }) {
  const motionTokens = useMotionTokens()
  const { iconSpring, iconExit, blur } = useMemo(() => createMotion(motionTokens), [motionTokens])
  const Icon = theme === "light" ? Sun : Moon
  const angle = theme === "light" ? 30 : -30
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span
        key={theme}
        className="absolute grid size-[18px] place-items-center"
        initial={!settled ? false : reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7, rotate: angle, filter: blur }}
        animate={{ opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" }}
        exit={
          !settled
            ? { opacity: 0, transition: { duration: 0 } }
            : reduced
              ? {
                  opacity: 0,
                  transition: { duration: motionTokens.duration.instant },
                }
              : {
                  opacity: 0,
                  scale: 0.7,
                  rotate: angle,
                  filter: blur,
                  transition: iconExit,
                }
        }
        transition={reduced ? { duration: motionTokens.duration.instant } : iconSpring}
        aria-hidden="true"
      >
        <Icon size={16} strokeWidth={1.75} />
      </motion.span>
    </AnimatePresence>
  )
}

export function ThemeSwitch({ theme, variant = "reveal", onThemeChange, label, iconOnly = false }: ThemeSwitchProps) {
  const reduced = useReducedMotion() ?? false
  const settled = useSettled()
  const next = theme === "light" ? "dark" : "light"

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className={cn(switchClass, iconOnly && iconOnlyClass)}
      data-theme={theme}
      aria-label={label ?? `Switch to ${next} mode`}
      aria-pressed={theme === "dark"}
      onClick={(event) => onThemeChange(next, variant, event.currentTarget)}
    >
      <span
        className={cn(
          "relative inline-grid size-5 flex-[0_0_20px] place-items-center",
          nudge[variant],
          // The nudge only eases once the switch has settled, so a theme that arrives during hydration lands without motion.
          settled && "[transition:transform_var(--duration-spring)_var(--ease-spring)] motion-reduce:transition-none"
        )}
      >
        <ThemeIcon theme={theme} reduced={reduced} settled={settled} />
      </span>
      {!iconOnly && <span className="whitespace-nowrap">Switch theme</span>}
    </Button>
  )
}

export default ThemeSwitch
