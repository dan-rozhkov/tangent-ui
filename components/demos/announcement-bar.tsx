"use client"

import { useState } from "react"

import { AnnouncementBar } from "@/components/ui/announcement-bar"
import { Button } from "@/components/ui/button"

/* The sale ends a fixed span after the demo mounts, so server and client agree and the countdown is always live. */
const SALE_MS = 3 * 24 * 3600_000 + 4 * 3600_000

export default function Demo() {
  const [open, setOpen] = useState(true)
  const [saleEnds] = useState(() => Date.now() + SALE_MS)

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="w-full overflow-hidden rounded-panel border border-border">
        <AnnouncementBar
          tone="inverted"
          controls
          open={open}
          onOpenChange={setOpen}
          messages={[
            {
              id: "sale",
              message: "Fall sale: 30% off annual plans.",
              countdown: { to: saleEnds, label: "Ends in" },
              action: { label: "See plans", href: "#pricing" },
            },
            { id: "launch", message: "Workflows are now in beta.", action: { label: "Read more", href: "#blog" } },
          ]}
        />
      </div>
      {open ? null : (
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Show again
        </Button>
      )}
    </div>
  )
}
