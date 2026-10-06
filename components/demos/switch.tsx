"use client"

import { useState } from "react"

import { Switch } from "@/components/ui/switch"

export default function Demo() {
  const [notifications, setNotifications] = useState(true)

  return (
    <div className="grid gap-2">
      <Switch label="Notifications" checked={notifications} onCheckedChange={setNotifications} />
      <Switch label="Autoplay previews" />
      <Switch label="Beta features" defaultChecked disabled />
    </div>
  )
}
