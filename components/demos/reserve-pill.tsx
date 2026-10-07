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
    // The time step stands taller than the page text above the pill, so the box keeps the same room above and below.
    <div className="relative flex w-full max-w-[720px] flex-col items-center gap-5 py-12">
      {/* The page recedes while the pill is open. */}
      <div
        className={cn(
          "grid w-full max-w-sm gap-2 transition-[opacity,filter,transform] duration-480 ease-enter motion-reduce:transition-opacity",
          open && "scale-[.98] opacity-40 blur-[2px] motion-reduce:blur-none",
        )}
      >
        <p className="text-xs text-text-secondary">Hayes Valley, open from 5 PM</p>
        <h3 className="font-display text-2xl tracking-display">Olea</h3>
        <p className="max-w-sm text-sm text-text-secondary">
          Wood-fired plates, a short list of natural wines, and a quiet patio off Octavia Street.
        </p>
      </div>
      {/* The pill rests in a slot of its own height and grows upward over the page text. */}
      <div className="relative h-[60px] w-full">
        <BookingPill
          className="absolute inset-x-0 bottom-0"
          venue="Olea"
          venueDetail="432 Octavia Street"
          startDate={FIRST_DAY}
          hourCycle={12}
          isAvailable={(_date, time, party) => !TAKEN.includes(time) && !(party > 6 && time > "20:00")}
          onStepChange={setStep}
        />
      </div>
    </div>
  )
}
