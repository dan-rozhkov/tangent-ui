"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { InViewTitle, type InViewTitleVariant } from "@/components/ui/in-view-title"

const variants: InViewTitleVariant[] = ["blur", "word", "line", "tracking", "wipe"]

export default function Demo() {
  const [variant, setVariant] = useState<InViewTitleVariant>("line")

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* The key replays the reveal when the variant changes; once={false} replays it on every entry too. */}
      <InViewTitle
        key={variant}
        className="text-3xl font-medium"
        variant={variant}
        once={false}
        text="Everything your team needs to ship"
        lines={["Everything your team", "needs to ship"]}
      />
      <div className="flex flex-wrap justify-center gap-2">
        {variants.map((next) => (
          <Button key={next} size="sm" variant={next === variant ? "primary" : "secondary"} onClick={() => setVariant(next)}>
            {next}
          </Button>
        ))}
      </div>
    </div>
  )
}
