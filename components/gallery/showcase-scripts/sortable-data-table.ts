import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const sortBy = (column: string) => ctx.findByLabel(new RegExp(`^Sort by ${column}`))
  const select = (name: string) => ctx.findByLabel(`Select ${name}`)

  await ctx.wait(500)
  // Rows glide to their new order.
  await ctx.tap(await sortBy("Budget"))
  await ctx.wait(1300)
  await ctx.tap(await sortBy("Budget"))
  await ctx.wait(1300)
  await ctx.tap(await sortBy("Owner"))
  await ctx.wait(1300)

  for (const name of ["Atlas", "Orchard", "Harbour"]) {
    ctx.click(await select(name))
    await ctx.wait(700)
  }
  await ctx.tap(await ctx.findByText("Clear selection", "button"))
  await ctx.wait(1000)
  await ctx.tap(await sortBy("Name"))
  await ctx.wait(1300)
}

export default script
