"use client"

import { Suspense, useSyncExternalStore } from "react"
import { DialRoot } from "dialkit"
import "dialkit/styles.css"
import { useTheme } from "next-themes"

import { demos } from "@/components/demos"
import { MotionDials } from "@/components/gallery/motion-dials"
import { tunableDemos } from "@/components/gallery/tunable"

export function DemoStage({ name }: { name: string }) {
  const Demo = demos[name]
  const stage = (
    <div data-stage className="flex min-h-80 min-w-0 items-center justify-center rounded-surface border border-border bg-surface p-8 sm:p-12">
      {Demo ? (
        <Suspense fallback={null}>
          {tunableDemos.has(name) ? (
            <MotionDials>
              <Demo />
            </MotionDials>
          ) : (
            <Demo />
          )}
        </Suspense>
      ) : (
        <p className="text-sm text-text-muted">Not ported yet.</p>
      )}
    </div>
  )

  if (!Demo || !tunableDemos.has(name)) return stage
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
      {stage}
      <aside aria-label="Tune" className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
        <TunePanel />
      </aside>
    </div>
  )
}

function TunePanel() {
  const { resolvedTheme } = useTheme()
  // The theme is only known on the client; render the panel after mount so server and client agree.
  const mounted = useSyncExternalStore(noop, () => true, () => false)
  if (!mounted) return null
  return <DialRoot mode="inline" productionEnabled theme={resolvedTheme === "dark" ? "dark" : "light"} />
}

const noop = () => () => {}
