"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export default function Demo() {
  return (
    <div className="flex flex-wrap gap-3">
      <Popover>
        <PopoverTrigger render={<Button variant="secondary">Share</Button>} />
        <PopoverContent>
          <p className="m-0 text-sm leading-body text-text-secondary">Anyone with the link can view.</p>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger render={<Button variant="secondary">Details</Button>} />
        <PopoverContent side="top" align="center" aria-label="Project details">
          <div className="grid gap-3">
            <div className="grid gap-1">
              <p className="m-0 text-sm font-medium">Tangent</p>
              <p className="m-0 text-sm leading-body text-text-secondary">Updated two hours ago by Maya Chen.</p>
            </div>
            <PopoverClose render={<Button size="sm" variant="secondary">Done</Button>} />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
