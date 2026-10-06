"use client"

import { UsageMeter } from "@/components/ui/usage-meter"

export default function Demo() {
  return (
    <div className="w-full max-w-md">
      <UsageMeter
        label="Workspace storage"
        unit="GB"
        limit={50}
        segments={[
          { id: "files", label: "Files", value: 21.4 },
          { id: "media", label: "Media", value: 14.2 },
          { id: "backups", label: "Backups", value: 6.8 },
        ]}
      />
    </div>
  )
}
