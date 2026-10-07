"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { CalendarBlankIcon } from "@phosphor-icons/react"

import { Checkbox } from "@/components/ui/checkbox"
import { TaskInput, formatDueLabel, type TaskInputList, type TaskInputTask } from "@/components/ui/task-input"
import { motionTokens } from "@/lib/motion-tokens"
import { useReducedMotion } from "@/lib/reduced-motion"

const lists: TaskInputList[] = [
  { id: "inbox", label: "Inbox", color: "var(--series-1)" },
  { id: "personal", label: "Personal", color: "var(--series-2)" },
  { id: "work", label: "Work", color: "var(--series-3)" },
  { id: "errands", label: "Errands", color: "var(--series-4)" },
]

interface Item {
  id: number
  title: string
  due: string | null
  list: string | null
  done: boolean
}

const seed: Item[] = [
  { id: 3, title: "Review the pricing page copy", due: "Today", list: "work", done: false },
  { id: 2, title: "Book a dentist appointment", due: "Fri", list: "personal", done: false },
  { id: 1, title: "Pick up the parcel", due: null, list: "errands", done: true },
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
  const [items, setItems] = useState(seed)
  const [next, setNext] = useState(4)

  const add = ({ title, date, list }: TaskInputTask) => {
    setItems(all => [{ id: next, title, due: date ? formatDueLabel(date) : null, list, done: false }, ...all])
    setNext(id => id + 1)
  }

  return (
    <div className="w-full max-w-[520px]">
      <TaskInput lists={lists} onSubmit={add} />
      <p className="mt-3 px-1 text-xs text-text-muted">Try “Send email to Ana tomorrow #work”.</p>
      <ul className="mt-3 flex h-[8.25rem] flex-col gap-1 overflow-y-auto p-1" aria-label="Tasks">
        <AnimatePresence initial={false}>
          {items.map(item => {
            const list = lists.find(entry => entry.id === item.list)
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
                  onCheckedChange={checked => setItems(all => all.map(entry => (entry.id === item.id ? { ...entry, done: checked === true } : entry)))}
                />
                <div className="min-w-0 flex-1">
                  <Strike done={item.done}>{item.title}</Strike>
                </div>
                <div className={`flex flex-none items-center gap-1.5 transition-opacity duration-200 motion-reduce:transition-none ${item.done ? "opacity-50" : ""}`}>
                  {item.due && (
                    <span className={chip}>
                      <CalendarBlankIcon className="size-3" aria-hidden="true" />
                      {item.due}
                    </span>
                  )}
                  {list && (
                    <span className={chip}>
                      <span className="size-2 rounded-full bg-(--dot)" style={{ "--dot": list.color } as React.CSSProperties} aria-hidden="true" />
                      {list.label}
                    </span>
                  )}
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
    </div>
  )
}
