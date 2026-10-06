"use client"

import { useMemo, useState, type ReactNode } from "react"
import { useDialKit } from "dialkit"

import { motionTokens } from "@/lib/motion-tokens"
import { MotionTokensProvider, type MotionTokens } from "@/lib/motion-tokens-context"

const { spring, duration, stagger, blur } = motionTokens

// Slider ranges are wide enough to exaggerate a token, not so wide that the slider loses precision.
const config = {
  springs: {
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

/** Registers the shared "Motion" panel and feeds its values to the demo below it. Replay remounts the demo. */
export function MotionDials({ children }: { children: ReactNode }) {
  const [run, setRun] = useState(0)
  const values = useDialKit("Motion", config, { id: "motion", onAction: () => setRun(n => n + 1) })

  const tokens = useMemo<MotionTokens>(
    () => ({
      duration: values.durations,
      ease: motionTokens.ease,
      spring: {
        snappy: values.springs.snappy as Spring,
        smooth: values.springs.smooth as Spring,
        morph: values.springs.morph as Spring,
        gentle: values.springs.gentle as Spring,
        responsive: values.springs.responsive as Spring,
      },
      stagger: values.stagger,
      blur: values.blur,
    }),
    [values],
  )

  return (
    <MotionTokensProvider value={tokens}>
      <div key={run} className="contents">
        {children}
      </div>
    </MotionTokensProvider>
  )
}
