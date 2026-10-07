"use client"

import { ArchiveIcon, ArrowBendUpLeftIcon, ArrowBendUpRightIcon, ClockIcon, TrashIcon } from "@phosphor-icons/react"

import { ExpandingButtonGroup } from "@/components/ui/expanding-button-group"

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export default function Demo() {
  return (
    <div className="flex flex-col items-center gap-6">
      <ExpandingButtonGroup
        label="Message actions"
        defaultExpanded="reply"
        items={[
          { id: "reply", label: "Reply", icon: <ArrowBendUpLeftIcon size={24} /> },
          { id: "forward", label: "Forward", icon: <ArrowBendUpRightIcon size={24} /> },
          { id: "archive", label: "Archive", doneLabel: "Archived", icon: <ArchiveIcon size={24} /> },
          { id: "snooze", label: "Snooze", doneLabel: "Snoozed", icon: <ClockIcon size={24} />, onSelect: () => wait(700) },
          { id: "delete", label: "Delete", doneLabel: "Deleted", tone: "danger", icon: <TrashIcon size={24} /> },
        ]}
      />
      <ExpandingButtonGroup
        label="Compact message actions"
        size="sm"
        items={[
          { id: "reply", label: "Reply", icon: <ArrowBendUpLeftIcon size={24} /> },
          { id: "archive", label: "Archive", doneLabel: "Archived", icon: <ArchiveIcon size={24} /> },
          { id: "delete", label: "Delete", doneLabel: "Deleted", tone: "danger", icon: <TrashIcon size={24} />, disabled: true },
        ]}
      />
    </div>
  )
}
