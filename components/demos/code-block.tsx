"use client"

import { CodeBlock } from "@/components/ui/code-block"

const snippet = `import { useState } from "react"

type Filter = { id: string; label: string; value?: string }

export function useFilters(initial: Filter[] = []) {
  const [filters, setFilters] = useState(initial)

  // One chip per field: a second pick replaces the first.
  const add = (filter: Filter) =>
    setFilters(current => [...current.filter(item => item.id !== filter.id), filter])

  const remove = (id: string) =>
    setFilters(current => current.filter(item => item.id !== id))

  return { filters, add, remove, clear: () => setFilters([]) }
}
`

export default function Demo() {
  return (
    <div className="w-full max-w-2xl">
      <CodeBlock code={snippet} filename="use-filters.ts" language="ts" maxLines={10} />
    </div>
  )
}
