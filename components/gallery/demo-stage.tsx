"use client"

import { Suspense, useRef } from "react"

import { demos } from "@/components/demos"
import { ReplayButton, useDemoAutoplay } from "@/components/gallery/demo-autoplay"

export function DemoStage({ name, title }: { name: string; title: string }) {
  const Demo = demos[name]
  const areaRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const { run, replay, hasScript } = useDemoAutoplay(name, areaRef, stageRef, { takeOver: "page" })

  return (
    <div
      ref={areaRef}
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
