import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // Start playback from the mini bar, then open the full player.
  await ctx.tap(await ctx.findByLabel(/^Play /))
  await ctx.wait(1200)
  await ctx.tap(await ctx.findByLabel(/^Expand player/))
  await ctx.wait(1800)

  // Scrub the waveform (a press seeks to where it lands), then step through tracks.
  const wave = await ctx.find('[role="slider"][aria-label="Position"]')
  const { width, height } = wave.getBoundingClientRect()
  await ctx.drag(wave, { from: { x: width * 0.55, y: height / 2 }, duration: 60 })
  await ctx.wait(1100)
  await ctx.drag(wave, { from: { x: width * 0.2, y: height / 2 }, duration: 60 })
  await ctx.wait(1000)
  await ctx.tap(await ctx.findByLabel("Next track"))
  await ctx.wait(1500)
  await ctx.tap(await ctx.findByLabel("Next track"))
  await ctx.wait(1500)
  await ctx.tap(await ctx.findByLabel("Previous track"))
  await ctx.wait(1500)

  // Pause and resume.
  await ctx.tap(await ctx.findByLabel(/^Pause /))
  await ctx.wait(900)
  await ctx.tap(await ctx.findByLabel(/^Play /))
  await ctx.wait(900)

  // Pull the artwork down to fold the player back into the bar.
  const art = await ctx.find("img[draggable='false']")
  await ctx.drag(art, { dy: 150, duration: 500 })
  await ctx.wait(1500)
}

export default script
