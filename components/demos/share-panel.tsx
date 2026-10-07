"use client"

import { BuildingsIcon, ChatCircleIcon, EnvelopeIcon, FileTextIcon, GlobeIcon, LockIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react"

import { ShareSheet } from "@/components/ui/share-sheet"
import { people as media } from "@/lib/media"

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const people = media.slice(0, 5).map(person => ({ id: person.id, name: person.name, avatar: person.src }))

export default function Demo() {
  return (
    <div className="relative h-[400px] w-full max-w-[680px] rounded-surface border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium">
          <FileTextIcon className="size-4 flex-none text-text-muted" aria-hidden="true" />
          <span className="truncate">Q3 launch plan</span>
        </span>
        <ShareSheet
          title="Q3 launch plan"
          link="https://example.com/d/q3-launch-plan"
          people={people}
          access={[
            { value: "invited", label: "Only invited people", description: "Only people you add can open", icon: <LockIcon size={16} /> },
            { value: "org", label: "Anyone at Northwind", description: "Can view and comment", icon: <BuildingsIcon size={16} /> },
            { value: "public", label: "Anyone with the link", description: "Can view", icon: <GlobeIcon size={16} /> },
          ]}
          defaultAccess="org"
          channels={[
            { id: "slack", label: "Slack", doneLabel: "Posted", icon: <ChatCircleIcon size={16} /> },
            { id: "email", label: "Email", doneLabel: "Sent", icon: <EnvelopeIcon size={16} /> },
            { id: "telegram", label: "Message", doneLabel: "Sent", icon: <PaperPlaneTiltIcon size={16} /> },
          ]}
          onSend={() => wait(900)}
          onChannel={() => wait(800)}
        />
      </div>
      <div className="flex flex-col gap-2 p-5" aria-hidden="true">
        <div className="h-3 w-2/3 rounded-full bg-border" />
        <div className="h-3 w-1/2 rounded-full bg-border" />
        <div className="h-3 w-3/5 rounded-full bg-border" />
      </div>
    </div>
  )
}
