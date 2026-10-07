import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const option = (name: string) => ctx.findByText(new RegExp(name), '[role="option"]')

  await ctx.wait(500)
  // The number formats itself as it is typed.
  const input = (await ctx.find('input[type="tel"]')) as HTMLInputElement
  await ctx.type(input, "7700900123", { delay: 90 })
  await ctx.wait(1300)

  // Switching country rolls the flag and reformats the number.
  await ctx.tap(await ctx.findByLabel(/^Country,/))
  await ctx.wait(1100)
  await ctx.tap(await option("United States"))
  await ctx.wait(1400)

  await ctx.tap(await ctx.findByLabel(/^Country,/))
  await ctx.wait(1000)
  await ctx.tap(await option("United Kingdom"))
  await ctx.wait(1300)
  input.blur()
  await ctx.wait(500)
}

export default script
