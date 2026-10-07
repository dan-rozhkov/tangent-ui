import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

/** Replaces an input's text in one step, the way select-all and delete would. */
function clear(input: HTMLElement) {
  const prototype = input instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(input, "")
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

const script: AutoplayScript = async ctx => {
  const field = () => ctx.find("input, textarea")

  await ctx.wait(500)
  // Click the title to edit it; Escape rolls the change back.
  ctx.hover(await ctx.findByLabel(/^Project name:/))
  await ctx.wait(700)
  await ctx.tap(await ctx.findByLabel(/^Project name:/))
  await ctx.wait(700)
  await ctx.type(await field(), " (draft)", { delay: 60 })
  await ctx.wait(800)
  ctx.press("Escape", await field())
  await ctx.wait(1100)

  // An empty name is refused with an error.
  await ctx.tap(await ctx.findByLabel(/^Project name:/))
  await ctx.wait(500)
  clear(await field())
  ctx.press("Enter", await field())
  await ctx.wait(1400)

  // A valid one saves, with a pending state and a confirmation.
  await ctx.type(await field(), "Atlas v2", { delay: 70 })
  await ctx.wait(500)
  await ctx.tap(await ctx.findByLabel("Save project name"))
  await ctx.wait(2200)
}

export default script
