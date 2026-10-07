"use client"

import { useState } from "react"
import { BookmarkSimpleIcon, BookOpenIcon, BroadcastIcon, HouseIcon, MagnifyingGlassIcon, TrayIcon, UserIcon } from "@phosphor-icons/react"

import { LiquidTabBar, liquidPanelId, liquidTabId } from "@/components/ui/liquid-tab-bar"

const copy: Record<string, string> = {
  home: "Picked for you, updated every morning.",
  saved: "Everything you saved, in one place.",
  inbox: "Two unread messages since your last visit.",
  profile: "Your name, photo and preferences.",
}

export default function Demo() {
  const [tab, setTab] = useState("home")
  const [compact, setCompact] = useState("radio")

  return (
    <div className="grid w-full max-w-[720px] justify-items-center gap-8">
      <section
        id={liquidPanelId("nav", tab)}
        role="tabpanel"
        aria-labelledby={liquidTabId("nav", tab)}
        className="grid h-24 w-full max-w-sm place-items-center rounded-panel border border-border bg-surface text-sm text-text-secondary"
      >
        {copy[tab]}
      </section>
      <LiquidTabBar
        id="nav"
        label="Sections"
        value={tab}
        onValueChange={setTab}
        tabs={[
          { value: "home", label: "Home", icon: <HouseIcon size={24} /> },
          { value: "saved", label: "Saved", icon: <BookmarkSimpleIcon size={24} /> },
          { value: "inbox", label: "Inbox", icon: <TrayIcon size={24} />, badge: 2, badgeLabel: "2 unread" },
          { value: "profile", label: "Profile", icon: <UserIcon size={24} /> },
        ]}
      />
      <LiquidTabBar
        id="compact"
        label="Compact sections"
        labels="none"
        value={compact}
        onValueChange={setCompact}
        tabs={[
          { value: "home", label: "Home", icon: <HouseIcon size={24} /> },
          { value: "radio", label: "Radio", icon: <BroadcastIcon size={24} /> },
          { value: "library", label: "Library", icon: <BookOpenIcon size={24} /> },
          { value: "search", label: "Search", icon: <MagnifyingGlassIcon size={24} /> },
        ]}
      />
    </div>
  )
}
