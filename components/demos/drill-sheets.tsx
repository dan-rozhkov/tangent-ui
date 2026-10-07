"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { CaretRightIcon, LeafIcon } from "@phosphor-icons/react"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import SegmentedControl from "@/components/ui/segmented-control"
import { DrillSheet, DrillSheets, DrillTrigger, useDrill } from "@/components/ui/drill-sheets"
import type { DrillPresentation } from "@/components/ui/drill-sheets"
import { Switch } from "@/components/ui/switch"
import { avatar } from "@/lib/media"

const modes = [
  { value: "auto", label: "Auto" },
  { value: "sheet", label: "Bottom" },
  { value: "dialog", label: "Centered" },
]

/** A bordered card that drills one level deeper. */
const card =
  "flex w-full cursor-pointer items-center gap-3 rounded-[26px] border border-border bg-transparent px-3 py-2.5 text-left text-foreground transition-colors duration-160 ease-standard pointer-fine:hover:bg-surface-muted motion-reduce:transition-none"
/** A grouped list: one bordered card with hairlines between rows. */
const group = "m-0 grid list-none overflow-hidden rounded-[26px] border border-border p-0 [&>li+li]:border-t [&>li+li]:border-border-subtle"
const groupRow = "flex items-center gap-3 px-3.5 py-3"

/** A card row that pushes a sheet, styled as content rather than as a button. */
function DrillRow({ to, children }: { to: string; children: ReactNode }) {
  const { path, open } = useDrill()
  return (
    <button type="button" aria-haspopup="dialog" aria-expanded={path.includes(to)} className={card} onClick={() => open(to)}>
      {children}
      <CaretRightIcon size={18} aria-hidden="true" className="flex-none text-text-muted" />
    </button>
  )
}

function SaveButton() {
  const { dismiss } = useDrill()
  return (
    <Button size="sm" onClick={dismiss}>
      Save
    </Button>
  )
}

function SharedWith() {
  const { back } = useDrill()
  return (
    <ul className={group}>
      {(["ryan-sullivan", "hannah-walsh"] as const).map(id => {
        const name = id === "ryan-sullivan" ? "Ryan Sullivan" : "Hannah Walsh"
        return (
          <li key={id} className={groupRow}>
            <Avatar src={avatar(id)} name={name} />
            <span className="min-w-0 flex-1 truncate">{name}</span>
            <Button size="sm" variant="ghost" onClick={back}>
              Stop sharing
            </Button>
          </li>
        )
      })}
    </ul>
  )
}

export default function Demo() {
  const [presentation, setPresentation] = useState<DrillPresentation>("auto")

  return (
    <div className="grid w-full max-w-[46rem] gap-4">
      <SegmentedControl label="Presentation" options={modes} value={presentation} onValueChange={value => setPresentation(value as DrillPresentation)} className="justify-self-center" />
      {/* The sheets fill this stage instead of the page, and switch to dialogs when the stage is wide. */}
      <div className="relative h-[36rem] overflow-hidden supports-[overflow:clip]:overflow-clip rounded-surface bg-surface-muted">
        <DrillSheets inline presentation={presentation}>
          <div className="grid h-full place-items-center content-center gap-3 p-6 text-center">
            <p className="m-0 max-w-xs text-sm text-text-secondary">Open a plant, then its watering plan. Swipe down on a sheet to return one level.</p>
            <DrillTrigger to="plants">Plant shelf</DrillTrigger>
          </div>

          <DrillSheet id="plants" title="My plants">
            <DrillRow to="monstera">
              <span className="grid size-11 flex-none place-items-center rounded-full bg-success/15 text-success" aria-hidden="true">
                <LeafIcon size={22} />
              </span>
              <span className="grid min-w-0 flex-1">
                <span className="truncate text-sm font-medium">Monstera</span>
                <span className="truncate text-xs text-text-secondary">Water on Friday</span>
              </span>
            </DrillRow>
            <ul className={group}>
              <li className={groupRow}>
                <span className="grid min-w-0 flex-1">
                  <span className="text-sm">Mist leaves</span>
                  <span className="text-xs text-text-secondary">Remind me on dry days</span>
                </span>
                <Switch aria-label="Mist leaves" defaultChecked />
              </li>
              <li className={groupRow}>
                <span className="grid min-w-0 flex-1">
                  <span className="text-sm">Weekly check-in</span>
                  <span className="text-xs text-text-secondary">A short round on Sunday</span>
                </span>
                <Switch aria-label="Weekly check-in" />
              </li>
            </ul>
          </DrillSheet>

          <DrillSheet id="monstera" title="Monstera" actions={<SaveButton />}>
            <div className="grid justify-items-center gap-2 py-2">
              <span className="grid size-20 place-items-center rounded-full bg-success/15 text-success" aria-hidden="true">
                <LeafIcon size={40} />
              </span>
            </div>
            <Input label="Nickname" defaultValue="Monty" />
            <Input label="Spot" defaultValue="Living room window" />
            <DrillRow to="watering">
              <span className="min-w-0 flex-1 truncate text-sm">Watering plan</span>
            </DrillRow>
          </DrillSheet>

          <DrillSheet id="watering" title="Watering plan">
            <SharedWith />
          </DrillSheet>
        </DrillSheets>
      </div>
    </div>
  )
}
