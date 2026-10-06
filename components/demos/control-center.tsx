"use client"

import { useState } from "react"
import { Headphones, Moon, Users } from "lucide-react"
import { useDialKit } from "dialkit"

import { ControlCenter } from "@/components/ui/control-center"
import { person } from "@/lib/media"

const people = (["emma-collins", "tyler-hayes", "ryan-sullivan"] as const).map(id => {
  const { name, src } = person(id)
  return { id, name, avatar: src }
})

export default function Demo() {
  const [run, setRun] = useState(0)
  const dials = useDialKit(
    "Control center",
    {
      label: { type: "text", default: "Quick settings" },
      volume: [64, 0, 100, 1],
      textSize: [100, 85, 130, 5],
      reset: { type: "action", label: "Reset panel" },
    },
    { id: "control-center", onAction: () => setRun(n => n + 1) },
  )

  return (
    <div className="flex min-h-[520px] w-[628px] max-w-full items-center justify-center rounded-[28px] border border-border bg-surface-muted p-6 max-sm:p-3">
      <ControlCenter
        key={`${run}-${dials.volume}-${dials.textSize}`}
        label={dials.label}
        focusModes={[
          { id: "deep", label: "Deep work", icon: Headphones, description: "Only mentions from your team get through", defaultMinutes: 50 },
          { id: "meetings", label: "Meetings", icon: Users, description: "Calls and calendar alerts only", defaultMinutes: 30 },
          { id: "wind-down", label: "Wind down", icon: Moon, description: "Everything waits until tomorrow", defaultMinutes: 45 },
        ]}
        channels={[
          { id: "mentions", label: "Mentions", description: "When someone tags you", defaultOn: true },
          { id: "direct", label: "Direct messages", description: "One to one and small groups", defaultOn: true },
          { id: "deploys", label: "Deploy alerts", description: "Failed builds on main" },
        ]}
        people={people}
        defaultVolume={dials.volume}
        defaultTextSize={dials.textSize}
      />
    </div>
  )
}
