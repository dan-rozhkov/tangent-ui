import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

/** Drags the divider both ways, taps the photo to spring it, steps it with the keys, then rests near the middle. */
const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  const handle = await ctx.find("[data-handle]")
  const frame = handle.closest<HTMLElement>("[data-frame-keep]") ?? ctx.root
  const width = () => frame.getBoundingClientRect().width

  await ctx.drag(handle, { dx: -width() * 0.38, duration: 1100 })
  await ctx.wait(500)
  await ctx.drag(handle, { dx: width() * 0.68, duration: 1500 })
  await ctx.wait(600)

  // A tap on the photo springs the divider to that point.
  await ctx.drag(frame, { from: { x: width() * 0.28, y: frame.clientHeight * 0.7 }, duration: 80 })
  await ctx.wait(1000)
  await ctx.drag(frame, { from: { x: width() * 0.74, y: frame.clientHeight * 0.7 }, duration: 80 })
  await ctx.wait(1000)

  for (let i = 0; i < 4; i++) {
    ctx.press("ArrowLeft", handle, { shiftKey: true })
    await ctx.wait(260)
  }
  await ctx.wait(500)
  ctx.press("Home", handle)
  await ctx.wait(1000)
  ctx.press("End", handle)
  await ctx.wait(1000)

  await ctx.drag(handle, { dx: width() * 0.5, duration: 1200 })
  await ctx.wait(400)
}

export default script
