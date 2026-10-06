// Interaction scripts for scripts/record-demo.mjs. Each one drives a demo the way a person would, with pauses to watch the motion.

/** Moves the cursor to an element in a few steps, so the pointer path is visible, then clicks it. */
async function press(page, locator, { hold = 0 } = {}) {
  const box = await locator.boundingBox()
  if (!box) throw new Error(`Not visible: ${locator}`)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 })
  await page.waitForTimeout(150)
  await page.mouse.down()
  await page.waitForTimeout(hold || 90)
  await page.mouse.up()
}

const pause = (page, ms) => page.waitForTimeout(ms)

/** Centre of an element's box. */
async function center(locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error(`Not visible: ${locator}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box }
}

/** Presses on a point, moves through intermediate steps while held, and releases. Used for drag and press-hold gestures. */
async function dragPath(page, from, points, { hold = 350, steps = 22, settle = 250, release = true } = {}) {
  await page.mouse.move(from.x, from.y, { steps: 14 })
  await page.waitForTimeout(150)
  await page.mouse.down()
  await page.waitForTimeout(hold)
  for (const point of points) {
    await page.mouse.move(point.x, point.y, { steps })
    await page.waitForTimeout(settle)
  }
  if (release) await page.mouse.up()
}

/** Hover without pressing: moves the cursor onto the element in steps. */
async function hover(page, locator) {
  const { x, y } = await center(locator)
  await page.mouse.move(x, y, { steps: 18 })
}

/** Types into the focused field the way a person would. */
const type = (page, text) => page.keyboard.type(text, { delay: 70 })

export const scenarios = {
  "glass-tabbar": async page => {
    const stage = page.locator("main")
    const tab = name => stage.getByRole("tab", { name })
    await pause(page, 600)
    // Glide to a far tab and back through a near one, so lift, stretch and icon scale show.
    await press(page, tab("Profile"))
    await pause(page, 1300)
    await press(page, tab(/^Explore/))
    await pause(page, 1200)
    // Drag the lens across the bar and let it snap.
    const from = await center(tab(/^Explore/))
    const to = await center(tab("Profile"))
    await dragPath(page, from, [{ x: (from.x + to.x) / 2, y: from.y }, { x: to.x + 10, y: from.y }], { hold: 300, steps: 30, settle: 300 })
    await pause(page, 1200)
    // The search bubble takes its own lens.
    await press(page, tab("Search"))
    await pause(page, 1200)
    await press(page, tab("Home"))
    await pause(page, 1000)
    // Scroll the feed down: the bar folds into its compact pill; scroll up and it grows back.
    const feed = await center(stage.locator("[data-stage]"))
    await page.mouse.move(feed.x, feed.y - 120, { steps: 12 })
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 120); await pause(page, 90) }
    await pause(page, 1300)
    await press(page, tab(/^Saved/))
    await pause(page, 1300)
    await page.mouse.move(feed.x, feed.y - 120, { steps: 12 })
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -120); await pause(page, 90) }
    await pause(page, 1400)
  },

  "action-morph": async page => {
    const stage = page.locator("main")
    const fab = stage.getByRole("button", { name: /^Create/ })
    await press(page, fab)
    await pause(page, 1200)
    await press(page, stage.getByRole("menuitem", { name: /New task/ }))
    await pause(page, 900)
    await page.keyboard.type("Review the onboarding flow", { delay: 45 })
    await pause(page, 400)
    await press(page, stage.getByRole("radio", { name: "Tomorrow" }))
    await pause(page, 600)
    await press(page, stage.getByRole("button", { name: /^Add$/ }))
    await pause(page, 3200)
    // Second round through the keyboard: open, go to the note, back out with Escape.
    await press(page, fab)
    await pause(page, 900)
    await page.keyboard.press("ArrowDown")
    await pause(page, 500)
    await page.keyboard.press("Enter")
    await pause(page, 1000)
    await page.keyboard.press("Escape")
    await pause(page, 900)
    await page.keyboard.press("Escape")
    await pause(page, 1200)
  },

  "share-sheet": async page => {
    await press(page, page.getByRole("button", { name: "Share" }))
    await pause(page, 1200)
    await press(page, page.getByRole("button", { name: /Anyone at Northwind/ }))
    await pause(page, 900)
    await press(page, page.getByRole("option", { name: /Anyone with the link/ }))
    await pause(page, 900)
    await press(page, page.getByRole("button", { name: "Copy link" }))
    await pause(page, 1200)
    await press(page, page.getByRole("button", { name: "Slack" }))
    await pause(page, 1400)
    await press(page, page.getByRole("button", { name: "Emma Collins" }))
    await pause(page, 600)
    await press(page, page.getByRole("button", { name: "Marcus Johnson" }))
    await pause(page, 600)
    await press(page, page.getByRole("button", { name: "Olivia Bennett" }))
    await pause(page, 900)
    await press(page, page.getByRole("button", { name: /^Send to/ }))
    await pause(page, 2200)
    await page.keyboard.press("Escape")
    await pause(page, 1200)
  },

  "morph-nav": async page => {
    const nav = page.getByRole("navigation", { name: "Main navigation" })
    await hover(page, nav.getByRole("button", { name: "Product" }))
    await pause(page, 1500)
    await hover(page, nav.getByRole("button", { name: "Solutions" }))
    await pause(page, 1200)
    await hover(page, nav.getByRole("button", { name: "Resources" }))
    await pause(page, 1200)
    await hover(page, page.getByRole("link", { name: /^Docs/ }))
    await pause(page, 900)
    await hover(page, page.locator("main").getByText("Hover a section"))
    await pause(page, 1000)
    await press(page, nav.getByRole("button", { name: "Search" }))
    await pause(page, 1100)
    await type(page, "sched")
    await pause(page, 900)
    await page.keyboard.press("ArrowDown")
    await pause(page, 500)
    await page.keyboard.press("Enter")
    await pause(page, 1300)
    // Scroll the demo so the bar tightens, then back.
    await page.mouse.move(700, 600, { steps: 10 })
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 90); await pause(page, 90) }
    await pause(page, 1200)
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -90); await pause(page, 90) }
    await pause(page, 1200)
  },

  dock: async page => {
    const dock = page.getByRole("toolbar", { name: "Board tools" })
    await press(page, dock.getByRole("button", { name: /^Hand/ }))
    await pause(page, 800)
    await press(page, dock.getByRole("button", { name: /^Sticky note/ }))
    await pause(page, 800)
    // Open the Shapes tray, look through it, then pick another shape.
    await press(page, dock.getByRole("button", { name: /^Shapes/ }))
    await pause(page, 1400)
    await hover(page, page.getByRole("button", { name: /^Triangle/ }))
    await pause(page, 900)
    await hover(page, page.getByRole("button", { name: /^Ellipse/ }))
    await pause(page, 700)
    await press(page, page.getByRole("button", { name: /^Ellipse/ }))
    await pause(page, 1200)
    await press(page, dock.getByRole("button", { name: /^Comment/ }))
    await pause(page, 1200)
    // Drag Hand to the right to reorder the dock.
    const hand = await center(dock.getByRole("button", { name: /^Hand/ }))
    const text = await center(dock.getByRole("button", { name: /^Text/ }))
    await dragPath(page, hand, [{ x: hand.x + 30, y: hand.y }, { x: text.x + 20, y: text.y }], { hold: 250 })
    await pause(page, 1400)
    await press(page, dock.getByRole("button", { name: /^Move/ }))
    await pause(page, 1000)
  },

  "liquid-tab-bar": async page => {
    const nav = page.getByRole("tablist", { name: "Sections", exact: true })
    for (const name of [/^Saved/, /^Inbox/, /^Profile/, /^Home/]) {
      await press(page, nav.getByRole("tab", { name }))
      await pause(page, 1000)
    }
    const compact = page.getByRole("tablist", { name: "Compact sections" })
    for (const name of ["Library", "Search", "Home", "Radio"]) {
      await press(page, compact.getByRole("tab", { name }))
      await pause(page, 900)
    }
    // Drag across the bar.
    const from = await center(nav.getByRole("tab", { name: /^Saved/ }))
    const to = await center(nav.getByRole("tab", { name: /^Profile/ }))
    await dragPath(page, from, [{ x: to.x, y: to.y }, { x: from.x, y: from.y }], { hold: 200, steps: 30 })
    await pause(page, 1200)
  },

  "orbit-menu": async page => {
    const trigger = page.getByRole("button", { name: "Photo actions" })
    for (const name of ["Share with Ryan", "Add to album"]) {
      const from = await center(trigger)
      await page.mouse.move(from.x, from.y, { steps: 16 })
      await pause(page, 300)
      await page.mouse.down()
      await pause(page, 1300)
      const target = await center(page.getByRole("menuitem", { name }))
      await page.mouse.move(target.x, target.y, { steps: 20 })
      await pause(page, 900)
      await page.mouse.up()
      await pause(page, 2200)
    }
    // Hold, drag toward an action, then back out and release on nothing.
    const from = await center(trigger)
    await page.mouse.move(from.x, from.y, { steps: 10 })
    await page.mouse.down()
    await pause(page, 1300)
    const fav = await center(page.getByRole("menuitem", { name: "Favorite" }))
    await page.mouse.move(fav.x, fav.y, { steps: 20 })
    await pause(page, 700)
    await page.mouse.move(from.x, from.y + 60, { steps: 20 })
    await pause(page, 700)
    await page.mouse.up()
    await pause(page, 1500)
  },

  "booking-pill": async page => {
    const pill = page.getByRole("group", { name: "Book a table" })
    // The idle pill does not take pointer events in this build, so the first open goes through the keyboard.
    await pill.getByRole("button", { name: "Book a table" }).focus()
    await page.keyboard.press("Enter")
    await pause(page, 1200)
    await press(page, pill.getByRole("button", { name: "More guests" }))
    await pause(page, 500)
    await press(page, pill.getByRole("button", { name: "More guests" }))
    await pause(page, 800)
    await press(page, pill.getByRole("button", { name: /^Next, choose a date/ }))
    await pause(page, 1200)
    const slider = pill.getByRole("slider", { name: "Date" })
    await slider.focus()
    for (let i = 0; i < 3; i++) { await page.keyboard.press("ArrowRight"); await pause(page, 450) }
    await pause(page, 600)
    await press(page, pill.getByRole("button", { name: /^Next, choose a time/ }))
    await pause(page, 1200)
    await press(page, pill.getByRole("radio", { name: "8:00 PM" }))
    await pause(page, 800)
    await press(page, pill.getByRole("button", { name: "Review booking" }))
    await pause(page, 1500)
    await press(page, pill.getByRole("button", { name: /Confirm booking/ }))
    await pause(page, 3000)
  },

  "now-playing": async page => {
    const player = page.getByRole("region", { name: "Now playing" })
    await press(page, player.getByRole("button", { name: /^Play/ }))
    await pause(page, 1200)
    await press(page, player.getByRole("button", { name: "Next track" }))
    await pause(page, 1200)
    await press(page, player.getByRole("button", { name: /^Expand player/ }))
    await pause(page, 1500)
    const slider = player.getByRole("slider", { name: "Position" })
    const bar = await center(slider)
    await dragPath(page, { x: bar.box.x + bar.box.width * 0.2, y: bar.y }, [{ x: bar.box.x + bar.box.width * 0.7, y: bar.y }], { hold: 150 })
    await pause(page, 1200)
    await press(page, player.getByRole("button", { name: "Next track" }))
    await pause(page, 1500)
    await press(page, player.getByRole("button", { name: "Previous track" }))
    await pause(page, 1500)
    await press(page, player.getByRole("button", { name: /^Pause/ }))
    await pause(page, 900)
    await press(page, player.getByRole("button", { name: "Collapse player" }))
    await pause(page, 1500)
  },

  "sheet-stack": async page => {
    await press(page, page.getByRole("button", { name: "Sheets" }))
    await pause(page, 600)
    await press(page, page.getByRole("button", { name: "Settings", exact: true }))
    await pause(page, 1300)
    // If the sheet collapsed to zero height (seen in the dev build), stop here so the recording still finishes.
    if (!(await page.getByRole("dialog").boundingBox().then(box => box && box.height > 50))) {
      await pause(page, 2500)
      return
    }
    await press(page, page.getByRole("switch", { name: "Weekly summary" }))
    await pause(page, 800)
    await press(page, page.getByRole("button", { name: /Edit profile/ }))
    await pause(page, 1400)
    await press(page, page.getByRole("button", { name: /Blocked people/ }))
    await pause(page, 1400)
    // Drag the top sheet down by its title to dismiss it.
    let title = await center(page.getByRole("heading", { name: "Blocked people" }))
    await dragPath(page, title, [{ x: title.x, y: title.y + 120 }, { x: title.x, y: title.y + 330 }], { hold: 150, steps: 24, settle: 80 })
    await pause(page, 1400)
    title = await center(page.getByRole("heading", { name: "Edit profile" }))
    await dragPath(page, title, [{ x: title.x, y: title.y + 120 }, { x: title.x, y: title.y + 330 }], { hold: 150, steps: 24, settle: 80 })
    await pause(page, 1400)
    await press(page, page.getByRole("button", { name: "Close" }))
    await pause(page, 1200)
  },

  "wallet-stack": async page => {
    const cards = page.getByRole("group", { name: "Jordan's cards" })
    await press(page, cards.getByRole("button", { name: /Fieldnote/ }))
    await pause(page, 1800)
    await page.keyboard.press("Escape")
    await pause(page, 1200)
    await press(page, cards.getByRole("button", { name: /Northbank/ }))
    await pause(page, 1800)
    await page.keyboard.press("Escape")
    await pause(page, 1200)
    // Drag a card out of the stack and let it settle.
    const card = await center(cards.getByRole("button", { name: /Halo Reserve/ }))
    await dragPath(page, card, [{ x: card.x, y: card.y - 90 }, { x: card.x, y: card.y - 180 }], { hold: 150, steps: 24, settle: 200 })
    await pause(page, 1500)
    await page.keyboard.press("ArrowDown")
    await pause(page, 900)
    await page.keyboard.press("ArrowDown")
    await pause(page, 900)
    await page.keyboard.press("Enter")
    await pause(page, 1800)
    await page.keyboard.press("Escape")
    await pause(page, 1200)
  },

  "morph-loader": async page => {
    for (const name of ["Bars", "Ring", "Square", "Dots"]) {
      await press(page, page.getByRole("button", { name, exact: true }))
      await pause(page, 1500)
    }
    await press(page, page.getByRole("button", { name: "Succeed" }))
    await pause(page, 2800)
    await press(page, page.getByRole("button", { name: "Ring", exact: true }))
    await pause(page, 1300)
    await press(page, page.getByRole("button", { name: "Fail" }))
    await pause(page, 2800)
  },

  "confirm-morph": async page => {
    await press(page, page.getByRole("button", { name: "Delete" }))
    await pause(page, 1400)
    await press(page, page.getByRole("button", { name: "Cancel" }))
    await pause(page, 1400)
    await press(page, page.getByRole("button", { name: "Delete" }))
    await pause(page, 1200)
    await press(page, page.getByRole("group", { name: "Delete 3 files?" }).getByRole("button", { name: "Delete" }))
    await pause(page, 2200)
    const undo = page.getByRole("button", { name: /Undo/ })
    if (await undo.count()) { await press(page, undo.first()); await pause(page, 1800) }
    await press(page, page.getByRole("button", { name: "Revoke access" }))
    await pause(page, 1300)
    await press(page, page.getByRole("button", { name: "Revoke", exact: true }))
    await pause(page, 2500)
  },

  "morph-select": async page => {
    const zone = page.getByRole("combobox", { name: "Time zone" })
    await press(page, zone)
    await pause(page, 1400)
    await press(page, page.getByRole("option", { name: /New York/ }))
    await pause(page, 1500)
    const language = page.getByRole("combobox", { name: "Language", exact: true })
    await press(page, language)
    await pause(page, 1300)
    await type(page, "po")
    await pause(page, 1000)
    await page.keyboard.press("Enter")
    await pause(page, 1500)
    await press(page, language)
    await pause(page, 1200)
    await press(page, page.getByRole("option", { name: "Japanese" }))
    await pause(page, 1500)
  },

  "expandable-card": async page => {
    const card = page.getByRole("button", { name: /^Pro plan/ })
    await press(page, card)
    await pause(page, 1800)
    await press(page, card)
    await pause(page, 1500)
    await press(page, card)
    await pause(page, 1600)
    await press(page, card)
    await pause(page, 1400)
  },

  "expanding-search": async page => {
    await press(page, page.getByRole("button", { name: "Search projects and docs" }))
    await pause(page, 1400)
    await page.keyboard.press("ArrowDown")
    await pause(page, 600)
    await type(page, "motion")
    await pause(page, 1100)
    for (let i = 0; i < 6; i++) await page.keyboard.press("Backspace")
    await type(page, "col")
    await pause(page, 1000)
    await page.keyboard.press("Enter")
    await pause(page, 1800)
    await press(page, page.getByRole("button", { name: "Search projects and docs" }))
    await pause(page, 1200)
    await page.keyboard.press("Escape")
    await pause(page, 1200)
  },

  "user-menu": async page => {
    await press(page, page.getByRole("button", { name: /Account menu, Maya/ }))
    await pause(page, 1400)
    await page.keyboard.press("ArrowDown")
    await pause(page, 500)
    await page.keyboard.press("ArrowDown")
    await pause(page, 500)
    await page.keyboard.press("Escape")
    await pause(page, 1000)
    await press(page, page.getByRole("button", { name: /Account menu, Jonas/ }))
    await pause(page, 1400)
    const status = page.getByRole("menuitemradio").first()
    if (await status.count()) { await press(page, status); await pause(page, 1200) }
    await page.keyboard.press("Escape")
    await pause(page, 1000)
    await press(page, page.getByRole("button", { name: /Account menu, Maya/ }))
    await pause(page, 1000)
    await press(page, page.getByRole("menuitem", { name: /Sign out/ }))
    await pause(page, 2500)
  },

  "card-stack": async page => {
    const top = () => page.getByRole("group", { name: /of 6$/ }).first()
    let c = await center(top())
    await dragPath(page, c, [{ x: c.x + 120, y: c.y + 10 }, { x: c.x + 330, y: c.y + 30 }], { hold: 150, steps: 20 })
    await pause(page, 1200)
    c = await center(top())
    await dragPath(page, c, [{ x: c.x - 120, y: c.y + 10 }, { x: c.x - 330, y: c.y + 30 }], { hold: 150, steps: 20 })
    await pause(page, 1200)
    await press(page, page.getByRole("button", { name: "Shortlist" }))
    await pause(page, 1200)
    await press(page, page.getByRole("button", { name: "Skip" }))
    await pause(page, 1200)
    await press(page, page.getByRole("button", { name: "Undo" }))
    await pause(page, 1200)
    await page.keyboard.press("ArrowRight")
    await pause(page, 1000)
    // A short drag that does not pass the threshold springs back.
    c = await center(top())
    await dragPath(page, c, [{ x: c.x + 60, y: c.y }], { hold: 150, steps: 12 })
    await pause(page, 1200)
  },
}
