"use client"

import { useState } from "react"
import { CalendarPlus, CheckSquare, StickyNote } from "lucide-react"

import { ActionMorph, type ActionMorphSubmission } from "@/components/ui/action-morph"

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default function Demo() {
  const [log, setLog] = useState<ActionMorphSubmission[]>([])

  return (
    <div className="relative h-[400px] w-full max-w-[680px] overflow-hidden rounded-surface border border-border bg-surface">
      <div className="flex flex-col gap-2 p-5">
        <span className="text-sm font-medium">Today</span>
        {log.length === 0 ? (
          <p className="text-sm text-text-muted">Press the plus to add a task, note, or event.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {log.map((entry, index) => (
              <li key={index} className="flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-2 text-sm">
                <span className="text-text-muted capitalize">{entry.action}</span>
                <span className="min-w-0 flex-1 truncate">{entry.text}</span>
                {entry.choice && <span className="text-xs text-text-muted">{entry.choice}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ActionMorph
        className="absolute right-6 bottom-6"
        label="Create"
        actions={[
          {
            id: "task",
            label: "New task",
            description: "Add to your list",
            icon: <CheckSquare strokeWidth={1.75} />,
            shortcut: "t",
            composer: {
              title: "New task",
              placeholder: "What needs doing?",
              choices: { label: "Due", options: ["Today", "Tomorrow", "Next week"] },
              submitLabel: "Add",
              successLabel: "Task added",
            },
          },
          {
            id: "note",
            label: "New note",
            description: "Jot something down",
            icon: <StickyNote strokeWidth={1.75} />,
            shortcut: "n",
            composer: { title: "New note", placeholder: "Write a note", multiline: true, submitLabel: "Save", successLabel: "Note saved" },
          },
          {
            id: "event",
            label: "New event",
            description: "Block time on your calendar",
            icon: <CalendarPlus strokeWidth={1.75} />,
            shortcut: "e",
            composer: {
              title: "New event",
              placeholder: "Event name",
              choices: { label: "When", options: ["Morning", "Afternoon", "Evening"] },
              submitLabel: "Add",
              successLabel: "Event added",
              emptyHint: "Give the event a name.",
            },
          },
        ]}
        onSubmit={async submission => {
          await wait(700)
          setLog(entries => [submission, ...entries].slice(0, 5))
        }}
      />
    </div>
  )
}
