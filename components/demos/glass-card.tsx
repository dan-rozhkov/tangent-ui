"use client"

import { useState } from "react"
import { Star } from "lucide-react"

import { GlassCard } from "@/components/ui/glass-card"
import { avatar } from "@/lib/media"
import { cn } from "@/lib/utils"

const action =
  "inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-control border-0 px-4 text-sm leading-5 font-medium outline-none [transition:scale_.16s_var(--ease-standard),background-color_.24s_var(--ease-standard),color_.24s_var(--ease-standard)] active:scale-[.97] motion-reduce:transition-none"

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs leading-[1.4] text-text-muted">{label}</dt>
      <dd className="m-0 text-base leading-[1.4] font-medium text-foreground tabular-nums">{value}</dd>
    </div>
  )
}

export default function Demo() {
  const [following, setFollowing] = useState(false)

  return (
    <div className="flex w-full justify-center">
      <GlassCard
        className="w-[min(100%,360px)]"
        image={avatar("jasmine-brooks")}
        imageAlt="Portrait of Jasmine Brooks"
        title="Jasmine Brooks"
        subtitle="Design lead, Lisbon"
        aside={
          <>
            <Star aria-hidden="true" size={14} strokeWidth={1.75} className="fill-accent text-accent" />
            <span>
              <span className="sr-only">Rated </span>
              4.9
            </span>
          </>
        }
      >
        <p className="m-0">Leads design systems at Meridian. Mentors on motion, type, and shipping small teams fast.</p>
        <dl className="m-0 mt-3 grid grid-cols-3 gap-2">
          <Stat value="128" label="Sessions" />
          <Stat value="12.4k" label="Followers" />
          <Stat value="2 h" label="Replies in" />
        </dl>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            aria-pressed={following}
            className={cn(action, "bg-accent text-accent-foreground")}
            onClick={() => setFollowing((value) => !value)}
          >
            {following ? "Following" : "Follow"}
          </button>
          <button type="button" className={cn(action, "bg-foreground/8 text-foreground")}>
            Book a session
          </button>
        </div>
      </GlassCard>
    </div>
  )
}
