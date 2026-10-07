"use client"

import { useState } from "react"

import { BookingPill, type BookingStep } from "@/components/ui/booking-pill"
import { cn } from "@/lib/utils"

/* A fixed first day keeps the prerendered strip and the hydrated one identical. Real pages pass it from data. */
const FIRST_DAY = "2026-09-22"
/* Three seatings are taken every evening, so the time step reads "9 free". */
const TAKEN = ["17:30", "18:30", "21:00"]

export default function Demo() {
  const [step, setStep] = useState<BookingStep>("start")
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
        <h3 className="font-display text-2xl tracking-display">Olea</h3>
        <p className="max-w-sm text-sm text-text-secondary">
          Wood-fired plates, a short list of natural wines, and a quiet patio off Octavia Street.
        </p>
      </div>
      <BookingPill
        className="relative"
        venue="Olea"
        venueDetail="432 Octavia Street"
        startDate={FIRST_DAY}
        hourCycle={12}
        isAvailable={(_date, time, party) => !TAKEN.includes(time) && !(party > 6 && time > "20:00")}
        onStepChange={setStep}
      />
    </div>
  )
}
