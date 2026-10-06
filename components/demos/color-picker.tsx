"use client"

import { useState } from "react"

import { ColorPicker } from "@/components/ui/color-picker"
import type { ColorSwatch } from "@/components/ui/color-picker"

export default function Demo() {
  const [color, setColor] = useState("#2F6BFF")
  const [swatches, setSwatches] = useState<ColorSwatch[]>([
    { id: "ink", color: "#17171A" },
    { id: "sky", color: "#3A8DFF" },
  ])

  return (
    // The panel grows down and to the right from the swatch, so the demo leaves it room.
    <div className="min-h-[29rem] w-full max-w-[19rem]">
      <ColorPicker
        label="Accent"
        value={color}
        onValueChange={setColor}
        background="#FFFFFF"
        swatches={swatches}
        onSwatchesChange={setSwatches}
      />
    </div>
  )
}
