"use client"

import { useEffect, useState } from "react"

import { Kbd, ShortcutList, ShortcutRecorder, matchesShortcut, usePlatform } from "@/components/ui/shortcut-recorder"

const groups = [
  {
    label: "General",
    items: [
      { label: "Open search", shortcut: "mod+k" },
      { label: "Print", shortcut: "mod+p" },
      { label: "Settings", shortcut: "mod+," },
    ],
  },
  {
    label: "Editing",
    items: [
      { label: "Bold", shortcut: "mod+b" },
      { label: "Italic", shortcut: "mod+i" },
      { label: "Strikethrough", shortcut: "mod+shift+x" },
    ],
  },
]

export default function Demo() {
  const platform = usePlatform()
  const [shortcut, setShortcut] = useState<string | null>("mod+k")
  const [hits, setHits] = useState(0)

  useEffect(() => {
    if (!shortcut) return
    const onKey = (event: KeyboardEvent) => {
      if (matchesShortcut(event, shortcut, platform)) {
        event.preventDefault()
        setHits(count => count + 1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [platform, shortcut])

  return (
    <div className="grid w-full max-w-md gap-8">
      <ShortcutRecorder
        label="Open search"
        value={shortcut}
        onValueChange={setShortcut}
        resetValue="mod+k"
        bindings={[{ shortcut: "mod+p", label: "Print" }]}
        description={hits ? `Opened search ${hits} ${hits === 1 ? "time" : "times"}` : undefined}
      />
      <p className="text-sm text-text-secondary">
        Press <Kbd size="sm">{platform === "mac" ? "⌘" : "Ctrl"}</Kbd> to light up every shortcut that uses it.
      </p>
      <ShortcutList groups={groups} platform={platform} />
    </div>
  )
}
