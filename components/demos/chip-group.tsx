"use client"

import { useState } from "react"

import { ChipGroup } from "@/components/ui/chip-group"

export default function Demo() {
  const [topics, setTopics] = useState<string[]>([])

  return (
    <div className="w-full max-w-96">
      <ChipGroup
        label="Topics"
        value={topics}
        onValueChange={setTopics}
        maxVisible={4}
        className="justify-center"
        options={["Design", "Motion", "Code", "Research", "Writing"].map(topic => ({ value: topic.toLowerCase(), label: topic }))}
      />
    </div>
  )
}
