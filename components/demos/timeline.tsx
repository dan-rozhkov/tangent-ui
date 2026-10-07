"use client"

import { DangerTriangle, GitMerge, Rocket } from "@mynaui/icons-react"

import { Timeline, type TimelineEvent } from "@/components/ui/timeline"
import { avatar } from "@/lib/media"

/* A fixed clock keeps relative labels and day groups identical on the server and the client. */
const NOW = Date.UTC(2026, 8, 22, 14, 30)
const minutes = (count: number) => NOW - count * 60_000
const hours = (count: number) => NOW - count * 3_600_000

const events: TimelineEvent[] = [
  { id: "merge", at: minutes(6), actor: "Maya Collins", title: "merged Checkout redesign into main", meta: "Pull request #482", avatar: avatar("emma-collins") },
  {
    id: "deploy",
    at: minutes(41),
    title: "Production deploy finished",
    meta: "Build 1,204 in 3m 12s",
    icon: <Rocket />,
    tone: "success",
    detail: <p className="m-0">All 214 checks passed. The release is live in three regions.</p>,
  },
  { id: "review", at: hours(3), actor: "Marcus Johnson", title: "requested changes on Payment form states", meta: "Pull request #479", avatar: avatar("marcus-johnson") },
  {
    id: "failed",
    at: hours(9),
    title: "Staging deploy failed",
    meta: "Build 1,203",
    icon: <DangerTriangle />,
    tone: "danger",
    detail: <pre className="m-0 overflow-x-auto font-mono text-xs">{"Step 4/6: migrate\nerror: column \"currency\" already exists\nBuild step exited with code 1"}</pre>,
  },
  { id: "branch", at: hours(26), actor: "Jasmine Brooks", title: "opened Pricing page refresh", meta: "Pull request #476", icon: <GitMerge />, avatar: avatar("jasmine-brooks") },
  { id: "tag", at: hours(30), actor: "Olivia Bennett", title: "tagged release v2.8.0", avatar: avatar("olivia-bennett") },
  { id: "old", at: hours(75), title: "Nightly backup completed", meta: "4.2 GB", icon: <Rocket />, tone: "neutral" },
]

export default function Demo() {
  return (
    <div className="w-full max-w-xl">
      <Timeline events={events} now={NOW} label="Project activity" maxHeight={460} defaultExpanded={["failed"]} />
    </div>
  )
}
