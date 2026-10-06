"use client"

import { useMemo, useState, type ReactNode } from "react"
import { useDialKit } from "dialkit"

import { motionTokens } from "@/lib/motion-tokens"
import { MotionTokensProvider, type MotionTokens } from "@/lib/motion-tokens-context"

const { spring, duration, stagger, blur } = motionTokens

// Slider ranges are wide enough to exaggerate a token, not so wide that the slider loses precision.
const config = {
  springs: {
    _collapsed: true,
    snappy: { ...spring.snappy },
    smooth: { ...spring.smooth },
    morph: { ...spring.morph },
    gentle: { ...spring.gentle },
    responsive: { ...spring.responsive },
  },
  durations: {
    _collapsed: true,
    instant: [duration.instant, 0, 1, 0.01],
    fast: [duration.fast, 0, 1, 0.01],
    exit: [duration.exit, 0, 1, 0.01],
    standard: [duration.standard, 0, 1.5, 0.01],
    considered: [duration.considered, 0, 2, 0.01],
  },
  stagger: {
    _collapsed: true,
    char: [stagger.char, 0, 0.1, 0.002],
    word: [stagger.word, 0, 0.2, 0.005],
    line: [stagger.line, 0, 0.3, 0.005],
    item: [stagger.item, 0, 0.2, 0.005],
  },
  blur: {
    _collapsed: true,
    subtle: [blur.subtle, 0, 16, 0.5],
    soft: [blur.soft, 0, 24, 0.5],
    text: [blur.text, 0, 32, 0.5],
  },
  replay: { type: "action", label: "Replay demo" },
} as const satisfies Parameters<typeof useDialKit>[1]

type Spring = MotionTokens["spring"]["snappy"]

/**
 * Returns the dialed spring in the same form as its preset. The panel can switch a spring between
 * duration/bounce and stiffness/damping, but components derive overrides from the preset's own fields
 * (`{ ...smooth, visualDuration: 0.3 }`), and Motion lets stiffness win over duration when both are set.
 */
function sameForm(preset: Spring, dialed: Spring): Spring {
  const byDuration = preset.visualDuration !== undefined
  if (byDuration && dialed.visualDuration === undefined && dialed.stiffness !== undefined) {
    const mass = dialed.mass ?? 1
    const omega = Math.sqrt(dialed.stiffness / mass)
    const ratio = (dialed.damping ?? 10) / (2 * Math.sqrt(dialed.stiffness * mass))
    return { type: "spring", visualDuration: (2 * Math.PI) / (1.2 * omega), bounce: Math.min(1, Math.max(0, 1 - ratio)) }
  }
  if (!byDuration && dialed.stiffness === undefined && dialed.visualDuration !== undefined) {
    const stiffness = ((2 * Math.PI) / (1.2 * dialed.visualDuration)) ** 2
    return { type: "spring", stiffness, damping: 2 * (1 - (dialed.bounce ?? 0)) * Math.sqrt(stiffness) }
  }
  return dialed
}

/** Keeps an object's identity while its contents are unchanged, so one slider doesn't re-run effects keyed on other tokens. */
function useStable<T>(value: T): T {
  const key = JSON.stringify(value)
  return useMemo(() => JSON.parse(key) as T, [key])
}

/** Registers the shared "Motion" panel and feeds its values to the demo below it. Replay remounts the demo. */
export function MotionDials({ children }: { children: ReactNode }) {
  const [run, setRun] = useState(0)
  const values = useDialKit("Motion", config, { id: "motion", defaultCollapsed: true, onAction: () => setRun(n => n + 1) })

  const snappy = useStable(sameForm(spring.snappy, values.springs.snappy as Spring))
  const smooth = useStable(sameForm(spring.smooth, values.springs.smooth as Spring))
  const morph = useStable(sameForm(spring.morph, values.springs.morph as Spring))
  const gentle = useStable(sameForm(spring.gentle, values.springs.gentle as Spring))
  const responsive = useStable(sameForm(spring.responsive, values.springs.responsive as Spring))
  const durations = useStable(values.durations)
  const staggers = useStable(values.stagger)
  const blurs = useStable(values.blur)

  const tokens = useMemo<MotionTokens>(
    () => ({
      duration: durations,
      ease: motionTokens.ease,
      spring: { snappy, smooth, morph, gentle, responsive },
      stagger: staggers,
      blur: blurs,
    }),
    [durations, snappy, smooth, morph, gentle, responsive, staggers, blurs],
  )

  return (
    <MotionTokensProvider value={tokens}>
      <div key={run} className="contents">
        {children}
      </div>
    </MotionTokensProvider>
  )
}
