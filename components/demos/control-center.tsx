"use client"

/* eslint-disable @next/next/no-img-element -- demo photos are plain img tags. */

import { useState } from "react"
import { Briefcase, Moon, PenLine } from "lucide-react"

import { ControlCenter, type ControlCenterState } from "@/components/ui/control-center"
import { people as media, photo } from "@/lib/media"

const people = media.slice(0, 4).map(person => ({ id: person.id, name: person.name, avatar: person.src }))
const backdrop = photo("mountain-ridges")

export default function Demo() {
  const [state, setState] = useState<ControlCenterState | null>(null)
  return (
    <div className="@container relative flex h-[480px] w-[720px] max-w-full items-center justify-end overflow-hidden rounded-surface border border-border bg-surface p-6 max-sm:justify-center max-sm:p-3">
      <img src={backdrop.src} alt="" className="absolute inset-0 size-full object-cover opacity-80 dark:opacity-55" />
      <div className="absolute bottom-6 left-6 hidden w-[12.5rem] flex-col gap-1 rounded-panel bg-surface-raised/85 p-4 text-sm shadow-raised backdrop-blur-md @min-[640px]:flex">
        <span className="font-medium">Workspace</span>
        <span className="text-xs leading-body whitespace-pre-line text-text-secondary tabular-nums">
          {state
            ? [
                state.focus ? `Focus: ${state.focus.mode}, ${state.focus.minutes} min` : "No focus session",
                `Notifications ${state.notifications ? "on" : "off"}`,
                state.presenting ? "Presenting" : null,
                `Volume ${state.volume}%, text ${state.textSize}%`,
              ]
                .filter(Boolean)
                .join("\n")
            : "Change a setting to see the state"}
        </span>
      </div>
      <ControlCenter
        className="relative"
        focusModes={[
          { id: "deep", label: "Deep work", icon: Briefcase, description: "Silences everything but mentions", defaultMinutes: 50 },
          { id: "write", label: "Writing", icon: PenLine, description: "Holds chat, keeps calendar alerts", defaultMinutes: 25 },
          { id: "rest", label: "Rest", icon: Moon, description: "Silences all alerts", defaultMinutes: 30 },
        ]}
        channels={[
          { id: "mentions", label: "Mentions", description: "When someone tags you", defaultOn: true },
          { id: "comments", label: "Comments", description: "Replies on your files", defaultOn: true },
          { id: "deploys", label: "Deploys", description: "Builds and releases" },
          { id: "calendar", label: "Calendar", description: "Ten minutes before events", defaultOn: true },
        ]}
        people={people}
        onStateChange={setState}
      />
    </div>
  )
}
