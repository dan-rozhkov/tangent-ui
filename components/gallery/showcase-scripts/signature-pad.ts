import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

type Pt = { x: number; y: number }

/** Catmull-Rom through the anchors, so the traced path is a smooth curve rather than a polyline. */
function smooth(anchors: Pt[], steps = 8): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < anchors.length - 1; i++) {
    const p0 = anchors[Math.max(0, i - 1)]
    const p1 = anchors[i]
    const p2 = anchors[i + 1]
    const p3 = anchors[Math.min(anchors.length - 1, i + 2)]
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      const t2 = t * t
      const t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) })
    }
  }
  out.push(anchors[anchors.length - 1])
  return out
}

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  const pad = await ctx.find('[role="img"][aria-roledescription="signature pad"]')
  const k = pad.getBoundingClientRect().width / 600
  const scaled = (points: Pt[]) => smooth(points).map(point => ({ x: point.x * k, y: point.y * k }))
  // Mouse pointers have no pressure, so the ink thins with speed: slow strokes stay full, quick ones taper.
  const draw = (points: Pt[], duration: number) => ctx.trace(pad, scaled(points), { duration, pointerType: "mouse" })

  // The capital E, drawn slowly.
  await draw(
    [
      { x: 150, y: 70 }, { x: 116, y: 62 }, { x: 90, y: 84 }, { x: 98, y: 112 }, { x: 134, y: 120 },
      { x: 92, y: 132 }, { x: 82, y: 164 }, { x: 112, y: 184 }, { x: 160, y: 168 },
    ],
    1000,
  )
  await ctx.wait(250)
  // "mm": a stem and four rounded humps, each dropping to the baseline.
  await draw(
    [
      { x: 182, y: 178 }, { x: 182, y: 140 }, { x: 184, y: 122 }, { x: 196, y: 108 }, { x: 212, y: 110 }, { x: 222, y: 128 },
      { x: 224, y: 156 }, { x: 224, y: 176 }, { x: 226, y: 150 }, { x: 228, y: 126 }, { x: 240, y: 108 }, { x: 256, y: 110 },
      { x: 266, y: 128 }, { x: 267, y: 156 }, { x: 268, y: 176 }, { x: 270, y: 150 }, { x: 274, y: 126 }, { x: 288, y: 108 },
      { x: 304, y: 110 }, { x: 312, y: 128 }, { x: 313, y: 156 }, { x: 314, y: 176 }, { x: 316, y: 150 }, { x: 320, y: 126 },
      { x: 334, y: 108 }, { x: 350, y: 110 }, { x: 358, y: 128 }, { x: 359, y: 156 }, { x: 360, y: 176 },
    ],
    1500,
  )
  await ctx.wait(200)
  // The a, then a trailing tail.
  await draw(
    [
      { x: 412, y: 124 }, { x: 392, y: 112 }, { x: 376, y: 128 }, { x: 378, y: 156 }, { x: 396, y: 172 },
      { x: 412, y: 150 }, { x: 414, y: 122 }, { x: 414, y: 160 }, { x: 424, y: 176 }, { x: 450, y: 166 }, { x: 480, y: 150 },
    ],
    800,
  )
  await ctx.wait(250)
  // A quick underline flourish, so the ink thins out.
  await draw([{ x: 96, y: 214 }, { x: 200, y: 224 }, { x: 330, y: 214 }, { x: 440, y: 190 }, { x: 500, y: 168 }], 450)
  await ctx.wait(900)

  // Undo and redo step through the strokes.
  await ctx.tap(await ctx.findByLabel("Undo"))
  await ctx.wait(800)
  await ctx.tap(await ctx.findByLabel("Redo"))
  await ctx.wait(800)

  // Replay writes the signature again at its real pace.
  await ctx.tap(await ctx.findByLabel("Replay signature"))
  await ctx.wait(4200)

  await ctx.tap(await ctx.findByText("Sign", "button"))
  await ctx.wait(800)
}

export default script
