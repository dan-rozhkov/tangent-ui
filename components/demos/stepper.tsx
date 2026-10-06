"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Stepper } from "@/components/ui/stepper"

const steps = [
  { id: "cart", label: "Cart" },
  { id: "shipping", label: "Shipping", description: "Address and delivery" },
  { id: "payment", label: "Payment", description: "Card details" },
  { id: "review", label: "Review" },
]

export default function Demo() {
  const [step, setStep] = useState(1)

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <Stepper current={step} onStepSelect={setStep} steps={steps} />
      <div className="flex items-center justify-center gap-2">
        <Button size="sm" variant="secondary" disabled={step <= 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>
          Back
        </Button>
        <Button size="sm" disabled={step >= steps.length} onClick={() => setStep((value) => Math.min(steps.length, value + 1))}>
          {step >= steps.length - 1 ? (step >= steps.length ? "Done" : "Finish") : "Continue"}
        </Button>
      </div>
    </div>
  )
}
