"use client"

import Link from "next/link"
import { Suspense, useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react"

import { demos } from "@/components/demos"
import { iconButton } from "@/components/gallery/icon-button"
import { createAutoplayContext, isAbortError } from "@/components/gallery/showcase-autoplay"
import { showcaseScripts } from "@/components/gallery/showcase-scripts"
import { catalog } from "@/lib/catalog"
import { useMotionTokens } from "@/lib/motion-tokens-context"
import { prefersReducedMotion } from "@/lib/reduced-motion"
import { showcase } from "@/lib/showcase"
import { cn } from "@/lib/utils"

function ShowcaseTile({ name }: { name: string }) {
  const item = catalog.find(entry => entry.name === name)
  const Demo = demos[name]
  const motionTokens = useMotionTokens()
  const areaRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const [seen, setSeen] = useState(false)
  // Each run remounts the demo from its initial state; run 0 is the autoplay on first sight.
  const [run, setRun] = useState(0)

  // Mount the demo once its cell nears the viewport, and start its script once the cell is in view; both stick.
  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    const nearObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setNear(true)
        nearObserver.disconnect()
      },
      { rootMargin: "200px" },
    )
    const seenObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setSeen(true)
        seenObserver.disconnect()
      },
      { threshold: 0.4 },
    )
    nearObserver.observe(area)
    seenObserver.observe(area)
    return () => {
      nearObserver.disconnect()
      seenObserver.disconnect()
    }
  }, [])

  // Play the scripted walkthrough. Reduced motion skips the autoplay, but an explicit replay still runs it.
  useEffect(() => {
    const stage = stageRef.current
    const loadScript = showcaseScripts[name]
    if (!seen || !stage || !loadScript) return
    if (run === 0 && prefersReducedMotion()) return

    const controller = new AbortController()
    // The viewer taking hold of the demo ends the script, so the two never fight over it. Scrolling the page past the
    // tile doesn't count: a touch only takes over once it ends as a gesture (a scroll ends in pointercancel instead).
    const takeOver = (event: Event) => {
      if (!event.isTrusted) return
      const touch = event instanceof PointerEvent && event.pointerType === "touch"
      if (event.type === "keydown" || (event.type === "pointerdown" && !touch) || (event.type === "pointerup" && touch)) controller.abort()
    }
    const events = ["pointerdown", "pointerup", "keydown"] as const
    events.forEach(type => stage.addEventListener(type, takeOver, { capture: true, passive: true }))

    loadScript()
      .then(module => module.default(createAutoplayContext(stage, controller.signal)))
      .catch(error => {
        if (!isAbortError(error) && process.env.NODE_ENV !== "production") console.warn(`[showcase] ${name}:`, error)
      })

    return () => {
      controller.abort()
      events.forEach(type => stage.removeEventListener(type, takeOver, { capture: true }))
    }
  }, [name, run, seen])

  if (!item || !Demo) return null

  return (
    <div className="flex flex-col">
      <div ref={areaRef} data-showcase-tile className="relative flex h-[28rem] items-center justify-center overflow-hidden p-4">
        <div ref={stageRef} className="contents">
          {near && (
            <Suspense fallback={null}>
              <Demo key={run} />
            </Suspense>
          )}
        </div>
        {showcaseScripts[name] && (
          <button
            type="button"
            aria-label={`Replay ${item.title}`}
            onClick={() => setRun(value => value + 1)}
            className={cn(iconButton, "absolute top-3 right-3 z-20 rounded-full bg-foreground/8 outline-none backdrop-blur-md pointer-fine:hover:bg-foreground/12 active:bg-foreground/16")}
          >
            <motion.span
              aria-hidden="true"
              className="grid place-items-center"
              animate={{ rotate: -360 * run }}
              transition={motionTokens.spring.smooth}
            >
              <ArrowCounterClockwiseIcon size={18} />
            </motion.span>
          </button>
        )}
      </div>
      <Link
        href={`/components/${name}`}
        className="px-3 py-2.5 text-sm font-medium transition-colors duration-160 hover:text-text-secondary"
      >
        {item.title}
      </Link>
    </div>
  )
}

export function ShowcaseGrid() {
  return (
    <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-surface border border-border bg-border sm:grid-cols-2">
      {showcase.map(name => (
        <li key={name} className="min-w-0 bg-surface">
          <ShowcaseTile name={name} />
        </li>
      ))}
    </ul>
  )
}
