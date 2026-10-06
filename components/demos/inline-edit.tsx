"use client"

import { useState } from "react"

import { InlineEdit } from "@/components/ui/inline-edit"

export default function Demo() {
  const [name, setName] = useState("Atlas redesign")

  return (
    <div className="w-full max-w-80">
      <InlineEdit
        as="h1"
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
