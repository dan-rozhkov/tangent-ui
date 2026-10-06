"use client"

import { Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/ui/glass-card"
import { avatar, photo } from "@/lib/media"

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-base leading-6 font-medium text-foreground tabular-nums">{value}</span>
      <span className="text-xs leading-4">{label}</span>
    </div>
  )
}

const rating = (value: string) => (
  <>
    <Star aria-hidden="true" size={14} strokeWidth={1.75} className="fill-accent text-accent" />
    <span>
      <span className="sr-only">Rated </span>
      {value}
    </span>
  </>
)

export default function Demo() {
  return (
    <div className="grid w-full max-w-[720px] grid-cols-1 justify-items-center gap-6 sm:grid-cols-2">
      <GlassCard
        className="w-[min(100%,300px)]"
        image={avatar("jasmine-brooks")}
        imageAlt="Portrait of Jasmine Brooks"
        title="Jasmine Brooks"
        subtitle="Design lead, Lisbon"
        aside={rating("4.9")}
      >
        <p className="m-0">Leads design systems at Meridian and hosts a monthly critique.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat value="128" label="Sessions" />
          <Stat value="2.4k" label="Followers" />
          <Stat value="9 yrs" label="Hosting" />
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" className="flex-1">
            Follow
          </Button>
          <Button size="sm" variant="secondary" className="flex-1">
            Message
          </Button>
        </div>
      </GlassCard>
      <GlassCard
        className="w-[min(100%,300px)]"
        image={photo("pool-house").src}
        imageAlt={photo("pool-house").alt}
        title="Glass house"
        subtitle="Palm Springs, 3 nights"
        aside="$420"
        defaultOpen
      >
        <p className="m-0">A quiet modern house beside a long pool, ten minutes from town.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat value="4" label="Guests" />
          <Stat value="2" label="Bedrooms" />
          <Stat value="4.8" label="Rating" />
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" className="flex-1">
            Reserve
          </Button>
        </div>
      </GlassCard>
    </div>
  )
}
