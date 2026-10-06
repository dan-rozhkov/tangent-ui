"use client"

import { useState } from "react"

import { Input } from "@/components/ui/input"

export default function Demo() {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("Ada Lovelace")

  return (
    <div className="grid w-full max-w-80 gap-6">
      <Input
        label="Email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={event => setEmail(event.target.value)}
        description="We only use this for receipts."
        error={email && !email.includes("@") ? "Enter a valid email" : undefined}
      />
      <Input
        label="Display name"
        value={name}
        maxLength={32}
        onChange={event => setName(event.target.value)}
        description={`${32 - name.length} characters left`}
      />
      <Input label="Workspace URL" defaultValue="arc.example.com" disabled />
    </div>
  )
}
