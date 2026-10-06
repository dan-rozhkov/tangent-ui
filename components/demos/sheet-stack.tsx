"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { useDialKit } from "dialkit"
import { ChevronRight } from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import SegmentedControl from "@/components/ui/segmented-control"
import { Sheet, SheetStack, SheetTrigger, useSheetStack } from "@/components/ui/sheet-stack"
import type { SheetStackMode } from "@/components/ui/sheet-stack"
import { Switch } from "@/components/ui/switch"
import { avatar } from "@/lib/media"

const modes = [
  { value: "auto", label: "Auto" },
  { value: "sheet", label: "Sheets" },
  { value: "dialog", label: "Dialogs" },
]

/** A bordered card that drills one level deeper. */
const card =
  "flex w-full cursor-pointer items-center gap-3 rounded-[26px] border border-border bg-transparent px-3 py-2.5 text-left text-foreground transition-colors duration-160 ease-standard pointer-fine:hover:bg-surface-muted motion-reduce:transition-none"
/** A grouped list: one bordered card with hairlines between rows. */
const group = "m-0 grid list-none overflow-hidden rounded-[26px] border border-border p-0 [&>li+li]:border-t [&>li+li]:border-border-subtle"
const groupRow = "flex items-center gap-3 px-3.5 py-3"

/** A card row that pushes a sheet, styled as content rather than as a button. */
function DrillRow({ sheet, children }: { sheet: string; children: ReactNode }) {
  const { stack, push } = useSheetStack()
  return (
    <button type="button" aria-haspopup="dialog" aria-expanded={stack.includes(sheet)} className={card} onClick={() => push(sheet)}>
      {children}
      <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" className="flex-none text-text-muted" />
    </button>
  )
}

function SaveButton() {
  const { close } = useSheetStack()
  return (
    <Button size="sm" onClick={close}>
      Save
    </Button>
  )
}

function Blocked() {
  const { pop } = useSheetStack()
  return (
    <ul className={group}>
      {(["ryan-sullivan", "hannah-walsh"] as const).map(id => {
        const name = id === "ryan-sullivan" ? "Ryan Sullivan" : "Hannah Walsh"
        return (
          <li key={id} className={groupRow}>
            <Avatar src={avatar(id)} name={name} />
            <span className="min-w-0 flex-1 truncate">{name}</span>
            <Button size="sm" variant="ghost" onClick={pop}>
              Unblock
            </Button>
          </li>
        )
      })}
    </ul>
  )
}

export default function Demo() {
  const [mode, setMode] = useState<SheetStackMode>("auto")
  const values = useDialKit(
    "Sheet stack",
    {
      breakpoint: [640, 320, 960, 10],
      dismissible: true,
    },
    { id: "sheet-stack" },
  )

  return (
    <div className="grid w-full max-w-[46rem] gap-4">
      <SegmentedControl label="Presentation" options={modes} value={mode} onValueChange={value => setMode(value as SheetStackMode)} className="justify-self-center" />
      {/* The stack fills this stage instead of the page, and switches to dialogs when the stage is wide. */}
      <div className="relative h-[36rem] overflow-hidden supports-[overflow:clip]:overflow-clip rounded-surface bg-surface-muted">
        <SheetStack contained mode={mode} breakpoint={values.breakpoint}>
          <div className="grid h-full place-items-center content-center gap-3 p-6 text-center">
            <p className="m-0 max-w-xs text-sm text-text-secondary">Drill into settings. Each level keeps its parent in view; drag a sheet down to go back.</p>
            <SheetTrigger sheet="settings">Settings</SheetTrigger>
          </div>

          <Sheet id="settings" title="Settings" dismissible={values.dismissible}>
            <DrillRow sheet="profile">
              <Avatar src={avatar("emma-collins")} name="Emma Collins" className="size-11" />
              <span className="grid min-w-0 flex-1">
                <span className="truncate text-sm font-medium">Emma Collins</span>
                <span className="truncate text-xs text-text-secondary">Edit profile</span>
              </span>
            </DrillRow>
            <ul className={group}>
              <li className={groupRow}>
                <span className="grid min-w-0 flex-1">
                  <span className="text-sm">Mentions</span>
                  <span className="text-xs text-text-secondary">Email me when someone mentions me</span>
                </span>
                <Switch aria-label="Mentions" defaultChecked />
              </li>
              <li className={groupRow}>
                <span className="grid min-w-0 flex-1">
                  <span className="text-sm">Weekly summary</span>
                  <span className="text-xs text-text-secondary">A digest every Monday</span>
                </span>
                <Switch aria-label="Weekly summary" />
              </li>
            </ul>
          </Sheet>

          <Sheet id="profile" title="Edit profile" footer={<SaveButton />} dismissible={values.dismissible}>
            <div className="grid justify-items-center gap-2 py-2">
              <Avatar src={avatar("emma-collins")} name="Emma Collins" size="xl" />
            </div>
            <Input label="Name" defaultValue="Emma Collins" />
            <Input label="Email" type="email" defaultValue="emma@arc.dev" />
            <DrillRow sheet="blocked">
              <span className="min-w-0 flex-1 truncate text-sm">Blocked people</span>
            </DrillRow>
          </Sheet>

          <Sheet id="blocked" title="Blocked people" dismissible={values.dismissible}>
            <Blocked />
          </Sheet>
        </SheetStack>
      </div>
    </div>
  )
}
