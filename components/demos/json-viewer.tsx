"use client"

import { JsonViewer } from "@/components/ui/json-viewer"

const payload = {
  id: "evt_1Q2w3E4r5T6y",
  type: "invoice.paid",
  created: 1758621600,
  livemode: false,
  data: {
    invoice: {
      id: "in_8Hj2kL",
      number: "TG-0042",
      currency: "usd",
      amount_due: 12900,
      amount_paid: 12900,
      paid: true,
      discount: null,
      customer: {
        id: "cus_4fG7",
        name: "Emma Collins",
        email: "emma@example.com",
        "billing address": { line1: "12 Harbor Street", city: "Lisbon", country: "PT" },
      },
      lines: [
        { id: "li_1", description: "Pro plan, yearly", quantity: 1, amount: 9900 },
        { id: "li_2", description: "Extra seats", quantity: 3, amount: 3000 },
      ],
    },
  },
  request: { id: "req_9aB", idempotency_key: "7f1c2d3e" },
  attempts: Array.from({ length: 64 }, (_, index) => ({ attempt: index + 1, status: index < 63 ? 500 : 200 })),
}

export default function Demo() {
  return (
    <div className="w-full max-w-[520px]">
      <JsonViewer data={payload} rootName="event" defaultExpandDepth={2} maxHeight={360} />
    </div>
  )
}
