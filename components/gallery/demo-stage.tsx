"use client"

import { Suspense, useRef } from "react"

import { demos } from "@/components/demos"
import { ReplayButton, useDemoAutoplay } from "@/components/gallery/demo-autoplay"

export function DemoStage({ name, title }: { name: string; title: string }) {
  const Demo = demos[name]
  const stageRef = useRef<HTMLDivElement>(null)
  // Component pages never autoplay; the replay button runs the script on request.
  const { run, replay, hasScript } = useDemoAutoplay(name, stageRef, { takeOver: "page", active: false })

  return (
    <div
      data-stage
      className="relative flex min-h-80 min-w-0 items-center justify-center rounded-surface border border-border bg-surface p-8 sm:p-12"
    >
      {Demo ? (
        <>
          <div ref={stageRef} className="contents">
            <Suspense fallback={null}>
              <Demo key={run} />
            </Suspense>
          </div>
          {hasScript && <ReplayButton title={title} run={run} onReplay={replay} />}
        </>
      ) : (
        <p className="text-sm text-text-muted">Not ported yet.</p>
      )}
    </div>
  )
}
