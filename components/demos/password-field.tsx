"use client"

import { PasswordField } from "@/components/ui/password-field"

export default function Demo() {
  return (
    <div className="w-full max-w-80">
      <PasswordField label="Password" placeholder="Enter your password" description="Use at least 12 characters." />
    </div>
  )
}
