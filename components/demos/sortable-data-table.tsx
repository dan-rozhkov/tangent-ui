"use client"

import { SortableDataTable } from "@/components/ui/sortable-data-table"

const projects = [
  { id: "harbour", name: "Harbour", owner: "Maya Collins", status: "Active", budget: 42000, updated: "Sep 22" },
  { id: "atlas", name: "Atlas", owner: "Leo Martin", status: "Review", budget: 18500, updated: "Sep 20" },
  { id: "meridian", name: "Meridian", owner: "Priya Shah", status: "Active", budget: 96000, updated: "Sep 18" },
  { id: "lantern", name: "Lantern", owner: "Tomas Berg", status: "Paused", budget: 7200, updated: "Sep 11" },
  { id: "orchard", name: "Orchard", owner: "Ines Duarte", status: "Active", budget: 31400, updated: "Sep 9" },
  { id: "tidewater", name: "Tidewater", owner: "Jonas Weber", status: "Review", budget: 58800, updated: "Aug 30" },
]

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

export default function Demo() {
  return (
    <div className="w-full max-w-3xl">
      <SortableDataTable
        rows={projects}
        rowKey="id"
        caption="Projects"
        columns={[
          { key: "name", label: "Name" },
          { key: "owner", label: "Owner" },
          { key: "status", label: "Status" },
          { key: "budget", label: "Budget", render: value => currency.format(value as number) },
          { key: "updated", label: "Updated", sortable: false },
        ]}
        defaultSort={{ key: "name", direction: "asc" }}
        selectable
        itemName={{ one: "project", other: "projects" }}
      />
    </div>
  )
}
