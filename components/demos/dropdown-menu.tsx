"use client"

import { useState } from "react"
import { ArrowsDownUpIcon, CalendarBlankIcon, ClockIcon, CopyIcon, PencilSimpleIcon, ShareNetworkIcon, TextTIcon, TrashIcon } from "@phosphor-icons/react"

import { DropdownMenu } from "@/components/ui/dropdown-menu"

const sorts = [
  { label: "Newest first", icon: <ClockIcon size={15} /> },
  { label: "Last edited", icon: <CalendarBlankIcon size={15} /> },
  { label: "Alphabetical", icon: <TextTIcon size={15} /> },
]

export default function Demo() {
  const [sort, setSort] = useState(sorts[0].label)

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <DropdownMenu
        label={sort}
        icon={<ArrowsDownUpIcon size={15} />}
        items={sorts.map(option => ({ ...option, onSelect: () => setSort(option.label) }))}
      />
      <DropdownMenu
        label="Actions"
        items={[
          { label: "Rename", icon: <PencilSimpleIcon size={15} /> },
          { label: "Duplicate", icon: <CopyIcon size={15} /> },
          { label: "Share", icon: <ShareNetworkIcon size={15} />, disabled: true },
          { label: "Delete", icon: <TrashIcon size={15} />, destructive: true, separatorBefore: true },
        ]}
      />
    </div>
  )
}
