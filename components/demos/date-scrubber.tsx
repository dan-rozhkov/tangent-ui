"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"

import { Checkbox } from "@/components/ui/checkbox"
import { DateScrubber } from "@/components/ui/date-scrubber"
import { useToday } from "@/lib/date"
import { motionTokens } from "@/lib/motion-tokens"
import { useReducedMotion } from "@/lib/reduced-motion"

const heading = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" })
const keyOf = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

const lists = {
  personal: { label: "Personal", color: "var(--series-2)" },
  work: { label: "Work", color: "var(--series-3)" },
  inbox: { label: "Inbox", color: "var(--series-1)" },
}

interface Item {
  id: string
  title: string
  list: keyof typeof lists
  done: boolean
}

const DEFAULT_ITEMS: Item[] = [
  { id: "run", title: "Morning run", list: "personal", done: true },
  { id: "draft", title: "Review the draft", list: "work", done: false },
]

const chip = "inline-flex h-6 items-center gap-1.5 rounded-pill bg-surface-muted px-2 text-xs font-medium text-text-secondary"

function Strike({ done, children }: { done: boolean; children: string }) {
  const reduced = useReducedMotion()
  return (
    <span className="relative inline-block max-w-full align-top">
      <span className={`block truncate text-sm transition-colors duration-200 ease-standard motion-reduce:transition-none ${done ? "text-text-muted" : "text-foreground"}`}>
        {children}
      </span>
      <motion.span
        className="pointer-events-none absolute top-1/2 left-0 h-px w-full origin-left bg-text-muted"
        initial={false}
        animate={{ scaleX: done ? 1 : 0 }}
        transition={reduced ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
      />
    </span>
  )
}

export default function Demo() {
  const reduced = useReducedMotion()
  // Null on the server and during hydration, so a static build never bakes in its build date.
  const today = useToday()
  const [picked, setPicked] = useState<Date | null>(null)
  const [items, setItems] = useState<Record<string, Item[]>>({})
  const date = picked ?? today ?? null
  const dayKey = date ? keyOf(date) : null
  const list = (dayKey && items[dayKey]) || DEFAULT_ITEMS

  const update = (key: string, change: (current: Item[]) => Item[]) => setItems(all => ({ ...all, [key]: change(all[key] ?? DEFAULT_ITEMS) }))

  return (
    <div className="relative h-[400px] w-full max-w-[680px] overflow-hidden rounded-surface border border-border bg-surface">
      <div className="flex flex-col gap-2 p-5">
        <span className="min-h-5 px-1 text-sm font-medium">{date ? heading.format(date) : null}</span>
        <ul className="flex max-h-[13rem] flex-col gap-1 overflow-y-auto p-1" aria-label="Tasks">
          <AnimatePresence initial={false}>
            {list.map(item => {
              const tag = lists[item.list]
              return (
                <motion.li
                  key={item.id}
                  layout={reduced ? false : "position"}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: -18, filter: `blur(${motionTokens.blur.soft}px)` }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={reduced ? { duration: 0.12 } : { ...motionTokens.spring.morph, filter: { duration: 0.24 }, opacity: { duration: 0.2 } }}
                  className="flex flex-none items-center gap-1 rounded-control pr-3 pl-1"
                >
                  <Checkbox
                    aria-label={`Complete ${item.title}`}
                    checked={item.done}
                    onCheckedChange={checked => dayKey && update(dayKey, current => current.map(entry => (entry.id === item.id ? { ...entry, done: checked === true } : entry)))}
                  />
                  <div className="min-w-0 flex-1">
                    <Strike done={item.done}>{item.title}</Strike>
                  </div>
                  <span className={`${chip} flex-none transition-opacity duration-200 motion-reduce:transition-none ${item.done ? "opacity-50" : ""}`}>
                    <span className="size-2 rounded-full bg-(--dot)" style={{ "--dot": tag.color } as React.CSSProperties} aria-hidden="true" />
                    {tag.label}
                  </span>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      </div>
      <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
        <DateScrubber
          value={date ?? undefined}
          onValueChange={setPicked}
          onAdd={added =>
            update(keyOf(added), current => {
              const n = current.filter(entry => entry.list === "inbox").length + 1
              return [{ id: `new-${n}`, title: `New task ${n}`, list: "inbox", done: false }, ...current]
            })
          }
        />
      </div>
    </div>
  )
}
