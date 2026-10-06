"use client"

import { useState } from "react"

import { AvatarGroup, type AvatarGroupMember } from "@/components/ui/avatar-group"
import { Button } from "@/components/ui/button"
import { peopleSample } from "@/lib/media"

const everyone: AvatarGroupMember[] = peopleSample(8).map((person, index) => ({
  name: person.name,
  src: person.src,
  status: index === 0 ? "online" : undefined,
}))

export default function Demo() {
  const [count, setCount] = useState(6)

  return (
    <div className="flex flex-col items-center gap-8">
      <AvatarGroup members={everyone.slice(0, count)} max={4} label="Editors" />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={count <= 1} onClick={() => setCount(value => value - 1)}>
          Remove person
        </Button>
        <Button size="sm" variant="secondary" disabled={count >= everyone.length} onClick={() => setCount(value => value + 1)}>
          Add person
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-8">
        <AvatarGroup members={everyone.slice(0, 5)} max={3} size="sm" />
        <AvatarGroup members={everyone.slice(2, 5)} size="lg" label="Reviewers" />
      </div>
    </div>
  )
}
