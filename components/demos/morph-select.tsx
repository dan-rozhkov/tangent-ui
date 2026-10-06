"use client"

import { useState } from "react"
import { useDialKit } from "dialkit"

import { MorphSelect } from "@/components/ui/morph-select"

const languages = [
  "Dutch",
  "English",
  "French",
  "German",
  "Italian",
  "Japanese",
  "Korean",
  "Polish",
  "Portuguese",
  "Spanish",
  "Swedish",
  "Turkish",
].map(label => ({ value: label.toLowerCase(), label }))

export default function Demo() {
  const [zone, setZone] = useState<string | null>("europe/zurich")
  const props = useDialKit(
    "Morph select",
    {
      panelWidth: [272, 180, 400, 4],
      maxListHeight: [296, 120, 480, 8],
      align: { type: "select", options: ["start", "end"], default: "start" },
      searchable: { type: "select", options: ["auto", "on", "off"], default: "auto" },
      disabled: false,
    },
    { id: "morph-select" },
  )
  const shared = {
    panelWidth: props.panelWidth,
    maxListHeight: props.maxListHeight,
    align: props.align as "start" | "end",
    searchable: (props.searchable === "auto" ? "auto" : props.searchable === "on") as boolean | "auto",
    disabled: props.disabled,
  }

  return (
    <div className="flex flex-wrap items-start justify-center gap-6">
      <MorphSelect
        label="Time zone"
        name="timezone"
        {...shared}
        value={zone}
        onValueChange={setZone}
        items={[
          {
            label: "Europe",
            options: [
              { value: "europe/london", label: "London", meta: "UTC+0" },
              { value: "europe/zurich", label: "Zurich", meta: "UTC+1", keywords: "switzerland" },
            ],
          },
          {
            label: "Americas",
            options: [
              { value: "america/new_york", label: "New York", meta: "UTC−5" },
              { value: "america/los_angeles", label: "Los Angeles", meta: "UTC−8" },
            ],
          },
        ]}
      />
      {/* More than eight options: the lid turns into a search field when open. */}
      <MorphSelect label="Language" placeholder="Choose a language" items={languages} {...shared} />
    </div>
  )
}
