"use client"

import { Suspense } from "react"

import { demos } from "@/components/demos"

export function DemoStage({ name }: { name: string }) {
  const Demo = demos[name]
  return (
    <div data-stage className="flex min-h-80 min-w-0 items-center justify-center rounded-surface border border-border bg-surface p-8 sm:p-12">
      {Demo ? (
        <Suspense fallback={null}>
          <Demo />
        </Suspense>
      ) : (
        <p className="text-sm text-text-muted">Not ported yet.</p>
      )}
    </div>
  )
}
