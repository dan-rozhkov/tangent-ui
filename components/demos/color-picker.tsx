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
    // The panel grows down and to the right from the swatch, so the box holds it. The swatch sits at the top left of
    // the box while it is narrow, and at the centre once the box is wide enough for the panel to stay inside it: the panel (19rem) is anchored at the swatch's left edge, so it
    // needs the swatch (about 126px) centred plus 304px to its right, which is 608px minus the swatch width, about 30.5rem.
    <div className="@container w-full">
      <div className="flex h-[28rem] items-start justify-start @[30.5rem]:justify-center">
        <ColorPicker
          label="Accent"
          value={color}
          onValueChange={setColor}
          background="#FFFFFF"
          swatches={swatches}
          onSwatchesChange={setSwatches}
        />
      </div>
    </div>
  )
}
