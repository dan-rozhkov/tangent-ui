"use client"

import { useState } from "react"
import { Calendar, Clock3, Copy, Pencil, Share, Sort, Trash, TypeText } from "@mynaui/icons-react"

import { DropdownMenu } from "@/components/ui/dropdown-menu"

const sorts = [
  { label: "Newest first", icon: <Clock3 size={15} /> },
  { label: "Last edited", icon: <Calendar size={15} /> },
  { label: "Alphabetical", icon: <TypeText size={15} /> },
]

export default function Demo() {
  const [sort, setSort] = useState(sorts[0].label)

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <DropdownMenu
        label={sort}
        icon={<Sort size={15} />}
        items={sorts.map(option => ({ ...option, onSelect: () => setSort(option.label) }))}
      />
      <DropdownMenu
        label="Actions"
        items={[
          { label: "Rename", icon: <Pencil size={15} /> },
          { label: "Duplicate", icon: <Copy size={15} /> },
          { label: "Share", icon: <Share size={15} />, disabled: true },
          { label: "Delete", icon: <Trash size={15} />, destructive: true, separatorBefore: true },
        ]}
      />
    </div>
  )
}
