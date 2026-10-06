"use client"

import { useState } from "react"

import { MoneyInput } from "@/components/ui/money-input"

export default function Demo() {
  const [cents, setCents] = useState<number | null>(1500)

  return (
    <div className="grid w-full max-w-sm gap-6">
      <MoneyInput
        label="Amount"
        name="amount"
        value={cents}
        onValueChange={setCents}
        currencies={["USD"]}
        min={100}
        max={100_000}
        quickAdd={[5, 10, 20]}
      />
      <MoneyInput label="Budget" defaultValue={250000} description="Pick a currency; the amount carries over." />
    </div>
  )
}
