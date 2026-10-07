import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const layout = (name: string) => ctx.findByText(name, '[role="group"][aria-label="Footer layout"] button')

  await ctx.wait(500)
  // Newsletter: a bad address gets an inline error, a good one subscribes.
  const email = (await ctx.find('input[type="email"]')) as HTMLInputElement
  await ctx.type(email, "ana@studio", { delay: 55 })
  await ctx.wait(500)
  await ctx.tap(await ctx.findByText("Subscribe", "button"))
  await ctx.wait(1400)
  await ctx.type(email, ".dev", { delay: 55 })
  await ctx.wait(500)
  await ctx.tap(await ctx.findByText("Subscribe", "button"))
  await ctx.wait(2200)

  // The frame springs between the three layouts.
  await ctx.tap(await layout("Minimal"))
  await ctx.wait(1500)
  await ctx.tap(await layout("Logo"))
  await ctx.wait(2200)
  await ctx.tap(await layout("Columns"))
  await ctx.wait(1500)
}

export default script
