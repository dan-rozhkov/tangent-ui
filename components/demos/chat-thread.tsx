"use client"

import { useEffect, useRef, useState } from "react"

import { ChatThread, type ChatAttachment, type ChatDraft, type ChatMessage } from "@/components/ui/chat-thread"
import { avatar, photo } from "@/lib/media"

const participants = [
  { id: "me", name: "Emma Collins", avatar: avatar("emma-collins") },
  { id: "marcus", name: "Marcus Johnson", avatar: avatar("marcus-johnson") },
  { id: "jasmine", name: "Jasmine Brooks", avatar: avatar("jasmine-brooks") },
]

const replies = [
  "Looks great. Shipping it after lunch.",
  "Love the new spacing on the cards.",
  "Can you send the export too?",
  "Perfect, thanks!",
]

/** Times are relative to now, so the day separators read Yesterday and Today. */
function seedMessages(): ChatMessage[] {
  const now = Date.now()
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000)
  const lamp = photo("desk-lamp")
  const chair = photo("cane-chair")
  return [
    { id: "m1", authorId: "marcus", text: "Morning! Did the new product shots come back?", createdAt: at(26 * 60) },
    {
      id: "m2",
      authorId: "jasmine",
      text: "They did. Uploading the picks now.",
      createdAt: at(26 * 60 - 2),
    },
    {
      id: "m3",
      authorId: "jasmine",
      createdAt: at(26 * 60 - 1),
      attachments: [
        { id: "a1", kind: "image", name: "desk-lamp.jpg", url: lamp.src, alt: lamp.alt, width: lamp.width, height: lamp.height },
        { id: "a2", kind: "image", name: "cane-chair.jpg", url: chair.src, alt: chair.alt },
      ],
      reactions: [{ emoji: "😍", count: 2 }],
    },
    { id: "m4", authorId: "me", text: "These are lovely. I will build the landing page around the lamp.", createdAt: at(18), status: "read" },
    {
      id: "m5",
      authorId: "marcus",
      text: "Here is the spec for the hero section.",
      createdAt: at(12),
      attachments: [{ id: "a3", kind: "file", name: "hero-spec.pdf", size: 482_000 }],
    },
    { id: "m6", authorId: "me", text: "Got it. First pass in an hour.", createdAt: at(4), status: "delivered", reactions: [{ emoji: "👍", count: 1 }] },
  ]
}

export default function Demo() {
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages)
  const [typing, setTyping] = useState<string[]>([])
  const [readBy, setReadBy] = useState<Record<string, string>>({ marcus: "m6", jasmine: "m4" })
  const timers = useRef<number[]>([])
  const count = useRef(0)
  useEffect(() => () => timers.current.forEach(timer => window.clearTimeout(timer)), [])

  function send(draft: ChatDraft) {
    const id = `local-${++count.current}`
    const attachments: ChatAttachment[] = draft.files.map((file, index) => ({
      id: `${id}-file-${index}`,
      name: file.name,
      size: file.size,
      kind: file.type.startsWith("image/") ? "image" : "file",
      url: URL.createObjectURL(file),
    }))
    setMessages(current => [
      ...current,
      { id, authorId: "me", text: draft.text || undefined, attachments, createdAt: new Date(), status: "sending" },
    ])
    // The message lands, Marcus reads it and starts typing, then answers.
    timers.current.push(
      window.setTimeout(() => setMessages(current => current.map(message => (message.id === id ? { ...message, status: "delivered" } : message))), 500),
      window.setTimeout(() => {
        setReadBy(current => ({ ...current, marcus: id }))
        setTyping(["marcus"])
      }, 1100),
      window.setTimeout(() => {
        setTyping([])
        setMessages(current => [
          ...current,
          {
            id: `${id}-reply`,
            authorId: "marcus",
            text: replies[(count.current - 1) % replies.length],
            createdAt: new Date(),
          },
        ])
      }, 2800),
    )
  }

  function react(messageId: string, emoji: string) {
    setMessages(current =>
      current.map(message => {
        if (message.id !== messageId) return message
        const list = [...(message.reactions ?? [])]
        const at = list.findIndex(entry => entry.emoji === emoji)
        if (at < 0) list.push({ emoji, count: 1, mine: true })
        else if (list[at].mine) list[at] = { ...list[at], count: list[at].count - 1, mine: false }
        else list[at] = { ...list[at], count: list[at].count + 1, mine: true }
        return { ...message, reactions: list.filter(entry => entry.count > 0) }
      }),
    )
  }

  return (
    <div className="h-[560px] w-full max-w-[460px] overflow-hidden rounded-panel border border-border bg-surface">
      <ChatThread
        participants={participants}
        currentUserId="me"
        messages={messages}
        typing={typing}
        readBy={readBy}
        onSend={send}
        onReact={react}
        accept="image/*,.pdf"
      />
    </div>
  )
}
