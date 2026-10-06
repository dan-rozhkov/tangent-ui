"use client"

import { useDialKit } from "dialkit"
import { Archive, Clock3, Forward, Reply, Trash2 } from "lucide-react"

import { ExpandingButtonGroup } from "@/components/ui/expanding-button-group"

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export default function Demo() {
  const props = useDialKit(
    "Expanding button group",
    {
      confirmDuration: [1400, 300, 4000, 100],
      deleteDisabled: true,
      size: { type: "select", options: ["md", "sm"], default: "md" },
    },
    { id: "expanding-button-group" },
  )

  return (
    <div className="flex flex-col items-center gap-6">
      <ExpandingButtonGroup
        label="Message actions"
        size={props.size as "sm" | "md"}
        confirmDuration={props.confirmDuration}
        defaultExpanded="reply"
        items={[
          { id: "reply", label: "Reply", icon: <Reply /> },
          { id: "forward", label: "Forward", icon: <Forward /> },
          { id: "archive", label: "Archive", doneLabel: "Archived", icon: <Archive /> },
          { id: "snooze", label: "Snooze", doneLabel: "Snoozed", icon: <Clock3 />, onSelect: () => wait(700) },
          { id: "delete", label: "Delete", doneLabel: "Deleted", tone: "danger", icon: <Trash2 /> },
        ]}
      />
      <ExpandingButtonGroup
        label="Compact message actions"
        size="sm"
        confirmDuration={props.confirmDuration}
        items={[
          { id: "reply", label: "Reply", icon: <Reply /> },
          { id: "archive", label: "Archive", doneLabel: "Archived", icon: <Archive /> },
          { id: "delete", label: "Delete", doneLabel: "Deleted", tone: "danger", icon: <Trash2 />, disabled: props.deleteDisabled },
        ]}
      />
    </div>
  )
}
