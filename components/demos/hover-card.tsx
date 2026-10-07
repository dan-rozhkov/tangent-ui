"use client"

import { MapPin } from "@mynaui/icons-react"

import { HoverCard, HoverCardProfile } from "@/components/ui/hover-card"

const mention =
  "cursor-pointer rounded-[6px] bg-accent-subtle px-1 font-medium text-accent-strong outline-none"

export default function Demo() {
  return (
    <p className="m-0 max-w-md text-sm leading-body text-text-secondary">
      The checkout redesign is led by{" "}
      <HoverCard
        content={
          <HoverCardProfile
            name="Maya Chen"
            role="Product designer, Payments"
            bio="Designs the checkout and billing flows. Previously led the mobile wallet."
            stats={[
              { label: "Projects", value: 12 },
              { label: "Reviews", value: 48 },
            ]}
            meta={
              <>
                <MapPin size={12} strokeWidth={1.75} aria-hidden="true" />
                Zurich, 14:20 local time
              </>
            }
          />
        }
      >
        <button type="button" className={mention}>
          @maya
        </button>
      </HoverCard>{" "}
      with research from{" "}
      <HoverCard
        side="top"
        content={<HoverCardProfile name="Jonas Weber" role="Researcher, Growth" stats={[{ label: "Studies", value: 7 }]} />}
      >
        <button type="button" className={mention}>
          @jonas
        </button>
      </HoverCard>
      .
    </p>
  )
}
