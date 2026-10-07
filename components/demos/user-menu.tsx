"use client"

import { CreditCardIcon, GearIcon, UserIcon } from "@phosphor-icons/react"

import { UserMenu } from "@/components/ui/user-menu"

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default function Demo() {
  return (
    <div className="flex w-full items-center justify-center gap-6">
      <UserMenu
        user={{ name: "Maya Fischer", email: "maya@example.com", plan: "Pro" }}
        showName
        items={[
          { label: "Profile", icon: <UserIcon size={16} /> },
          { label: "Settings", icon: <GearIcon size={16} />, keys: ["⌘", ","] },
          { label: "Billing", icon: <CreditCardIcon size={16} /> },
        ]}
        onSignOut={() => wait(1200)}
      />
      <UserMenu
        user={{ name: "Jonas Weber", email: "jonas@example.com" }}
        defaultStatus="busy"
        onStatusChange={() => {}}
        items={[{ label: "Profile", icon: <UserIcon size={16} /> }]}
        signOutKeys={["⇧", "⌘", "Q"]}
      />
    </div>
  )
}
