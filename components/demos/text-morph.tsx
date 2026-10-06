"use client"

import { useEffect, useState } from "react"
import { useDialKit } from "dialkit"

import { Button } from "@/components/ui/button"
import { TextMorph } from "@/components/ui/text-morph"

type PublishState = "idle" | "busy" | "done"

const publishLabels: Record<PublishState, string> = {
  idle: "Publish",
  busy: "Publishing",
  done: "Published",
}

/** Passing the label as a prop keeps the Button's own label crossfade out of the way, so only TextMorph animates the change. */
function Label({ text }: { text: string }) {
  return <TextMorph>{text}</TextMorph>
}

export default function Demo() {
  const [state, setState] = useState<PublishState>("idle")
  const [following, setFollowing] = useState(false)
  // TextMorph has no tunable props of its own; the panel only offers triggers for the two morphs.
  useDialKit(
    "Text morph",
    {
      publish: { type: "action", label: "Publish" },
      follow: { type: "action", label: "Follow / unfollow" },
    },
    {
      id: "text-morph",
      onAction: (action) => {
        if (action === "publish") setState((current) => (current === "idle" ? "busy" : current))
        else setFollowing((value) => !value)
      },
    },
  )

  // Publishing settles on its own, then the label returns to idle so the morph can be replayed.
  useEffect(() => {
    if (state === "idle") return
    const timer = window.setTimeout(() => setState(state === "busy" ? "done" : "idle"), state === "busy" ? 1400 : 1800)
    return () => window.clearTimeout(timer)
  }, [state])

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => state === "idle" && setState("busy")} aria-live="polite">
        <Label text={publishLabels[state]} />
      </Button>
      <Button variant="secondary" aria-pressed={following} onClick={() => setFollowing((value) => !value)}>
        <Label text={following ? "Following" : "Follow"} />
      </Button>
    </div>
  )
}
