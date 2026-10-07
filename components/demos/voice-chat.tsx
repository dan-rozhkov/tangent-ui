"use client"

import { useState } from "react"

import { VoiceChat, type VoiceChatParticipant } from "@/components/ui/voice-chat"
import { people } from "@/lib/media"

const participants: VoiceChatParticipant[] = people.slice(0, 7).map((person, index) => ({
  id: person.id,
  name: person.name,
  avatar: person.src,
  speaking: index === 0 || index === 5,
}))

export default function Demo() {
  const [joined, setJoined] = useState(false)

  return (
    // A fixed-height box with the pill at its centre: the card opens from the pill's centre, so it lands centred in the
    // box without changing the layout.
    <div className="relative h-[26rem] w-full">
      <div className="absolute inset-x-0 top-[calc(50%-24px)] in-data-showcase-tile:top-[calc(50%-32px)] flex flex-col items-center gap-4">
        <VoiceChat
          participants={participants}
          joinLabel={joined ? "Leave" : "Join Now"}
          caption={joined ? "You are in the call." : undefined}
          onJoin={() => setJoined(value => !value)}
        />
        <p className="text-sm text-text-muted" aria-live="polite">
          {joined ? "You joined the voice chat" : "You have not joined yet"}
        </p>
      </div>
    </div>
  )
}
