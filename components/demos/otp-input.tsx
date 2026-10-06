"use client"

import { useState } from "react"

import { OtpInput } from "@/components/ui/otp-input"

const DEMO_CODE = "123456"

export default function Demo() {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")

  return (
    <div className="w-full max-w-sm">
      <OtpInput
        label="Verification code"
        description={`We sent a 6-digit code to your email. For this demo, it is ${DEMO_CODE}.`}
        value={code}
        error={error}
        onChange={(next) => {
          setCode(next)
          if (next.length < 6) {
            if (error) setError("")
            return
          }
          setError(next === DEMO_CODE ? "" : "That code didn't match. Try again.")
        }}
      />
    </div>
  )
}
