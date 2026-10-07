"use client"

import { ComponentSearch } from "@/components/gallery/component-search"
import { SettingsPopover } from "@/components/gallery/settings-popover"

/** The gallery header's actions: search, then settings (theme, accent and motion). */
export function HeaderActions() {
  return (
    <div className="flex items-center gap-2">
      <ComponentSearch />
      <SettingsPopover />
    </div>
  )
}
