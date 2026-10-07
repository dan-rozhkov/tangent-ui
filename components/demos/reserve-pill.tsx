"use client"

import { useState } from "react"

import { ReservePill, type ReserveStep } from "@/components/ui/reserve-pill"
import { cn } from "@/lib/utils"

/* A fixed first day keeps the prerendered strip and the hydrated one identical. Real pages pass it from data. */
const FIRST_DAY = "2026-10-12"
/* Three hours are always held for lessons, so the slot step reads "9 open". */
const HELD = ["09:00", "12:00", "18:00"]

export default function Demo() {
  const [step, setStep] = useState<ReserveStep>("start")
  const open = step !== "start"

  return (
    // The slot step stands taller than the page text above the pill, so the box keeps the same room above and below.
    <div className="relative flex w-full max-w-[720px] flex-col items-center gap-5 py-12">
      {/* The page recedes while the pill is open. */}
      <div
        className={cn(
          "grid w-full max-w-sm gap-2 transition-[opacity,filter,transform] duration-480 ease-enter motion-reduce:transition-opacity",
          open && "scale-[.98] opacity-40 blur-[2px] motion-reduce:blur-none",
        )}
      >
        <p className="text-xs text-text-secondary">Dockside, open from 8 AM</p>
        <h3 className="font-display text-2xl tracking-display">Harbor Padel</h3>
        <p className="max-w-sm text-sm text-text-secondary">
          Two glass-walled courts, rental rackets at the desk, and a juice bar overlooking the water.
        </p>
      </div>
      {/* The pill rests in a slot of its own height and grows upward over the page text. */}
      <div className="relative h-[60px] w-full">
        <ReservePill
          className="absolute inset-x-0 bottom-0"
          facility="Harbor Padel, Court 2"
          facilityNote="18 Quay Road"
          firstDay={FIRST_DAY}
          clock={12}
          isOpen={(_day, slot, players) => !HELD.includes(slot) && !(players > 2 && slot < "10:00")}
          onStepChange={setStep}
        />
      </div>
    </div>
  )
}
