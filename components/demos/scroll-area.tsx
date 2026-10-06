"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { photo, type PhotoId } from "@/lib/media"

const activity = Array.from({ length: 24 }, (_, index) => ({
  id: index,
  text: [
    "Maya merged Checkout redesign",
    "Leo commented on Pricing page",
    "Priya deployed build 1,204",
    "Tomas opened an issue",
    "Ines updated the roadmap",
    "Jonas archived Tidewater",
  ][index % 6],
}))

const templates: PhotoId[] = ["lounge-chair", "table-lamp", "stacked-bowls", "ceramic-lamp", "sunroom", "wine-bar"]

export default function Demo() {
  return (
    <div className="grid w-full max-w-md gap-8">
      <ScrollArea
        maxHeight={240}
        label="Recent activity"
        className="rounded-panel border border-border bg-surface"
        viewportClassName="p-2"
      >
        <ul className="m-0 grid list-none gap-0.5 p-0">
          {activity.map(item => (
            <li key={item.id} className="rounded-control px-3 py-2 text-sm text-text-secondary">
              {item.text}
            </li>
          ))}
        </ul>
      </ScrollArea>
      <ScrollArea orientation="horizontal" snap="x mandatory" label="Templates" fade={24}>
        <div className="flex gap-3 pb-3">
          {templates.map(id => {
            const image = photo(id)
            return (
              <div key={id} className="aspect-[4/5] w-36 flex-none snap-start overflow-hidden rounded-control bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- plain img keeps the demo framework agnostic */}
                <img src={image.src} alt={image.alt} draggable={false} className="size-full object-cover" />
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
