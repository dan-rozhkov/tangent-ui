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
    <div className="flex h-[340px] w-full flex-col items-center gap-4 pt-10">
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
  )
}
