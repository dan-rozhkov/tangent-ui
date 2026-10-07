import type { AutoplayContext, AutoplayScript } from "@/components/gallery/showcase-autoplay"

/**
 * Opens a picker and chooses one entry. The menu mounts its items again once it has opened, so they are looked up
 * after it settles, right before the click.
 */
async function pick(ctx: AutoplayContext, label: string, item: RegExp, selector: string) {
  await ctx.tap(await ctx.findByLabel(new RegExp(`^${label}`)))
  await ctx.wait(900)
  ctx.click(await ctx.findByText(item, selector, { global: true }))
  await ctx.wait(800)
}

/** Types a task with a date and #list in the words, adds it, then picks the date and list from the menus by hand. */
const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  const input = (await ctx.find('input[aria-label="New task"]')) as HTMLInputElement

  await ctx.type(input, "Send email to Ana tomorrow #work", { delay: 60 })
  await ctx.wait(900)
  ctx.press("Enter", input)
  await ctx.wait(1100)

  await ctx.type(input, "Call the plumber", { delay: 60 })
  await ctx.wait(500)
  await pick(ctx, "Due date:", /^This weekend/, '[aria-label="Due date"] [role="menuitem"]')
  await pick(ctx, "List:", /^Personal$/, '[role="menuitemradio"]')
  await ctx.wait(100)
  ctx.press("Enter", input)
  await ctx.wait(1100)

  // Tick off the first task.
  await ctx.tap(await ctx.findByLabel(/^Complete Review the pricing page copy$/))
  await ctx.wait(800)
}

export default script
