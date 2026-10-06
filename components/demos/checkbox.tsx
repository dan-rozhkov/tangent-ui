"use client"

import { useState } from "react"

import { Checkbox, type CheckedState } from "@/components/ui/checkbox"

const items = ["Comments", "Mentions", "Weekly digest"]

export default function Demo() {
  const [accepted, setAccepted] = useState(false)
  const [picked, setPicked] = useState<string[]>(["Mentions"])
  const parent: CheckedState = picked.length === items.length ? true : picked.length ? "indeterminate" : false

  return (
    <div className="grid gap-6">
      <Checkbox
        label="I agree to the terms"
        description="You can export your data at any time."
        checked={accepted}
        onCheckedChange={next => setAccepted(next === true)}
      />
      <div className="grid">
        <Checkbox label="All notifications" checked={parent} onCheckedChange={next => setPicked(next === true ? items : [])} />
        <div className="grid pl-6">
          {items.map(item => (
            <Checkbox
              key={item}
              label={item}
              checked={picked.includes(item)}
              onCheckedChange={next => setPicked(current => (next === true ? [...current, item] : current.filter(value => value !== item)))}
            />
          ))}
        </div>
      </div>
      <Checkbox label="Locked option" defaultChecked disabled />
    </div>
  )
}
