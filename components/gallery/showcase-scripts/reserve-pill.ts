import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(600)
  await ctx.tap(await ctx.findByText("Book a table", "button"))
  await ctx.wait(1100)

  // Party size.
  const more = await ctx.findByLabel("More guests")
  for (let i = 0; i < 3; i++) {
    await ctx.tap(more)
    await ctx.wait(450)
  }
  await ctx.wait(300)
  await ctx.tap(await ctx.findByLabel("Next, choose a date"))
  await ctx.wait(1100)

  // Date strip: swipe it, then settle with a key step.
  const strip = await ctx.find('[role="slider"][aria-label="Date"]')
  await ctx.drag(strip, { dx: -170, duration: 600 })
  await ctx.wait(900)
  await ctx.drag(strip, { dx: -90, duration: 500 })
  await ctx.wait(800)
  await ctx.tap(await ctx.findByLabel("Next, choose a time"))
  await ctx.wait(1200)

  // Time: pick a free seating (a taken one is aria-disabled).
  const times = await ctx.find('[role="radiogroup"][aria-label="Time"]')
  const slots = Array.from(times.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])'))
  const pick = slots[Math.min(slots.length - 1, 4)]
  if (pick) await ctx.tap(pick)
  await ctx.wait(900)
  await ctx.tap(await ctx.findByText("Review booking", "button"))
  await ctx.wait(1500)

  // Review and confirm.
  await ctx.tap(await ctx.findByText("Confirm booking"))
  await ctx.wait(2600)
}

export default script
