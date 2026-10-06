"use client"

import { useState } from "react"
import { useDialKit } from "dialkit"

import { BookingPill, type BookingStep } from "@/components/ui/booking-pill"
import { cn } from "@/lib/utils"

/* A fixed first day keeps the prerendered strip and the hydrated one identical. Real pages pass it from data. */
const FIRST_DAY = "2026-09-22"
/* Three seatings are taken every evening, so the time step reads "9 free". */
const TAKEN = ["17:30", "18:30", "21:00"]

const TIMES = ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30"]

export default function Demo() {
  const [step, setStep] = useState<BookingStep>("start")
  const [run, setRun] = useState(0)
  const dials = useDialKit(
    "Booking pill",
    {
      label: { type: "text", default: "Book a table" },
      venue: { type: "text", default: "Olea" },
      hourCycle: { type: "select", options: ["12", "24"], default: "12" },
      days: [21, 3, 60, 1],
      preferredTime: { type: "select", options: TIMES, default: "19:30" },
      party: {
        _collapsed: true,
        min: [1, 1, 12, 1],
        max: [12, 1, 20, 1],
        initial: [2, 1, 20, 1],
      },
      reset: { type: "action", label: "Reset pill" },
    },
    { id: "booking-pill", onAction: () => setRun(n => n + 1) },
  )
  // The dials move independently, so keep min <= initial <= max before handing them to the pill.
  const partyMin = Math.min(dials.party.min, dials.party.max)
  const partyMax = Math.max(dials.party.min, dials.party.max)
  const partyInitial = Math.min(partyMax, Math.max(partyMin, dials.party.initial))
  /* Party limits and the starting size are read once, so a change remounts the pill. */
  const pillKey = `${run}-${partyMin}-${partyMax}-${partyInitial}`
  const [seenKey, setSeenKey] = useState(pillKey)
  if (seenKey !== pillKey) {
    setSeenKey(pillKey)
    setStep("start")
  }
  const open = step !== "start"

  return (
    <div className="relative flex h-[420px] w-full max-w-[720px] flex-col items-center justify-end overflow-hidden rounded-panel pb-6">
      {/* The page recedes while the pill is open. */}
      <div
        className={cn(
          "absolute inset-x-6 top-6 grid gap-2 transition-[opacity,filter,transform] duration-480 ease-enter motion-reduce:transition-opacity",
          open && "scale-[.98] opacity-40 blur-[2px] motion-reduce:blur-none",
        )}
      >
        <p className="text-xs text-text-secondary">Hayes Valley, open from 5 PM</p>
        <h3 className="font-display text-2xl tracking-display">{dials.venue}</h3>
        <p className="max-w-sm text-sm text-text-secondary">
          Wood-fired plates, a short list of natural wines, and a quiet patio off Octavia Street.
        </p>
      </div>
      <BookingPill
        key={pillKey}
        className="relative"
        venue={dials.venue}
        label={dials.label}
        days={dials.days}
        preferredTime={dials.preferredTime}
        minPartySize={partyMin}
        maxPartySize={partyMax}
        defaultPartySize={partyInitial}
        venueDetail="432 Octavia Street"
        startDate={FIRST_DAY}
        hourCycle={dials.hourCycle === "24" ? 24 : 12}
        isAvailable={(_date, time, party) => !TAKEN.includes(time) && !(party > 6 && time > "20:00")}
        onStepChange={setStep}
      />
    </div>
  )
}
