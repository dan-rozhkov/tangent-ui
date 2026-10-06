"use client"

import { useState } from "react"

import { Textarea } from "@/components/ui/textarea"

export default function Demo() {
  const [bio, setBio] = useState("")
  const left = 280 - bio.length

  return (
    <div className="grid w-full max-w-96 gap-6">
      <Textarea
        label="Bio"
        rows={4}
        placeholder="A few words about you"
        value={bio}
        onChange={event => setBio(event.target.value)}
        description={`${left} characters left`}
        error={left < 0 ? `Remove ${-left} characters` : undefined}
      />
      <Textarea label="Notes" placeholder="Read only for now" disabled />
    </div>
  )
}
