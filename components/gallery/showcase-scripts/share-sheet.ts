import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // The trigger button grows into the sheet.
  await ctx.tap(await ctx.find("[data-trigger]"))
  await ctx.wait(1400)

  // Link access opens inside the card.
  await ctx.tap(await ctx.find("[data-access-trigger]"))
  await ctx.wait(1000)
  await ctx.tap(await ctx.findByText(/^Only invited people/, '[role="option"]'))
  await ctx.wait(1000)

  await ctx.tap(await ctx.findByText("Slack", '[role="group"][aria-label="Share to"] button'))
  await ctx.wait(1600)

  // Pick people: their avatars fly up into the recipient chips.
  const people = await ctx.find('[role="group"][aria-label="Recent people"]')
  const faces = Array.from(people.querySelectorAll<HTMLElement>("button"))
  for (const face of faces.slice(0, 3)) {
    await ctx.tap(face)
    await ctx.wait(650)
  }
  await ctx.wait(500)
  await ctx.tap(await ctx.findByLabel("Remove " + faces[1].getAttribute("aria-label")))
  await ctx.wait(800)

  await ctx.tap(await ctx.findByLabel(/^Send to /))
  await ctx.wait(2400)
  await ctx.tap(await ctx.findByText("Done", "button"))
  await ctx.wait(1300)
}

export default script
