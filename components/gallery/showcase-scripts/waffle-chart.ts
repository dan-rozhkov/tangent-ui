import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  const grid = await ctx.find('[role="group"][aria-roledescription="waffle chart"]')
  const legend = await ctx.find("ul[aria-label$='categories']")
  const items = Array.from(legend.querySelectorAll<HTMLElement>("button"))
  // Let the cells finish pouring in.
  await ctx.wait(1500)

  // Hovering a legend row spotlights that category.
  for (const item of items.slice(0, 4)) {
    ctx.hover(item)
    await ctx.wait(750)
    ctx.unhover(item)
    ctx.unhover(legend)
  }
  await ctx.wait(300)

  // Sweep across the grid: the tooltip glides from cell to cell.
  const box = grid.getBoundingClientRect()
  const sweep = [
    [0.12, 0.85], [0.3, 0.6], [0.5, 0.4], [0.7, 0.3], [0.9, 0.2], [0.9, 0.75], [0.7, 0.9],
  ]
  for (const [fx, fy] of sweep) {
    const x = box.left + box.width * fx
    const y = box.top + box.height * fy
    for (const type of ["pointerover", "pointerenter", "pointermove"]) {
      grid.dispatchEvent(
        new PointerEvent(type, { bubbles: type !== "pointerenter", clientX: x, clientY: y, pointerType: "mouse", pointerId: 1, isPrimary: true }),
      )
    }
    await ctx.wait(550)
  }
  grid.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse", pointerId: 1 }))
  await ctx.wait(500)

  // Pin one category, then release.
  const pinned = items[Math.min(3, items.length - 1)]
  if (!pinned) return
  await ctx.tap(pinned)
  await ctx.wait(1500)
  await ctx.tap(pinned)
  await ctx.wait(800)
}

export default script
