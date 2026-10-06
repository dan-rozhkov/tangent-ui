"use client"

import { flushSync } from "react-dom"
import { useTheme } from "next-themes"

import { ThemeSwitch, type Theme, type ThemeSwitchVariant } from "@/components/ui/theme-switch"
import { motionTokens } from "@/lib/motion-tokens"

/* The switch only reports the change; the page transition below is demo code, run with the View Transition API.
   Each variant clips the incoming snapshot of the page while the outgoing one stays put underneath. */

const curve = (points: readonly number[]) => `cubic-bezier(${points.join(",")})`
/** Replaces the default crossfade for the length of one transition, so only the clip moves. */
const resetCss = "::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}"

function clipFor(
  variant: ThemeSwitchVariant,
  next: Theme,
  trigger: HTMLElement
): { clipPath: string[]; easing: string; duration: number } {
  const width = window.innerWidth
  const height = window.innerHeight
  const { left, top, width: w, height: h } = trigger.getBoundingClientRect()
  const x = left + w / 2
  const y = top + h / 2
  const duration = motionTokens.duration.considered * 1000
  switch (variant) {
    case "eclipse": {
      // A disc wide enough to cover the page crosses it, leaning the way the icon does: right to left into dark, back the other way.
      const radius = Math.hypot(width, height)
      const from = next === "dark" ? width + radius : -radius
      return {
        clipPath: [`circle(${radius}px at ${from}px ${y}px)`, `circle(${radius}px at ${width / 2}px ${y}px)`],
        easing: curve(motionTokens.ease.inOut),
        duration: duration * 1.25,
      }
    }
    case "split":
      // Opens from a slim seam down the middle, wherever the button sits.
      return {
        clipPath: ["inset(0 calc(50% - 1px))", "inset(0 0)"],
        easing: curve(motionTokens.ease.inOut),
        duration,
      }
    case "rise":
      return {
        clipPath: ["inset(100% 0 0 0)", "inset(0 0 0 0)"],
        easing: curve(motionTokens.ease.enter),
        duration,
      }
    default: {
      // Grows from the center of the button out to the farthest corner.
      const radius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y))
      return {
        clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
        easing: curve(motionTokens.ease.standard),
        duration,
      }
    }
  }
}

/** Applies the theme inside a view transition that matches the variant. Reduced motion, or a browser without view transitions, swaps it directly. */
export function runThemeTransition(
  next: Theme,
  variant: ThemeSwitchVariant,
  trigger: HTMLElement,
  setTheme: (theme: Theme) => void
) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (reduced || typeof document.startViewTransition !== "function") {
    setTheme(next)
    return
  }
  const style = document.createElement("style")
  style.textContent = resetCss
  document.head.appendChild(style)
  const transition = document.startViewTransition(() => {
    flushSync(() => setTheme(next))
    // next-themes writes the attribute from an effect; set it here too so the new snapshot is already in the next theme.
    document.documentElement.setAttribute("data-theme", next)
    document.documentElement.style.colorScheme = next
  })
  transition.ready
    .then(() => {
      const { clipPath, easing, duration } = clipFor(variant, next, trigger)
      document.documentElement.animate({ clipPath }, { duration, easing, pseudoElement: "::view-transition-new(root)" })
    })
    .catch(() => {})
  transition.finished.finally(() => style.remove())
}

export function useThemeTransition() {
  const { resolvedTheme, setTheme } = useTheme()
  const theme: Theme = resolvedTheme === "dark" ? "dark" : "light"
  const onThemeChange = (next: Theme, variant: ThemeSwitchVariant, trigger: HTMLElement) =>
    runThemeTransition(next, variant, trigger, setTheme)
  return { theme, onThemeChange }
}

const variants: { variant: ThemeSwitchVariant; caption: string }[] = [
  { variant: "reveal", caption: "Reveal" },
  { variant: "eclipse", caption: "Eclipse" },
  { variant: "split", caption: "Split" },
  { variant: "rise", caption: "Rise" },
]

export default function Demo() {
  const { theme, onThemeChange } = useThemeTransition()
  return (
    <div className="flex flex-wrap items-start gap-6">
      {variants.map(({ variant, caption }) => (
        <div key={variant} className="grid justify-items-center gap-2">
          <ThemeSwitch theme={theme} variant={variant} onThemeChange={onThemeChange} />
          <span className="text-xs text-text-secondary">{caption}</span>
        </div>
      ))}
    </div>
  )
}
