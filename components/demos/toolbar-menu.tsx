"use client"

import { useState } from "react"
import { BookIcon, BriefcaseIcon, FunnelIcon, HeartIcon, HouseIcon, MagnifyingGlassIcon, PaintBrushIcon, SignOutIcon, SparkleIcon, UserCircleIcon, UserIcon, UserPlusIcon } from "@phosphor-icons/react"

import { ToolbarMenu, type ToolbarMenuItem } from "@/components/ui/toolbar-menu"

const items: ToolbarMenuItem[] = [
  { id: "home", label: "Home", icon: <HouseIcon size={24} /> },
  { id: "discover", label: "Discover", icon: <MagnifyingGlassIcon size={24} /> },
  { id: "favorites", label: "Favorites", icon: <HeartIcon size={24} /> },
  {
    id: "notebooks",
    label: "Notebooks",
    icon: <BookIcon size={24} />,
    items: [
      { id: "personal", label: "Personal", icon: <UserIcon size={24} /> },
      { id: "work", label: "Work", icon: <BriefcaseIcon size={24} /> },
      { id: "ideas", label: "Ideas", icon: <SparkleIcon size={24} /> },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: <FunnelIcon size={24} />,
    inBar: false,
    items: [
      { id: "profile", label: "Profile", icon: <UserCircleIcon size={24} /> },
      { id: "appearance", label: "Appearance", icon: <PaintBrushIcon size={24} /> },
      { id: "upgrade", label: "Upgrade", icon: <SparkleIcon size={24} /> },
      { id: "invite", label: "Invite a friend", icon: <UserPlusIcon size={24} /> },
      { id: "sign-out", label: "Sign out", icon: <SignOutIcon size={24} /> },
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
