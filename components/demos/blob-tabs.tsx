"use client"

import { useState } from "react"
import { CreditCardIcon, EraserIcon, EyedropperIcon, PackageIcon, PaintBucketIcon, PencilSimpleIcon, SquaresFourIcon, UsersThreeIcon } from "@phosphor-icons/react"

import { BlobTabs, blobPanelId, blobTabId } from "@/components/ui/blob-tabs"

const copy: Record<string, string> = {
  overview: "Revenue is up 8% on last week.",
  orders: "Three orders are waiting to ship.",
  customers: "Eleven new customers this month.",
  billing: "Your next invoice is due on the 1st.",
}

export default function Demo() {
  const [tab, setTab] = useState("overview")
  const [tool, setTool] = useState("draw")

  return (
    <div className="grid w-full max-w-[720px] justify-items-center gap-8">
      <section
        id={blobPanelId("nav", tab)}
        role="tabpanel"
        aria-labelledby={blobTabId("nav", tab)}
        className="grid h-24 w-full max-w-sm place-items-center rounded-panel border border-border bg-surface text-sm text-text-secondary"
      >
        {copy[tab]}
      </section>
      <BlobTabs
        id="nav"
        label="Dashboard views"
        value={tab}
        onValueChange={setTab}
        tabs={[
          { value: "overview", label: "Overview", icon: <SquaresFourIcon size={24} /> },
          { value: "orders", label: "Orders", icon: <PackageIcon size={24} />, tally: 3, tallyLabel: "3 to ship" },
          { value: "customers", label: "Customers", icon: <UsersThreeIcon size={24} /> },
          { value: "billing", label: "Billing", icon: <CreditCardIcon size={24} /> },
        ]}
      />
      <BlobTabs
        id="tools"
        label="Drawing tools"
        captions="hidden"
        value={tool}
        onValueChange={setTool}
        tabs={[
          { value: "draw", label: "Draw", icon: <PencilSimpleIcon size={24} /> },
          { value: "erase", label: "Erase", icon: <EraserIcon size={24} /> },
          { value: "fill", label: "Fill", icon: <PaintBucketIcon size={24} /> },
          { value: "pick", label: "Pick color", icon: <EyedropperIcon size={24} /> },
        ]}
      />
    </div>
  )
}
