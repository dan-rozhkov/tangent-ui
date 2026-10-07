"use client"

import { useState } from "react"

import { InlineEdit } from "@/components/ui/inline-edit"

export default function Demo() {
  const [name, setName] = useState("Atlas redesign")

  return (
    // The component reserves room for its action slot to the right of the text. The demo drops that room, so the text
    // itself rests at the centre and the slot (save, saved, retry) hangs out to its right while editing.
    <div className="flex max-w-full justify-center">
      <InlineEdit
        as="h1"
        className="[&>h1]:pe-0"
        label="Project name"
        value={name}
        validate={next => (next.trim() ? null : "Name can’t be empty")}
        onSave={next =>
          new Promise<void>(resolve =>
            window.setTimeout(() => {
              setName(next)
              resolve()
            }, 700)
          )
        }
      />
    </div>
  )
}
