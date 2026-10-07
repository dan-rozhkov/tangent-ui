"use client"

import { BookOpenIcon, ChatCircleIcon, EnvelopeIcon, GlobeIcon, LockIcon, PaperPlaneTiltIcon, UsersThreeIcon } from "@phosphor-icons/react"

import { SharePanel } from "@/components/ui/share-panel"
import { people as media } from "@/lib/media"

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const contacts = media.slice(0, 5).map(person => ({ id: person.id, name: person.name, avatar: person.src }))

export default function Demo() {
  return (
    <div className="relative h-[400px] w-full max-w-[680px] rounded-surface border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium">
          <BookOpenIcon className="size-4 flex-none text-text-muted" aria-hidden="true" />
          <span className="truncate">Autumn menu draft</span>
        </span>
        <SharePanel
          subject="Autumn menu draft"
          url="https://example.com/m/autumn-menu"
          contacts={contacts}
          audiences={[
            { id: "invited", label: "Invited only", note: "Just the people you add", icon: <LockIcon size={16} /> },
            { id: "team", label: "Anyone on the kitchen team", note: "Can edit", icon: <UsersThreeIcon size={16} /> },
            { id: "public", label: "Anyone with the link", note: "Can read only", icon: <GlobeIcon size={16} /> },
          ]}
          defaultAudience="team"
          routes={[
            { id: "chat", label: "Chat", sentLabel: "Posted", icon: <ChatCircleIcon size={16} /> },
            { id: "email", label: "Email", sentLabel: "Mailed", icon: <EnvelopeIcon size={16} /> },
            { id: "text", label: "Text", sentLabel: "Texted", icon: <PaperPlaneTiltIcon size={16} /> },
          ]}
          onDeliver={() => wait(900)}
          onRoute={() => wait(800)}
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
