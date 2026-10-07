import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(600)
  await ctx.tap(await ctx.findByText("Reserve a court", "button"))
  await ctx.wait(1100)

  // Player count.
  const more = await ctx.findByLabel("More players")
  for (let i = 0; i < 3; i++) {
    await ctx.tap(more)
    await ctx.wait(450)
  }
  await ctx.wait(300)
  await ctx.tap(await ctx.findByLabel("Next, choose a day"))
  await ctx.wait(1100)

  // Day strip: swipe it, then settle with a key step.
  const strip = await ctx.find('[role="slider"][aria-label="Day"]')
  await ctx.drag(strip, { dx: -170, duration: 600 })
  await ctx.wait(900)
  await ctx.drag(strip, { dx: -90, duration: 500 })
  await ctx.wait(800)
  await ctx.tap(await ctx.findByLabel("Next, choose a slot"))
  await ctx.wait(1200)

  // Slot: pick an open hour (a held one is aria-disabled).
  const hours = await ctx.find('[role="radiogroup"][aria-label="Slot"]')
  const slots = Array.from(hours.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])'))
  const pick = slots[Math.min(slots.length - 1, 4)]
  if (pick) await ctx.tap(pick)
  await ctx.wait(900)
  await ctx.tap(await ctx.findByText("Review reservation", "button"))
  await ctx.wait(1500)

  // Review and confirm.
  await ctx.tap(await ctx.findByText("Confirm reservation"))
  await ctx.wait(2600)
}

export default script
