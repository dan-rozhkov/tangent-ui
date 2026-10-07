"use client"

import { useState } from "react"
import { FileText, Folder } from "@mynaui/icons-react"

import { ExpandingSearch, type ExpandingSearchItem } from "@/components/ui/expanding-search"

const items: ExpandingSearchItem[] = [
  { id: "p1", title: "Tangent website", group: "Projects", meta: "Updated today", icon: <Folder size={16} /> },
  { id: "p2", title: "Mobile app", group: "Projects", meta: "Updated yesterday", icon: <Folder size={16} /> },
  { id: "p3", title: "Design system", group: "Projects", meta: "Updated last week", icon: <Folder size={16} /> },
  { id: "d1", title: "Motion tokens", group: "Docs", meta: "Springs, durations, blur", keywords: ["spring"], icon: <FileText size={16} /> },
  { id: "d2", title: "Color tokens", group: "Docs", meta: "Light and dark palettes", icon: <FileText size={16} /> },
  { id: "d3", title: "Release notes", group: "Docs", meta: "What changed this month", icon: <FileText size={16} /> },
]

export default function Demo() {
  const [chosen, setChosen] = useState<string | null>(null)

  return (
    <div className="grid w-full max-w-[360px] gap-3">
      <div className="flex w-full justify-end">
        <ExpandingSearch
          label="Search projects and docs"
          items={items}
          suggestions={[items[0], items[3]]}
          onSelect={item => setChosen(item.title)}
        />
      </div>
      <p className="m-0 text-sm text-text-muted">{chosen ? `Opened ${chosen}` : "Nothing opened yet"}</p>
    </div>
  )
}
