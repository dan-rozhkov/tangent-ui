"use client"

import { useState } from "react"
import { Copy, FolderPlus, Heart, Send, Trash } from "@mynaui/icons-react"

import { OrbitMenu } from "@/components/ui/orbit-menu"

const labels: Record<string, string> = {
  favorite: "Added to favorites",
  share: "Shared with Ryan",
  album: "Added to Fall trips",
  duplicate: "Duplicated",
  delete: "Deleted",
}

export default function Demo() {
  const [last, setLast] = useState<string | null>(null)

  return (
    <div className="flex h-[420px] w-full max-w-[720px] flex-col items-center justify-end gap-10 pb-16">
      <div className="w-full max-w-xs rounded-panel border border-border bg-surface p-5 shadow-resting">
        <p className="text-sm font-medium">Golden hour, Lake Tahoe</p>
        <p className="mt-1 text-sm text-text-secondary">
          {last ? `Last action: ${labels[last]}` : "Hold the button, drag to an action, release."}
        </p>
      </div>
      <OrbitMenu
        label="Photo actions"
        onAction={setLast}
        actions={[
          { id: "favorite", label: "Favorite", icon: <Heart />, done: "Added to favorites" },
          { id: "share", label: "Share with Ryan", icon: <Send />, done: "Shared with Ryan" },
          { id: "album", label: "Add to album", icon: <FolderPlus />, done: "Added to Fall trips" },
          { id: "duplicate", label: "Duplicate", icon: <Copy />, done: "Duplicated" },
          { id: "delete", label: "Delete", icon: <Trash />, tone: "danger", done: "Deleted" },
        ]}
      />
    </div>
  )
}
