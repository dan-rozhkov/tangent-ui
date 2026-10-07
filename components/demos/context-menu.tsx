"use client"

import { useState } from "react"
import { Copy, Pencil, Star, Trash } from "@mynaui/icons-react"

import { ContextMenu } from "@/components/ui/context-menu"

export default function Demo() {
  const [starred, setStarred] = useState(false)
  const [status, setStatus] = useState("Right-click or press the menu key")

  return (
    <ContextMenu
      label="Project actions"
      items={[
        { id: "copy", label: "Copy link", icon: <Copy size={15} />, onSelect: () => setStatus("Link copied") },
        { id: "rename", label: "Rename", icon: <Pencil size={15} />, onSelect: () => setStatus("Renaming") },
        {
          id: "star",
          label: starred ? "Starred" : "Add star",
          icon: starred ? undefined : <Star size={15} />,
          checked: starred,
          onSelect: () => setStarred(value => !value),
        },
        { id: "archive", label: "Archive", disabled: true },
        { id: "delete", label: "Delete project", icon: <Trash size={15} />, destructive: true, onSelect: () => setStatus("Project deleted") },
      ]}
    >
      <div className="grid h-40 w-72 place-items-center rounded-panel border border-dashed border-border-strong bg-surface text-sm text-text-secondary">
        {status}
      </div>
    </ContextMenu>
  )
}
