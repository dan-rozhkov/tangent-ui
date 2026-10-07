"use client"

import { useState } from "react"
import { CameraIcon, ImageIcon, MapPinIcon, MicrophoneIcon, MonitorPlayIcon, MusicNotesIcon, NotePencilIcon, PlusIcon, ScanIcon, TrayIcon } from "@phosphor-icons/react"

import { MagnifyBar, type MagnifyItem } from "@/components/ui/magnify-bar"

const initialSlots: MagnifyItem[] = [
  { id: "music", label: "Music", icon: <MusicNotesIcon size={24} />, hotkey: "1" },
  { id: "photos", label: "Photos", icon: <ImageIcon size={24} />, hotkey: "2" },
  {
    id: "capture",
    label: "Capture",
    icon: <PlusIcon size={24} />,
    members: [
      { id: "camera", label: "Camera", icon: <CameraIcon size={24} />, hotkey: "C" },
      { id: "screen", label: "Screen recording", icon: <MonitorPlayIcon size={24} />, hotkey: "R" },
      { id: "voice", label: "Voice memo", icon: <MicrophoneIcon size={24} />, hotkey: "M" },
      { id: "scan", label: "Scan document", icon: <ScanIcon size={24} />, hotkey: "D" },
    ],
  },
  { id: "notes", label: "Notes", icon: <NotePencilIcon size={24} />, hotkey: "3" },
  { id: "maps", label: "Maps", icon: <MapPinIcon size={24} />, hotkey: "4" },
  { id: "inbox", label: "Inbox", icon: <TrayIcon size={24} />, hotkey: "5", count: 3 },
]

export default function Demo() {
  const [app, setApp] = useState("music")
  const [slots, setSlots] = useState(initialSlots)

  return (
    // The capture tray opens upward from the bar, so the box keeps equal room above and below the bar and its hint.
    <div className="flex w-full max-w-[26rem] min-w-fit flex-col items-center gap-4 py-14">
      <MagnifyBar
        label="Apps"
        slots={slots}
        active={app}
        onActiveChange={(id) => {
          setApp(id)
          if (id === "inbox") setSlots((current) => current.map((slot) => (slot.id === "inbox" ? { ...slot, count: 0 } : slot)))
        }}
        onReorder={(next) => setSlots(next)}
      />
      <p className="max-w-full text-center text-sm text-balance text-text-secondary">
        Drag an app, or hold Alt with the arrow keys, to rearrange. Opening the inbox clears its count.
      </p>
    </div>
  )
}
