"use client"

import { BottomSheet, BottomSheetClose } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"

const bookings = [
  { label: "Flight", detail: "TP 1351, Oct 12 at 8:40" },
  { label: "Hotel", detail: "Memmo Alfama, 3 nights" },
  { label: "Dinner", detail: "Prado, Oct 13 at 20:00" },
  { label: "Tour", detail: "Sintra day trip, Oct 14" },
  { label: "Return", detail: "TP 1354, Oct 15 at 18:10" },
]

export default function Demo() {
  return (
    <BottomSheet
      trigger={<Button>Trip details</Button>}
      title="Lisbon, 3 nights"
      description="Oct 12 to Oct 15"
      detents={[0.4, 0.9]}
    >
      <div className="grid gap-5">
        <p className="m-0 text-text-secondary">Flights, hotel, and bookings. Drag the sheet up to see everything.</p>
        <ul className="m-0 grid list-none gap-0 p-0">
          {bookings.map((booking) => (
            <li key={booking.label} className="grid gap-0.5 border-b border-border py-3 last:border-b-0">
              <span className="font-medium">{booking.label}</span>
              <span className="text-text-secondary">{booking.detail}</span>
            </li>
          ))}
        </ul>
        <BottomSheetClose render={<Button variant="secondary">Done</Button>} />
      </div>
    </BottomSheet>
  )
}
