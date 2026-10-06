"use client"

import { KeyRound, Trash2 } from "lucide-react"
import { useDialKit } from "dialkit"

import { ConfirmMorph } from "@/components/ui/confirm-morph"

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default function Demo() {
  const dial = useDialKit(
    "Confirm morph",
    {
      disabled: false,
      cancelOnOutsidePress: true,
      confirmTimeout: [6000, 0, 15000, 500],
      resultTimeout: [5000, 0, 15000, 500],
      delete: {
        label: "Delete",
        tone: { type: "select", options: ["danger", "neutral"], default: "danger" },
      },
      revoke: {
        label: "Revoke access",
        tone: { type: "select", options: ["danger", "neutral"], default: "neutral" },
      },
    },
    { id: "confirm-morph" }
  )
  const shared = {
    disabled: dial.disabled,
    cancelOnOutsidePress: dial.cancelOnOutsidePress,
    confirmTimeout: dial.confirmTimeout,
    resultTimeout: dial.resultTimeout,
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <ConfirmMorph
        {...shared}
        label={dial.delete.label}
        tone={dial.delete.tone as "danger" | "neutral"}
        icon={<Trash2 size={16} strokeWidth={1.75} />}
        prompt="Delete 3 files?"
        onConfirm={() => wait(1200)}
        onUndo={() => wait(800)}
      />
      <ConfirmMorph
        {...shared}
        label={dial.revoke.label}
        icon={<KeyRound size={16} strokeWidth={1.75} />}
        prompt="Revoke for Maya?"
        confirmLabel="Revoke"
        pendingLabel="Revoking"
        doneLabel="Revoked"
        tone={dial.revoke.tone as "danger" | "neutral"}
        onConfirm={() => wait(1000)}
      />
    </div>
  )
}
