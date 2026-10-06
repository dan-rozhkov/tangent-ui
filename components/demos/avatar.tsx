"use client"

import { useState } from "react"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { avatar } from "@/lib/media"

export default function Demo() {
  const [online, setOnline] = useState(true)

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Avatar name="Emma Collins" src={avatar("emma-collins")} size="sm" />
        <Avatar name="Marcus Johnson" src={avatar("marcus-johnson")} />
        <Avatar name="Jasmine Brooks" src={avatar("jasmine-brooks")} size="lg" status="online" />
        <Avatar name="Olivia Bennett" src={avatar("olivia-bennett")} size="xl" status={online ? "online" : "offline"} />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Avatar name="Sofia Ramirez" size="sm" />
        <Avatar name="Ryan Sullivan" status="offline" />
        <Avatar name="Hannah Walsh" size="lg" />
        <Avatar name="Missing Photo" src="/media/people/missing.jpg" size="lg" />
      </div>
      <Button size="sm" variant="secondary" onClick={() => setOnline(value => !value)}>
        {online ? "Go offline" : "Go online"}
      </Button>
    </div>
  )
}
