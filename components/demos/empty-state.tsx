"use client"

import { useState } from "react"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

export default function Demo() {
  const [cleared, setCleared] = useState(false)

  return (
    <div className="w-full max-w-sm">
      <EmptyState
        icon={cleared ? undefined : <Search size={24} />}
        title={cleared ? "Nothing here yet" : "No matches"}
        description={cleared ? "Create a project to get started." : "Try a shorter search or clear the filters."}
        action={
          <Button variant="secondary" onClick={() => setCleared((value) => !value)}>
            {cleared ? "Search again" : "Clear filters"}
          </Button>
        }
      />
    </div>
  )
}
