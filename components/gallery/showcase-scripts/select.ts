import type { AutoplayContext, AutoplayScript } from "@/components/gallery/showcase-autoplay"

/** Base UI opens the list on pointerdown, and the options take a plain click. */
async function choose(ctx: AutoplayContext, trigger: HTMLElement, name: string) {
  await ctx.pressTap(trigger)
  const option = await ctx.findByText(name, '[role="option"]', { global: true })
  await ctx.wait(900)
  ctx.click(option)
  await ctx.wait(1100)
}

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  await ctx.find('[role="combobox"]')
  const [region, plan] = Array.from(ctx.root.querySelectorAll<HTMLElement>('[role="combobox"]'))

  // The shown value rolls up or down depending on where the new option sits in the list.
  await choose(ctx, region, "South America")
  await choose(ctx, region, "United States")
  await choose(ctx, plan, "Pro")
  await choose(ctx, plan, "Team")
  await choose(ctx, region, "Europe")
}

export default script
