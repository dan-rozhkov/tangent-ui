"use client"

import { useRef, useState } from "react"
import { CalendarBlankIcon, ChatCircleIcon, GearSixIcon, PlusIcon, SunIcon } from "@phosphor-icons/react"

import { FloatTabs } from "@/components/ui/float-tabs"
import { photos } from "@/lib/media"

const titles: Record<string, string> = {
  today: "Today",
  plan: "Plan",
  chats: "Chats",
  settings: "Settings",
  create: "New entry",
}

export default function Demo() {
  const [tab, setTab] = useState("today")
  const scrollRef = useRef<HTMLDivElement>(null)
  // Each tab shows the feed from a different starting photo, so the glass has new colors to bend.
  const offset = Object.keys(titles).indexOf(tab) * 5
  const feed = [...photos.slice(offset), ...photos.slice(0, offset)]

  return (
    <div className="relative h-[520px] w-full max-w-[720px] overflow-hidden rounded-[28px] border border-border bg-background">
      <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain">
        <div className="flex flex-col gap-3 p-4 pb-[110px]">
          <h2 className="px-1 pt-2 font-display text-2xl font-medium tracking-display">{titles[tab]}</h2>
          <div className="columns-2 gap-3 sm:columns-3">
            {feed.map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.id}
                src={photo.src}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                draggable={false}
                className="mb-3 w-full rounded-[18px] object-cover"
              />
            ))}
          </div>
        </div>
      </div>
      <FloatTabs
        className="absolute inset-x-0 bottom-[22px]"
        label="Main navigation"
        value={tab}
        onValueChange={(next) => {
          setTab(next)
          // A new section opens at its top, which also brings the bar back to full size.
          scrollRef.current?.scrollTo({ top: 0 })
        }}
        scrollRef={scrollRef}
        tabs={[
          { value: "today", label: "Today", icon: <SunIcon size={24} /> },
          { value: "plan", label: "Plan", icon: <CalendarBlankIcon size={24} /> },
          { value: "chats", label: "Chats", icon: <ChatCircleIcon size={24} />, unread: 4 },
          { value: "settings", label: "Settings", icon: <GearSixIcon size={24} /> },
        ]}
        trailing={{ value: "create", label: "New entry", icon: <PlusIcon size={24} /> }}
      />
    </div>
  )
}
