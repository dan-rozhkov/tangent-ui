"use client"

import { useDialKit } from "dialkit"

import { ExpandableCard } from "@/components/ui/expandable-card"

export default function Demo() {
  const props = useDialKit(
    "Expandable card",
    {
      title: { type: "text", default: "Pro plan" },
      description: { type: "text", default: "Billed yearly, renews March 4" },
      width: [400, 200, 600, 10],
      expandedWidth: [600, 200, 800, 10],
      defaultExpanded: false,
    },
    { id: "expandable-card" },
  )

  return (
    <div className="grid w-full justify-items-center">
      <ExpandableCard
        key={String(props.defaultExpanded)}
        title={props.title}
        description={props.description}
        width={props.width}
        expandedWidth={props.expandedWidth}
        defaultExpanded={props.defaultExpanded}
      >
        <ul className="m-0 grid list-disc gap-1 pl-5">
          <li>Unlimited projects</li>
          <li>Priority support</li>
        </ul>
      </ExpandableCard>
    </div>
  )
}
