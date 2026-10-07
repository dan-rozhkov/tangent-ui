"use client"

import { HeadphonesIcon, MoonIcon, UsersIcon } from "@phosphor-icons/react"

import { ControlCenter } from "@/components/ui/control-center"
import { person } from "@/lib/media"

const people = (["emma-collins", "tyler-hayes", "ryan-sullivan"] as const).map(id => {
  const { name, src } = person(id)
  return { id, name, avatar: src }
})

export default function Demo() {
  return (
    <div className="flex min-h-[520px] w-[628px] max-w-full items-center justify-center rounded-[28px] border border-border bg-surface-muted p-6 max-sm:p-3">
      <ControlCenter
        focusModes={[
          { id: "deep", label: "Deep work", icon: HeadphonesIcon, description: "Only mentions from your team get through", defaultMinutes: 50 },
          { id: "meetings", label: "Meetings", icon: UsersIcon, description: "Calls and calendar alerts only", defaultMinutes: 30 },
          { id: "wind-down", label: "Wind down", icon: MoonIcon, description: "Everything waits until tomorrow", defaultMinutes: 45 },
        ]}
        channels={[
          { id: "mentions", label: "Mentions", description: "When someone tags you", defaultOn: true },
          { id: "direct", label: "Direct messages", description: "One to one and small groups", defaultOn: true },
          { id: "deploys", label: "Deploy alerts", description: "Failed builds on main" },
        ]}
        people={people}
        defaultVolume={64}
      />
    </div>
  )
}
