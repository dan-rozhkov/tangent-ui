"use client"

import { KeyRound, Trash2 } from "lucide-react"

import { ConfirmMorph } from "@/components/ui/confirm-morph"

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default function Demo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <ConfirmMorph
        label="Delete"
        icon={<Trash2 size={16} strokeWidth={1.75} />}
        prompt="Delete 3 files?"
        onConfirm={() => wait(1200)}
        onUndo={() => wait(800)}
      />
      <ConfirmMorph
        label="Revoke access"
        icon={<KeyRound size={16} strokeWidth={1.75} />}
        prompt="Revoke for Maya?"
        confirmLabel="Revoke"
        pendingLabel="Revoking"
        doneLabel="Revoked"
        tone="neutral"
        onConfirm={() => wait(1000)}
      />
    </div>
  )
}
