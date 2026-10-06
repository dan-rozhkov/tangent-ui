"use client"

import { NotificationCenter, type NotificationItem } from "@/components/ui/notification-center"
import { person } from "@/lib/media"

const emma = person("emma-collins")
const marcus = person("marcus-johnson")

const notifications: NotificationItem[] = [
  { id: "deploy", title: "Deploy finished", description: "Production is running build 1.42 in all regions.", time: "2m", tone: "success" },
  { id: "comment", title: "Emma commented on Q3 roadmap", description: "Can we move the billing work ahead of the export flow?", time: "18m", actor: { name: emma.name, photo: emma.src } },
  { id: "quota", title: "Storage is 90% full", description: "Archive old projects or upgrade to keep uploads working.", time: "1h", tone: "warning" },
  { id: "review", title: "Marcus requested your review", time: "3h", actor: { name: marcus.name, photo: marcus.src } },
  { id: "digest", title: "Weekly digest is ready", description: "12 updates across 4 projects.", time: "Mon", read: true },
]

export default function Demo() {
  return (
    <div className="flex w-full justify-center">
      <NotificationCenter notifications={notifications} />
    </div>
  )
}
