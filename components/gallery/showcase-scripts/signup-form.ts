import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // Submitting empty shows every error at once.
  await ctx.tap(await ctx.findByText("Create account", "button"))
  await ctx.wait(1200)

  const field = (name: string) => ctx.find(`input[name="${name}"]`) as Promise<HTMLInputElement>
  await ctx.type(await field("name"), "Jasmine Brooks", { delay: 45 })
  await ctx.wait(300)
  await ctx.type(await field("email"), "jasmine@northwind.studio", { delay: 35 })
  await ctx.wait(500)
  // The strength meter fills as the password grows.
  const password = await field("password")
  await ctx.type(password, "tangent", { delay: 70 })
  await ctx.wait(800)
  await ctx.type(password, "-Ui2026!", { delay: 70 })
  await ctx.wait(900)
  await ctx.tap(await ctx.find('[role="checkbox"]'))
  await ctx.wait(800)

  await ctx.tap(await ctx.findByText("Create account", "button"))
  await ctx.wait(3000)
  await ctx.tap(await ctx.findByText("Start over", "button"))
  await ctx.wait(1500)
}

export default script
