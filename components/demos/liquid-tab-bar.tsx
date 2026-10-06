"use client"

import { useState } from "react"
import { useDialKit } from "dialkit"
import { Bookmark, Home, Inbox, Library, Radio, Search, User } from "lucide-react"

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
  const dial = useDialKit(
    "Liquid tab bar",
    {
      labels: { type: "select", options: ["active", "always", "none"], default: "active" },
      compactLabels: { type: "select", options: ["active", "always", "none"], default: "none" },
      badge: [2, 0, 99, 1],
    },
    { id: "liquid-tab-bar" },
  )

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
        labels={dial.labels as "active" | "always" | "none"}
        value={tab}
        onValueChange={setTab}
        tabs={[
          { value: "home", label: "Home", icon: <Home /> },
          { value: "saved", label: "Saved", icon: <Bookmark /> },
          { value: "inbox", label: "Inbox", icon: <Inbox />, badge: dial.badge, badgeLabel: `${dial.badge} unread` },
          { value: "profile", label: "Profile", icon: <User /> },
        ]}
      />
      <LiquidTabBar
        id="compact"
        label="Compact sections"
        labels={dial.compactLabels as "active" | "always" | "none"}
        value={compact}
        onValueChange={setCompact}
        tabs={[
          { value: "home", label: "Home", icon: <Home /> },
          { value: "radio", label: "Radio", icon: <Radio /> },
          { value: "library", label: "Library", icon: <Library /> },
          { value: "search", label: "Search", icon: <Search /> },
        ]}
      />
    </div>
  )
}
