"use client"

import { useState } from "react"
import { Briefcase, Heart, House, IdCard, Lightbulb, LogOut, NotebookTabs, Paintbrush, Search, SlidersHorizontal, Sparkles, User, UserPlus } from "lucide-react"

import { ToolbarMenu, type ToolbarMenuItem } from "@/components/ui/toolbar-menu"

const items: ToolbarMenuItem[] = [
  { id: "home", label: "Home", icon: <House /> },
  { id: "discover", label: "Discover", icon: <Search /> },
  { id: "favorites", label: "Favorites", icon: <Heart /> },
  {
    id: "notebooks",
    label: "Notebooks",
    icon: <NotebookTabs />,
    items: [
      { id: "personal", label: "Personal", icon: <User /> },
      { id: "work", label: "Work", icon: <Briefcase /> },
      { id: "ideas", label: "Ideas", icon: <Lightbulb /> },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: <SlidersHorizontal />,
    inBar: false,
    items: [
      { id: "profile", label: "Profile", icon: <IdCard /> },
      { id: "appearance", label: "Appearance", icon: <Paintbrush /> },
      { id: "upgrade", label: "Upgrade", icon: <Sparkles /> },
      { id: "invite", label: "Invite a friend", icon: <UserPlus /> },
      { id: "sign-out", label: "Sign out", icon: <LogOut /> },
    ],
  },
]

export default function Demo() {
  const [value, setValue] = useState("home")
  const [last, setLast] = useState("Home")

  return (
    <div className="flex min-h-[380px] flex-col items-center justify-end gap-6">
      <ToolbarMenu
        items={items}
        value={value}
        onValueChange={(id, item) => {
          setValue(id)
          setLast(item.label)
        }}
      />
      <p className="text-sm text-text-muted" aria-live="polite">
        Showing {last}
      </p>
    </div>
  )
}
