"use client"

import { useState } from "react"
import { CircleDot, Flag, Tag, User } from "lucide-react"

import { FilterToolbar, type FilterChip, type FilterField } from "@/components/ui/filter-toolbar"

const fields: FilterField[] = [
  { id: "status", label: "Status", icon: <CircleDot size={15} strokeWidth={1.8} />, options: [{ value: "Open", hint: 18 }, { value: "In review", hint: 7 }, { value: "Closed", hint: 41 }] },
  { id: "owner", label: "Owner", icon: <User size={15} strokeWidth={1.8} />, options: ["Maya", "Leo", "Priya", "Tomas"] },
  { id: "priority", label: "Priority", icon: <Flag size={15} strokeWidth={1.8} />, options: ["Urgent", "High", "Normal", "Low"] },
  { id: "label", label: "Label", icon: <Tag size={15} strokeWidth={1.8} />, options: ["Bug", "Design", "Billing", "Onboarding"] },
]

export default function Demo() {
  const [filters, setFilters] = useState<FilterChip[]>([
    { id: "status", label: "Status", value: "Open" },
    { id: "owner", label: "Owner", value: "Maya" },
  ])

  return (
    <div className="w-full max-w-3xl">
      <FilterToolbar
        filters={filters}
        onRemove={id => setFilters(current => current.filter(filter => filter.id !== id))}
        onClearAll={() => setFilters([])}
        addFilter={{
          fields,
          onAdd: chip => setFilters(current => [...current.filter(filter => filter.id !== chip.id), chip]),
        }}
      />
    </div>
  )
}
