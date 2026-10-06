"use client"

import { Sparkline } from "@/components/ui/sparkline"

export default function Demo() {
  return (
    <div className="grid w-full max-w-xs gap-8">
      <Sparkline
        label="Signups"
        data={[12, 18, 15, 22, 30, 27, 34]}
        labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
        value="34"
        change="+26%"
        tone="success"
      />
      <Sparkline
        label="Error rate"
        data={[4.2, 3.8, 4.6, 5.9, 5.1, 6.4, 7.2, 6.8]}
        value="6.8%"
        change="+2.6 pts"
        tone="danger"
        formatValue={(value) => `${value}%`}
      />
      <Sparkline
        label="Sessions"
        data={[320, 340, 310, 360, 355, 372, 390, 384, 402]}
        value="402"
        change="+4%"
        area={false}
        interactive={false}
      />
    </div>
  )
}
