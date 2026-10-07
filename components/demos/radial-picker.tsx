"use client"

import { useState } from "react"
import { CopyIcon, FolderPlusIcon, HeartIcon, PaperPlaneTiltIcon, TrashIcon } from "@phosphor-icons/react"

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
    // The actions fan out above the button, so the group keeps the same room above and below it.
    <div className="flex w-full max-w-xs flex-col items-center gap-8 py-24">
      <OrbitMenu
        label="Photo actions"
        onAction={setLast}
        actions={[
          { id: "favorite", label: "Favorite", icon: <HeartIcon size={24} />, done: "Added to favorites" },
          { id: "share", label: "Share with Ryan", icon: <PaperPlaneTiltIcon size={24} />, done: "Shared with Ryan" },
          { id: "album", label: "Add to album", icon: <FolderPlusIcon size={24} />, done: "Added to Fall trips" },
          { id: "duplicate", label: "Duplicate", icon: <CopyIcon size={24} />, done: "Duplicated" },
          { id: "delete", label: "Delete", icon: <TrashIcon size={24} />, tone: "danger", done: "Deleted" },
        ]}
      />
      <div className="w-full rounded-panel border border-border bg-surface p-5 shadow-resting">
        <p className="text-sm font-medium">Golden hour, Lake Tahoe</p>
        <p className="mt-1 text-sm text-text-secondary">
          {last ? `Last action: ${labels[last]}` : "Hold the button, drag to an action, release."}
        </p>
      </div>
    </div>
  )
}
