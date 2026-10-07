"use client"

import { useEffect, useState, type RefObject } from "react"
import { motion } from "motion/react"
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react"

import { iconButton } from "@/components/gallery/icon-button"
import { createAutoplayContext, isAbortError } from "@/components/gallery/showcase-autoplay"
import { showcaseScripts } from "@/components/gallery/showcase-scripts"
import { useMotionTokens } from "@/lib/motion-tokens-context"
import { prefersReducedMotion } from "@/lib/reduced-motion"
import { cn } from "@/lib/utils"

/**
 * Plays a demo's scripted walkthrough once its area is in view. `run` keys the demo, so each replay remounts it from
 * its initial state; run 0 is the autoplay on first sight. With `takeOver: "page"` a press or key anywhere on the page
 * ends the run, which a demo alone on its page needs: its dialogs and menus portal out of the stage.
 */
export function useDemoAutoplay(
  name: string,
  areaRef: RefObject<HTMLElement | null>,
  stageRef: RefObject<HTMLElement | null>,
  { takeOver: scope = "stage" }: { takeOver?: "stage" | "page" } = {},
) {
  const [seen, setSeen] = useState(false)
  const [run, setRun] = useState(0)

  // Seen once the area reaches the middle half of the viewport, which a demo taller than the screen still does.
  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setSeen(true)
        observer.disconnect()
      },
      { rootMargin: "-25% 0px -25% 0px" },
    )
    observer.observe(area)
    return () => observer.disconnect()
  }, [areaRef])

  // Reduced motion skips the autoplay, but an explicit replay still runs it.
  useEffect(() => {
    const stage = stageRef.current
    const loadScript = Object.hasOwn(showcaseScripts, name) ? showcaseScripts[name] : undefined
    if (!seen || !stage || !loadScript) return
    if (run === 0 && prefersReducedMotion()) return

    const controller = new AbortController()
    // The viewer taking hold of the demo ends the script, so the two never fight over it. Scrolling the page past the
    // demo doesn't count: a touch only takes over once it ends as a gesture (a scroll ends in pointercancel instead).
    const takeOver = (event: Event) => {
      if (!event.isTrusted) return
      const touch = event instanceof PointerEvent && event.pointerType === "touch"
      if (event.type === "keydown" || (event.type === "pointerdown" && !touch) || (event.type === "pointerup" && touch)) controller.abort()
    }
    const events = ["pointerdown", "pointerup", "keydown"] as const
    const target = scope === "page" ? document : stage
    events.forEach(type => target.addEventListener(type, takeOver, { capture: true, passive: true }))

    loadScript()
      .then(module => module.default(createAutoplayContext(stage, controller.signal)))
      .catch(error => {
        if (!isAbortError(error) && process.env.NODE_ENV !== "production") console.warn(`[autoplay] ${name}:`, error)
      })

    return () => {
      controller.abort()
      events.forEach(type => target.removeEventListener(type, takeOver, { capture: true }))
    }
  }, [name, run, scope, seen, stageRef])

  return { run, replay: () => setRun(value => value + 1), hasScript: Object.hasOwn(showcaseScripts, name) }
}

/** Round translucent button in the demo's top-right corner that remounts the demo and reruns its walkthrough. */
export function ReplayButton({ title, run, onReplay }: { title: string; run: number; onReplay: () => void }) {
  const motionTokens = useMotionTokens()
  return (
    <button
      type="button"
      aria-label={`Replay ${title}`}
      onClick={onReplay}
      className={cn(iconButton, "absolute top-3 right-3 z-20 rounded-full bg-foreground/8 outline-none backdrop-blur-md pointer-fine:hover:bg-foreground/12 active:bg-foreground/16")}
    >
      <motion.span aria-hidden="true" className="grid place-items-center" animate={{ rotate: -360 * run }} transition={motionTokens.spring.smooth}>
        <ArrowCounterClockwiseIcon size={18} />
      </motion.span>
    </button>
  )
}
