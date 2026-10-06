"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import Toast from "@/components/ui/toast"

export default function Demo() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col items-center gap-6">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Save
      </Button>
      <div className="flex min-h-20 w-full justify-center">
        <Toast open={open} onOpenChange={setOpen} title="Changes saved" description="Synced to all devices." />
      </div>
    </div>
  )
}
