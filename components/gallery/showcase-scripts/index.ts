import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

/** Loaded with the tile, so a script ships only alongside the demo it drives. */
export const showcaseScripts: Record<string, () => Promise<{ default: AutoplayScript }>> = {
  "action-morph": () => import("./action-morph"),
  "orbit-menu": () => import("./orbit-menu"),
  "wallet-stack": () => import("./wallet-stack"),
  "card-stack": () => import("./card-stack"),
  "cover-flow": () => import("./cover-flow"),
  "liquid-tab-bar": () => import("./liquid-tab-bar"),
  "swipe-actions": () => import("./swipe-actions"),
  "dock": () => import("./dock"),
  "now-playing": () => import("./now-playing"),
  "booking-pill": () => import("./booking-pill"),
  "voice-chat": () => import("./voice-chat"),
  "radio-cards": () => import("./radio-cards"),
  "toolbar-menu": () => import("./toolbar-menu"),
  "chip-group": () => import("./chip-group"),
  "task-input": () => import("./task-input"),
  "image-compare": () => import("./image-compare"),
  "signature-pad": () => import("./signature-pad"),
  "waffle-chart": () => import("./waffle-chart"),
  "morph-loader": () => import("./morph-loader"),
  "billing-toggle": () => import("./billing-toggle"),
}
