"use client"

import { useState } from "react"

import { TagInput } from "@/components/ui/tag-input"

export default function Demo() {
  const [topics, setTopics] = useState(["design", "motion"])

  return (
    <div className="w-full max-w-80">
      <TagInput label="Topics" value={topics} onValueChange={setTopics} description="Press Enter or comma to add." />
    </div>
  )
}
