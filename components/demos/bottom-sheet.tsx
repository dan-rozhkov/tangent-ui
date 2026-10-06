"use client"

import { useDialKit } from "dialkit"

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
  const dial = useDialKit(
    "Bottom sheet",
    {
      title: "Lisbon, 3 nights",
      description: "Oct 12 to Oct 15",
      detents: {
        peek: [0.4, 0.1, 0.8, 0.05],
        full: [0.9, 0.5, 1, 0.01],
      },
      initialDetent: [0, 0, 1, 1],
    },
    { id: "bottom-sheet" }
  )
  return (
    <BottomSheet
      trigger={<Button>Trip details</Button>}
      title={dial.title}
      description={dial.description}
      detents={[dial.detents.peek, dial.detents.full]}
      initialDetent={dial.initialDetent}
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
