"use client"

import { useState } from "react"
import { BookmarkSimpleIcon, ReceiptIcon, UserPlusIcon } from "@phosphor-icons/react"

import { ComposeFab, type ComposeFabCreated } from "@/components/ui/compose-fab"

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default function Demo() {
  const [log, setLog] = useState<ComposeFabCreated[]>([])

  return (
    <div className="relative h-[400px] w-full max-w-[680px] overflow-hidden rounded-surface border border-border bg-surface">
      <div className="flex flex-col gap-2 p-5">
        <span className="text-sm font-medium">Inbox</span>
        {log.length === 0 ? (
          <p className="text-sm text-text-muted">Press the plus to log an expense, save a contact, or keep a link.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {log.map((item, index) => (
              <li key={index} className="flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-2 text-sm">
                <span className="text-text-muted capitalize">{item.entry}</span>
                <span className="min-w-0 flex-1 truncate">{item.text}</span>
                {item.chip && <span className="text-xs text-text-muted">{item.chip}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ComposeFab
        className="absolute right-6 bottom-6"
        label="Quick add"
        entries={[
          {
            id: "expense",
            label: "Log expense",
            hint: "Track what you spent",
            icon: <ReceiptIcon size={24} />,
            hotkey: "x",
            form: {
              title: "Log expense",
              placeholder: "What did you buy?",
              chips: { label: "Category", values: ["Food", "Travel", "Home"] },
              sendLabel: "Log",
              doneLabel: "Expense logged",
            },
          },
          {
            id: "contact",
            label: "Save contact",
            hint: "Keep someone's details",
            icon: <UserPlusIcon size={24} />,
            hotkey: "c",
            form: {
              title: "Save contact",
              placeholder: "Name and number",
              chips: { label: "Group", values: ["Family", "Work", "Other"] },
              sendLabel: "Save",
              doneLabel: "Contact saved",
              blankHint: "Enter a name first.",
            },
          },
          {
            id: "link",
            label: "Keep link",
            hint: "Read it later",
            icon: <BookmarkSimpleIcon size={24} />,
            hotkey: "l",
            form: { title: "Keep link", placeholder: "Paste a link or add a remark", multiline: true, sendLabel: "Keep", doneLabel: "Link kept" },
          },
        ]}
        onCreate={async created => {
          await wait(700)
          setLog(items => [created, ...items].slice(0, 5))
        }}
      />
    </div>
  )
}
