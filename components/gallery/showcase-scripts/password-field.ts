import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  const input = (await ctx.find("input")) as HTMLInputElement
  await ctx.type(input, "Sunny-Harbor-42", { delay: 80 })
  await ctx.wait(900)

  // The eye morphs open and the text shows.
  await ctx.tap(await ctx.findByLabel("Show password"))
  await ctx.wait(1500)
  await ctx.tap(await ctx.findByLabel("Hide password"))
  await ctx.wait(1300)
  input.blur()
  await ctx.wait(500)
}

export default script
