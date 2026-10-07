import type { AutoplayContext, AutoplayScript } from "@/components/gallery/showcase-autoplay"

/** Press and drag out to an action, and release on it. */
async function fling(ctx: AutoplayContext, label: string) {
  const trigger = await ctx.find("button[aria-label='Photo actions']")
  // A small first pull opens the arc; the press stays down so the action positions can be measured.
  await ctx.drag(trigger, { dy: -12, duration: 160, release: false })
  const action = await ctx.findByLabel(label)
  // The arc flies out on a spring, so wait until the action stops moving before aiming at it.
  for (let steady = 0, last = ""; steady < 3; ) {
    await ctx.wait(150)
    const rect = JSON.stringify(action.getBoundingClientRect())
    steady = rect === last ? steady + 1 : 0
    last = rect
  }
  const from = trigger.getBoundingClientRect()
  const to = action.getBoundingClientRect()
  await ctx.drag(trigger, {
    dx: to.left + to.width / 2 - (from.left + from.width / 2),
    dy: to.top + to.height / 2 - (from.top + from.height / 2),
    duration: 650,
  })
  await ctx.wait(1900)
}

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  await fling(ctx, "Favorite")
  await fling(ctx, "Share with Ryan")
  await fling(ctx, "Add to album")
}

export default script
