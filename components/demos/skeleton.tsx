"use client"

import { useState } from "react"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export default function Demo() {
  const [loading, setLoading] = useState(true)

  return (
    <div className="flex w-49 max-w-full flex-col gap-5">
      {/* The placeholder and the loaded row both start at this column's left edge, and the column is as wide as the loaded row, so the avatar stays put when loading ends and the row rests centred. */}
      <Skeleton avatar lines={2} loading={loading}>
        <div className="flex items-start gap-4">
          <Avatar name="Ada Lovelace" />
          <div className="grid gap-1 pt-1">
            <span className="text-sm font-medium">Ada Lovelace</span>
            <span className="text-xs text-text-secondary">Analyst, Analytical Engine</span>
          </div>
        </div>
      </Skeleton>
      <Button size="sm" variant="secondary" className="self-center" onClick={() => setLoading((value) => !value)}>
        {loading ? "Finish loading" : "Load again"}
      </Button>
    </div>
  )
}
