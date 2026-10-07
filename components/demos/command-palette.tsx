"use client"

import { useState } from "react"
import { BellIcon, FilePlusIcon, FolderPlusIcon, GearIcon, KeyboardIcon, MoonIcon, SquaresFourIcon, UserPlusIcon, UsersIcon } from "@phosphor-icons/react"

import { CommandPalette, type CommandItem } from "@/components/ui/command-palette"

const icon = { size: 16 } as const

const items: CommandItem[] = [
  { id: "new-project", label: "New project", description: "Start from a blank board", group: "Create", shortcut: "N", icon: <FolderPlusIcon {...icon} /> },
  { id: "new-doc", label: "New document", description: "Write a brief or spec", group: "Create", shortcut: "D", icon: <FilePlusIcon {...icon} /> },
  { id: "invite", label: "Invite teammate", description: "Send an invite by email", group: "Team", keywords: ["member", "add"], icon: <UserPlusIcon {...icon} /> },
  { id: "members", label: "Manage members", description: "Roles and access", group: "Team", keywords: ["people"], icon: <UsersIcon {...icon} /> },
  { id: "dashboard", label: "Go to dashboard", group: "Navigate", shortcut: "G", icon: <SquaresFourIcon {...icon} /> },
  { id: "notifications", label: "Open notifications", group: "Navigate", icon: <BellIcon {...icon} /> },
  { id: "settings", label: "Open settings", description: "Workspace preferences", group: "Navigate", shortcut: ",", icon: <GearIcon {...icon} /> },
  { id: "theme", label: "Toggle theme", description: "Switch light and dark", keywords: ["dark", "light", "appearance"], icon: <MoonIcon {...icon} /> },
  { id: "shortcuts", label: "Keyboard shortcuts", description: "See every shortcut", keywords: ["keys", "help"], icon: <KeyboardIcon {...icon} /> },
]

export default function Demo() {
  const [last, setLast] = useState<string | null>(null)

  return (
    <div className="grid w-full max-w-[560px] gap-3">
      <CommandPalette items={items} onSelect={(item) => setLast(item.label)} />
      <p className="m-0 text-center text-(length:--text-xs) leading-body text-text-muted" aria-live="polite">
        {last ? `Ran: ${last}` : "Press Cmd or Ctrl plus K, then use the arrow keys."}
      </p>
    </div>
  )
}
