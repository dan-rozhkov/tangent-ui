"use client"

import { useState } from "react"

import SegmentedControl from "@/components/ui/segmented-control"

export default function Demo() {
  const [range, setRange] = useState("week")
  const [view, setView] = useState("inbox")

  return (
    <div className="grid w-full max-w-full justify-items-center gap-6">
      <SegmentedControl
        label="Range"
        value={range}
        onValueChange={setRange}
        options={[
          { value: "day", label: "Day" },
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ]}
      />
      {/* Narrow frame: the track scrolls inside itself and fades the side with more to see. */}
      <div className="flex w-full max-w-64 justify-center">
        <SegmentedControl
          label="Folder"
          value={view}
          onValueChange={setView}
          options={[
            {
              value: "inbox",
              label: "Inbox",
              accessory: <span className="rounded-pill bg-surface-muted px-1.5 text-xs text-text-secondary tabular-nums">12</span>,
            },
            { value: "drafts", label: "Drafts" },
            { value: "sent", label: "Sent" },
            { value: "archive", label: "Archive" },
            { value: "spam", label: "Spam" },
          ]}
        />
      </div>
    </div>
  )
}
