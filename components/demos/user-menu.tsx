"use client"

import { Cog, CreditCard, User } from "@mynaui/icons-react"

import { UserMenu } from "@/components/ui/user-menu"

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default function Demo() {
  return (
    <div className="flex w-full items-center justify-center gap-6">
      <UserMenu
        user={{ name: "Maya Fischer", email: "maya@example.com", plan: "Pro" }}
        showName
        items={[
          { label: "Profile", icon: <User size={16} /> },
          { label: "Settings", icon: <Cog size={16} />, keys: ["⌘", ","] },
          { label: "Billing", icon: <CreditCard size={16} /> },
        ]}
        onSignOut={() => wait(1200)}
      />
      <UserMenu
        user={{ name: "Jonas Weber", email: "jonas@example.com" }}
        defaultStatus="busy"
        onStatusChange={() => {}}
        items={[{ label: "Profile", icon: <User size={16} /> }]}
        signOutKeys={["⇧", "⌘", "Q"]}
      />
    </div>
  )
}
