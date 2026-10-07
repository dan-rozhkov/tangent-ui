import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // Quick-add chips roll the digits up.
  for (const amount of ["5", "10", "20"]) {
    await ctx.tap(await ctx.findByLabel(`Add $${amount}`))
    await ctx.wait(900)
  }
  // Arrow keys nudge the amount by a step.
  const amount = await ctx.find('input[role="spinbutton"]')
  for (let step = 0; step < 3; step++) {
    ctx.press("ArrowUp", amount)
    await ctx.wait(350)
  }
  for (let step = 0; step < 3; step++) {
    ctx.press("ArrowDown", amount)
    await ctx.wait(350)
  }
  await ctx.wait(700)

  // The currency menu keeps the amount while it switches symbol.
  const currency = await ctx.findByLabel(/^Currency, /)
  await ctx.tap(currency)
  await ctx.wait(1000)
  const options = () => Array.from(ctx.root.ownerDocument.querySelectorAll<HTMLElement>('[role="option"]'))
  const other = options().find(option => option.getAttribute("aria-selected") !== "true")
  if (other) {
    await ctx.tap(other)
    await ctx.wait(1500)
    await ctx.tap(await ctx.findByLabel(/^Currency, /))
    await ctx.wait(900)
    const back = options().find(option => option.getAttribute("aria-selected") !== "true")
    if (back) await ctx.tap(back)
    await ctx.wait(1300)
  }
}

export default script
