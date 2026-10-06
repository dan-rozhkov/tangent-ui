"use client"

import { useState } from "react"

import { Breadcrumb } from "@/components/ui/breadcrumb"

const trail = ["Workspace", "Settings", "Billing", "Invoices"]

export default function Demo() {
  const [depth, setDepth] = useState(3)
  // Crumbs that live in local state render as buttons: choosing one trims the path back to it.
  const items = trail.slice(0, depth).map((label, index) => ({ label, onClick: () => setDepth(index + 1) }))

  return (
    <div className="flex flex-col items-center gap-4">
      <Breadcrumb items={items} />
      <button
        type="button"
        className="cursor-pointer text-sm text-text-secondary underline decoration-border-strong underline-offset-4 pointer-fine:hover:text-foreground"
        onClick={() => setDepth((value) => (value >= trail.length ? 2 : value + 1))}
      >
        {depth >= trail.length ? "Go up" : "Go deeper"}
      </button>
    </div>
  )
}
