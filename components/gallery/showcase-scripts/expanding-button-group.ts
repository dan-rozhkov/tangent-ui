import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const action = (label: string) => ctx.find(`[role="toolbar"][aria-label="Message actions"] button[aria-label="${label}"]`)
  const toolbar = await ctx.findByLabel("Message actions")

  await ctx.wait(500)
  // The label opens under the pointer; a press runs the action and confirms.
  for (const name of ["Forward", "Archive", "Snooze"]) {
    const button = await action(name)
    ctx.hover(button)
    await ctx.wait(700)
    if (name !== "Forward") {
      await ctx.tap(button)
      await ctx.wait(1500)
    }
  }
  const remove = await action("Delete")
  ctx.hover(remove)
  await ctx.wait(700)
  await ctx.tap(remove)
  await ctx.wait(1500)
  ctx.unhover(remove)
  ctx.unhover(toolbar)
  // The compact group, with its disabled action refusing.
  const compact = (label: string) => ctx.find(`[aria-label="Compact message actions"] button[aria-label="${label}"]`)
  const archive = await compact("Archive")
  ctx.hover(archive)
  await ctx.wait(700)
  await ctx.tap(archive)
  await ctx.wait(1500)
  ctx.unhover(archive)
  const disabled = await compact("Delete")
  ctx.hover(disabled)
  await ctx.wait(800)
  ctx.unhover(disabled)
  await ctx.wait(900)
}

export default script
