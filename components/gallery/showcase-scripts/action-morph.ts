import type { AutoplayContext, AutoplayScript } from "@/components/gallery/showcase-autoplay"

async function compose(ctx: AutoplayContext, action: string, text: string, choice: string | null) {
  await ctx.tap(await ctx.find("[data-trigger]"))
  await ctx.wait(900)
  await ctx.tap(await ctx.findByText(action, "[role='menuitem'] *"))
  await ctx.wait(800)
  await ctx.type(await ctx.find("[data-field]"), text, { delay: 50 })
  await ctx.wait(350)
  if (choice) {
    await ctx.tap(await ctx.findByText(choice, "[role='radio'] span"))
    await ctx.wait(600)
  }
  await ctx.tap(await ctx.find("form button[type='submit']"))
  // The submit holds a beat, then the success check shows before the plus rotates back in.
  await ctx.findByLabel(/^Create\./)
  await ctx.wait(1700)
}

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  await compose(ctx, "New task", "Book the Lisbon flights", "Tomorrow")
  await compose(ctx, "New event", "Dinner with Emma", "Evening")
  await compose(ctx, "New note", "Ask about a late checkout", null)
}

export default script
