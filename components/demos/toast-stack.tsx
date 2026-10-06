"use client"

import { useEffect, useRef } from "react"
import { useDialKit } from "dialkit"

import { Button } from "@/components/ui/button"
import { ToastStack, ToastStackProvider, useToastStack } from "@/components/ui/toast-stack"

function Controls() {
  const { toast, update, dismiss, count } = useToastStack()
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), [])

  function publish() {
    const id = toast({ type: "loading", title: "Publishing", description: "Uploading 12 files." })
    timers.current.push(
      window.setTimeout(
        () =>
          update(id, {
            type: "success",
            title: "Published",
            description: "Your site is live.",
            action: { label: "View", onClick: () => {} },
          }),
        1600
      )
    )
  }

  function archive() {
    toast({
      type: "info",
      title: "Message archived",
      action: {
        label: "Undo",
        // Updating the toast keeps it open, so it morphs into the result instead of closing.
        onClick: (id) => update(id, { type: "success", title: "Message restored", action: undefined }),
      },
    })
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Button onClick={publish}>Publish</Button>
      <Button variant="secondary" onClick={archive}>
        Archive
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast({ type: "error", title: "Could not sync", description: "Check your connection and try again." })
        }
      >
        Show error
      </Button>
      {count > 0 && (
        <Button variant="ghost" onClick={() => dismiss()}>
          Clear all
        </Button>
      )}
    </div>
  )
}

export default function Demo() {
  const dials = useDialKit(
    "Toast stack",
    {
      duration: [5000, 1000, 15000, 500],
      limit: [12, 3, 20, 1],
      visibleToasts: [3, 1, 6, 1],
      position: { type: "select", options: ["bottom-right", "bottom-center", "bottom-left"], default: "bottom-right" },
      hotkey: true,
      label: { type: "text", default: "Notifications" },
    },
    { id: "toast-stack" },
  )
  return (
    <ToastStackProvider duration={dials.duration} limit={dials.limit}>
      {/* Contained, so the stack sits inside the preview instead of the window corner. */}
      <div className="relative grid min-h-96 w-full place-items-center overflow-hidden rounded-panel border border-border bg-surface p-6">
        <Controls />
        <ToastStack
          contained
          position={dials.position as "bottom-right" | "bottom-center" | "bottom-left"}
          visibleToasts={dials.visibleToasts}
          hotkey={dials.hotkey}
          label={dials.label}
        />
      </div>
    </ToastStackProvider>
  )
}
