"use client"

import { useState } from "react"
import { ChatCircleIcon, CircleIcon, ClipboardIcon, DiamondIcon, HandIcon, NavigationArrowIcon, SquareIcon, TextTIcon, TriangleIcon } from "@phosphor-icons/react"

import { Dock, type DockItem } from "@/components/ui/dock"

const initialItems: DockItem[] = [
  { id: "move", label: "Move", icon: <NavigationArrowIcon size={24} />, shortcut: "V" },
  { id: "hand", label: "Hand", icon: <HandIcon size={24} />, shortcut: "H" },
  {
    id: "shapes",
    label: "Shapes",
    icon: <SquareIcon size={24} />,
    items: [
      { id: "rect", label: "Rectangle", icon: <SquareIcon size={24} />, shortcut: "R" },
      { id: "ellipse", label: "Ellipse", icon: <CircleIcon size={24} />, shortcut: "O" },
      { id: "triangle", label: "Triangle", icon: <TriangleIcon size={24} />, shortcut: "Y" },
      { id: "diamond", label: "Diamond", icon: <DiamondIcon size={24} />, shortcut: "D" },
    ],
  },
  { id: "text", label: "Text", icon: <TextTIcon size={24} />, shortcut: "T" },
  { id: "sticky", label: "Sticky note", icon: <ClipboardIcon size={24} />, shortcut: "S" },
  { id: "comment", label: "Comment", icon: <ChatCircleIcon size={24} />, shortcut: "C", badge: 3 },
]

export default function Demo() {
  const [tool, setTool] = useState("move")
  const [items, setItems] = useState(initialItems)

  return (
    // The group tray opens upward from the bar, so the box keeps equal room above and below the bar and its hint.
    <div className="flex w-full max-w-[26rem] min-w-fit flex-col items-center gap-4 py-14">
      <Dock
        label="Board tools"
        items={items}
        value={tool}
        onValueChange={(id) => {
          setTool(id)
          if (id === "comment") setItems((current) => current.map((item) => (item.id === "comment" ? { ...item, badge: 0 } : item)))
        }}
        onItemsChange={(next) => setItems(next)}
      />
      <p className="max-w-full text-center text-sm text-balance text-text-secondary">
        Drag a tool, or hold Alt with the arrow keys, to reorder. Comments clear their badge when opened.
      </p>
    </div>
  )
}
