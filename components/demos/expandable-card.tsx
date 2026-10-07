"use client"

import { ExpandableCard } from "@/components/ui/expandable-card"

export default function Demo() {
  return (
    <div className="grid w-full justify-items-center">
      <ExpandableCard title="Pro plan" description="Billed yearly, renews March 4" width={400} expandedWidth={600}>
        <ul className="m-0 grid list-disc gap-1 pl-5">
          <li>Unlimited projects</li>
          <li>Priority support</li>
        </ul>
      </ExpandableCard>
    </div>
  )
}
