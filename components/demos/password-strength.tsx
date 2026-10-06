"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { PasswordStrength } from "@/components/ui/password-strength"

export default function Demo() {
  const [level, setLevel] = useState(0)

  return (
    <form className="grid w-full max-w-80 gap-4" onSubmit={event => event.preventDefault()}>
      <PasswordStrength
        label="New password"
        name="password"
        autoComplete="new-password"
        onValueChange={(_, strength) => setLevel(strength.level)}
      />
      <Button type="submit" disabled={level < 3}>
        Create account
      </Button>
    </form>
  )
}
