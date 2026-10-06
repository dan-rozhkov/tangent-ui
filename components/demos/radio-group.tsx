"use client"

import { useState } from "react"

import { RadioGroup } from "@/components/ui/radio-group"

export default function Demo() {
  const [plan, setPlan] = useState("team")

  return (
    <div className="w-full max-w-80">
      <RadioGroup
        label="Plan"
        name="plan"
        value={plan}
        onValueChange={setPlan}
        options={[
          { value: "solo", label: "Solo", description: "One seat" },
          { value: "team", label: "Team", description: "Up to 20 seats" },
          { value: "enterprise", label: "Enterprise", description: "Unlimited seats and single sign-on" },
        ]}
      />
    </div>
  )
}
