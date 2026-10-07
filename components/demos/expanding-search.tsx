"use client"

import { useState, type CSSProperties } from "react"
import { FileTextIcon, FolderIcon } from "@phosphor-icons/react"

import { ExpandingSearch, type ExpandingSearchItem } from "@/components/ui/expanding-search"

const items: ExpandingSearchItem[] = [
  { id: "p1", title: "Tangent website", group: "Projects", meta: "Updated today", icon: <FolderIcon size={16} /> },
  { id: "p2", title: "Mobile app", group: "Projects", meta: "Updated yesterday", icon: <FolderIcon size={16} /> },
  { id: "p3", title: "Design system", group: "Projects", meta: "Updated last week", icon: <FolderIcon size={16} /> },
  { id: "d1", title: "Motion tokens", group: "Docs", meta: "Springs, durations, blur", keywords: ["spring"], icon: <FileTextIcon size={16} /> },
  { id: "d2", title: "Color tokens", group: "Docs", meta: "Light and dark palettes", icon: <FileTextIcon size={16} /> },
  { id: "d3", title: "Release notes", group: "Docs", meta: "What changed this month", icon: <FileTextIcon size={16} /> },
]

export default function Demo() {
  const [chosen, setChosen] = useState<string | null>(null)

  return (
    // The field grows to the right from the icon (anchor "start"), so the icon sits at the box's centre while the box is
    // wide enough for the field (a 44px button at the centre plus 360px to its right); on narrow screens it slides left
    // just far enough to keep the field inside. The results fall below, so the box reserves room under the centre.
    <div className="relative h-[30rem] w-full">
      <div
        className="absolute top-[calc(50%-1.375rem)] left-(--left) w-[calc(100%-var(--left))] max-w-[360px]"
        style={{ "--left": "max(0px, min(calc(50% - 1.375rem), calc(100% - 360px)))" } as CSSProperties}
      >
        <ExpandingSearch
          anchor="start"
          maxResults={3}
          label="Search projects and docs"
          items={items}
          suggestions={[items[0], items[3]]}
          onSelect={item => setChosen(item.title)}
        />
      </div>
      <p className="absolute inset-x-0 bottom-0 m-0 text-center text-sm text-text-muted">
        {chosen ? `Opened ${chosen}` : "Nothing opened yet"}
      </p>
    </div>
  )
}
