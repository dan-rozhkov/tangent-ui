"use client"

import { useState } from "react"

import { MentionInput, serializeMentions, type MentionValue } from "@/components/ui/mention-input"

const people = [
  { id: "u1", name: "Maya Chen", role: "Design lead" },
  { id: "u2", name: "Theo Park", role: "Engineer" },
  { id: "u3", name: "Ines Moreau", role: "Product manager" },
  { id: "u4", name: "Jonas Weber", role: "Engineer" },
]
const channels = [
  { id: "c1", name: "launch", description: "Release planning", members: 14 },
  { id: "c2", name: "design", description: "Critiques and reviews", members: 9 },
]

export default function Demo() {
  const [value, setValue] = useState<MentionValue>({ text: "", mentions: [] })
  const [posts, setPosts] = useState<string[]>([])

  return (
    <div className="grid w-full max-w-md gap-4">
      <MentionInput
        aria-label="Comment"
        placeholder="Write a comment, @ to mention"
        people={people}
        channels={channels}
        value={value}
        onChange={setValue}
        submitOnEnter
        onSubmit={next => {
          setPosts(current => [...current, serializeMentions(next)])
          setValue({ text: "", mentions: [] })
        }}
      />
      {posts.length > 0 && (
        <ul className="grid gap-1.5 text-(length:--text-xs) text-text-secondary">
          {posts.map((post, index) => (
            <li key={index} className="font-mono wrap-break-word">
              {post}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
