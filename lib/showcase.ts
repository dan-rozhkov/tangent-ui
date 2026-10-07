// Single place to switch the showcase media to a CDN later.
export const SHOWCASE_BASE = "/showcase"

export const showcase = [
  "glass-tabbar",
  "action-morph",
  "morph-nav",
  "dock",
  "liquid-tab-bar",
  "orbit-menu",
  "share-sheet",
  "now-playing",
  "sheet-stack",
  "wallet-stack",
  "card-stack",
  "booking-pill",
]

export const showcaseSrc = (name: string, theme: "light" | "dark", ext: "mp4" | "jpg") => `${SHOWCASE_BASE}/${name}-${theme}.${ext}`
