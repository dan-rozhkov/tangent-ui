"use client"

import { useState } from "react"

import { DateScrubber } from "@/components/ui/date-scrubber"
import { useToday } from "@/lib/date"

const heading = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" })
const keyOf = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

const DEFAULT_ENTRIES = ["Morning run", "Review the draft"]

export default function Demo() {
  // Null on the server and during hydration, so a static build never bakes in its build date.
  const today = useToday()
  const [picked, setPicked] = useState<Date | null>(null)
  const [entries, setEntries] = useState<Record<string, string[]>>({})
  const date = picked ?? today ?? null
  const list = (date && entries[keyOf(date)]) || DEFAULT_ENTRIES

  return (
    <div className="relative h-[400px] w-full max-w-[680px] overflow-hidden rounded-surface border border-border bg-surface">
      <div className="flex flex-col gap-2 p-5">
        <span className="min-h-5 text-sm font-medium">{date ? heading.format(date) : null}</span>
        <ul className="flex flex-col gap-1.5">
          {list.map((item, index) => (
            <li key={index} className="rounded-control border border-border bg-surface px-3 py-2 text-sm">
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
        <DateScrubber
          value={date ?? undefined}
          onValueChange={setPicked}
          onAdd={added =>
            setEntries(all => {
              const current = all[keyOf(added)] ?? DEFAULT_ENTRIES
              return { ...all, [keyOf(added)]: [...current, `New entry ${current.length - DEFAULT_ENTRIES.length + 1}`] }
            })
          }
        />
      </div>
    </div>
  )
}
