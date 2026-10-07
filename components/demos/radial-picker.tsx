"use client"

import { useState } from "react"
import { BellSlashIcon, BookmarkSimpleIcon, LinkSimpleIcon, NotePencilIcon, ProhibitIcon } from "@phosphor-icons/react"

import { RadialPicker } from "@/components/ui/radial-picker"

const confirmations: Record<string, string> = {
  save: "Saved for later",
  copy: "Link copied",
  note: "Note attached",
  mute: "Thread muted",
  block: "Sender blocked",
}

export default function Demo() {
  const [last, setLast] = useState<string | null>(null)

  return (
    // The picks fan out above the trigger, so the group keeps the same room above and below it.
    <div className="flex w-full max-w-xs flex-col items-center gap-8 py-24">
      <RadialPicker
        label="Message options"
        onPick={setLast}
        picks={[
          { id: "save", label: "Save for later", icon: <BookmarkSimpleIcon size={24} />, confirmLabel: "Saved for later" },
          { id: "copy", label: "Copy link", icon: <LinkSimpleIcon size={24} />, confirmLabel: "Link copied" },
          { id: "note", label: "Attach a note", icon: <NotePencilIcon size={24} />, confirmLabel: "Note attached" },
          { id: "mute", label: "Mute thread", icon: <BellSlashIcon size={24} />, confirmLabel: "Thread muted" },
          { id: "block", label: "Block sender", icon: <ProhibitIcon size={24} />, intent: "destructive", confirmLabel: "Sender blocked" },
        ]}
      />
      <div className="w-full rounded-panel border border-border bg-surface p-5 shadow-resting">
        <p className="text-sm font-medium">Re: Invoice 2291 is overdue</p>
        <p className="mt-1 text-sm text-text-secondary">
          {last ? `Last pick: ${confirmations[last]}` : "Press and hold the dots, slide to a pick, let go."}
        </p>
      </div>
    </div>
  )
}
