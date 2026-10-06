"use client"

import { useState } from "react"

import { MultiSelect } from "@/components/ui/multi-select"

export default function Demo() {
  const [labels, setLabels] = useState<string[]>(["bug"])

  return (
    <div className="w-full max-w-80">
      <MultiSelect
        label="Labels"
        value={labels}
        onValueChange={setLabels}
        options={[
          { value: "bug", label: "Bug" },
          { value: "feature", label: "Feature" },
          { value: "docs", label: "Docs" },
        ]}
      />
    </div>
  )
}
