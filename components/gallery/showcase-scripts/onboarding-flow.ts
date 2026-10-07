import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const digits = async (text: string, gap = 170) => {
    for (const digit of text) {
      await ctx.tap(await ctx.findByLabel(digit))
      await ctx.wait(gap)
    }
  }
  // One button serves every step, and its label is morphing glyphs, so it is found by its marker rather than its words.
  const next = async () => {
    await ctx.wait(500)
    await ctx.tap(await ctx.find("[data-cta]"))
  }

  await ctx.wait(700)
  await next()
  await ctx.wait(1000)

  // Phone, typed on the keypad.
  await digits("5550123456")
  await next()
  await ctx.wait(1000)

  // Code.
  await digits("428193", 200)
  await next()
  await ctx.wait(1100)

  // Birthday: spin the year reel.
  const year = await ctx.find('[role="spinbutton"][aria-label="Year"]')
  await ctx.drag(year, { dy: 70, duration: 600 })
  await ctx.wait(800)
  await next()
  await ctx.wait(1100)

  // Name.
  await ctx.type(await ctx.find('input[autocomplete="given-name"]'), "Alex", { delay: 120 })
  await next()
  await ctx.wait(2200)

  await next()
  await ctx.wait(1600)
}

export default script
