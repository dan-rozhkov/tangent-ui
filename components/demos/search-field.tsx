"use client"

import { useState } from "react"

import { SearchField } from "@/components/ui/search-field"

export default function Demo() {
  const [query, setQuery] = useState("")

  return (
    <div className="w-full max-w-80">
      <SearchField label="Search" placeholder="Search components" value={query} onValueChange={setQuery} />
    </div>
  )
}
