"use client"

import { ActionButton } from "@/components/ui/action-button"

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export default function Demo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <ActionButton label="Save changes" onAction={() => wait(1200)} />
      <ActionButton label="Publish" pendingLabel="Publishing" successLabel="Published" onAction={() => wait(1600)} />
      <ActionButton label="Deploy" disabled onAction={() => undefined} />
    </div>
  )
}
