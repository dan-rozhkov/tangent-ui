"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { avatar, photo } from "@/lib/media"

const room = photo("loft-living")
const gardenRoom = photo("plant-studio")
const updates = ["Updated just now", "Updated 1 minute ago", "Updated 2 minutes ago"]

export default function Demo() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setTick(value => (value + 1) % updates.length), 4000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="grid w-full max-w-2xl gap-5 sm:grid-cols-2">
      <Card
        title="Harbour redesign"
        description="New booking flow and room pages."
        media={<Image src={room.src} alt="" width={room.width} height={room.height} className="aspect-[4/3] w-full object-cover" />}
        avatar={<Avatar name="Emma Collins" src={avatar("emma-collins")} size="sm" />}
        meta="Emma Collins"
        status={updates[tick]}
        details={
          <div className="grid gap-3">
            <p>Scope: booking flow, room pages, and the confirmation email.</p>
            <p>Next milestone: usability test with ten returning guests on Friday.</p>
            <p>Open question: should deposits move to the final step?</p>
          </div>
        }
      />
      <Card
        title="Garden room launch"
        description="Spring campaign for the garden suites."
        media={<Image src={gardenRoom.src} alt="" width={gardenRoom.width} height={gardenRoom.height} className="aspect-[4/3] w-full object-cover" />}
        avatar={<Avatar name="Marcus Johnson" src={avatar("marcus-johnson")} size="sm" />}
        meta="Marcus Johnson"
        status="Due in 3 days"
        action={<Button size="sm" variant="secondary">Share</Button>}
      />
    </div>
  )
}
