import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const board = (label: string) => ctx.find(`[aria-label="Board actions"] button[aria-label="${label}"]`)
  const tool = (label: string) => ctx.find(`[aria-label="Tools"] button[aria-label="${label}"]`)
  const touch = async (button: HTMLElement, rest = 1000) => {
    ctx.hover(button)
    await ctx.wait(600)
    await ctx.tap(button)
    await ctx.wait(rest)
    ctx.unhover(button)
  }

  await ctx.wait(500)
  // Labels slide open on hover; Undo and Redo enable and disable with the history.
  await touch(await board("Comment"), 700)
  await touch(await board("Undo"), 700)
  await touch(await board("Undo"), 900)
  await touch(await board("Redo"), 900)
  // Share swaps its label to Copied and back.
  await touch(await board("Share"), 1800)
  const present = '[aria-label="Board actions"] button[aria-label="Present"], [aria-label="Board actions"] button[aria-label="Stop"]'
  await touch(await ctx.find(present), 1300)
  await touch(await ctx.find(present), 1000)
  // The vertical rail.
  for (const name of ["Shape", "Text", "Zoom in", "Select"]) await touch(await tool(name), 600)
  await touch(await board("Comment"), 600)
  await ctx.wait(400)
}

export default script
