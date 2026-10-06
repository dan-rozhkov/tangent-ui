"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from "@/components/ui/drawer"
import { Switch } from "@/components/ui/switch"

const sides = ["right", "left", "top", "bottom"] as const

export default function Demo() {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-3">
        <Drawer>
          <DrawerTrigger render={<Button variant="secondary">Filters</Button>} />
          <DrawerContent title="Filters" description="Narrow the list of projects.">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Switch label="Only my projects" defaultChecked />
                <Switch label="Include archived" />
                <Switch label="Shared with me" />
              </div>
              <DrawerClose render={<Button>Apply</Button>} />
            </div>
          </DrawerContent>
        </Drawer>
        {sides.slice(1).map((side) => (
          <Drawer key={side}>
            <DrawerTrigger render={<Button variant="ghost">From the {side}</Button>} />
            <DrawerContent side={side} title="Activity" description="Drag the header toward the edge to close.">
              <p className="m-0 text-text-secondary">Maya renamed the project. Jonas left a comment on the checkout flow.</p>
            </DrawerContent>
          </Drawer>
        ))}
      </div>

      {/* A drawer anchored to a panel instead of the page. */}
      <div ref={setContainer} className="relative h-72 overflow-hidden rounded-panel border border-border bg-surface">
        <div className="grid h-full place-items-center">
          <Drawer>
            <DrawerTrigger render={<Button variant="secondary">Open in panel</Button>} />
            <DrawerContent container={container} title="Details" description="Contained in this panel.">
              <p className="m-0 text-text-secondary">The page around the panel stays usable.</p>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    </div>
  )
}
