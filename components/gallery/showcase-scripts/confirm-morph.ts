import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const trigger = (name: string) => ctx.findByText(name, 'button[data-slot="trigger"]')
  const button = (name: string) => ctx.findByText(name, "button")

  await ctx.wait(500)
  // The button asks in place; Cancel folds it back.
  await ctx.tap(await trigger("Delete"))
  await ctx.wait(1300)
  await ctx.tap(await button("Cancel"))
  await ctx.wait(1000)
  // Confirm: working, done, then Undo reverses it.
  await ctx.tap(await trigger("Delete"))
  await ctx.wait(1000)
  await ctx.tap(await button("Delete"))
  await ctx.wait(2000)
  await ctx.tap(await button("Undo"))
  await ctx.wait(1700)
  await ctx.tap(await trigger("Revoke access"))
  await ctx.wait(1000)
  await ctx.tap(await button("Revoke"))
  await ctx.wait(2200)
}

export default script
