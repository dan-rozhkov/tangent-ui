"use client"

import { useState } from "react"

import { PhoneInput } from "@/components/ui/phone-input"

export default function Demo() {
  const [phone, setPhone] = useState("")
  const [valid, setValid] = useState(false)

  return (
    <div className="grid w-full max-w-sm gap-6">
      <PhoneInput
        label="Phone number"
        name="phone"
        value={phone}
        onValueChange={(value, details) => {
          setPhone(value)
          setValid(details.valid)
        }}
        defaultCountry="GB"
        preferredCountries={["GB", "IE", "US"]}
        description={valid ? undefined : "We only text about your order"}
      />
    </div>
  )
}
