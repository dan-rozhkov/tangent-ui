"use client"

import { Ridgeline } from "@/components/ui/ridgeline"

/** A seeded generator keeps the sample data identical on the server and the client. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sample(seed: number, mean: number, spread: number, count = 80) {
  const random = seeded(seed)
  return Array.from({ length: count }, () => {
    const gauss =
      Array.from({ length: 6 }, random).reduce((sum, value) => sum + value, 0) -
      3
    return Math.round(mean + gauss * spread * 1.4)
  })
}

const regions = [
  { id: "fra", label: "Frankfurt", values: sample(11, 42, 7) },
  { id: "iad", label: "Virginia", values: sample(23, 58, 10) },
  { id: "sfo", label: "San Francisco", values: sample(37, 74, 12) },
  { id: "gru", label: "São Paulo", values: sample(41, 96, 16) },
  { id: "sin", label: "Singapore", values: sample(59, 118, 20) },
  { id: "syd", label: "Sydney", values: sample(67, 142, 24) },
]

export default function Demo() {
  return (
    <div className="w-full max-w-xl">
      <Ridgeline series={regions} label="API latency by region" unit=" ms" />
    </div>
  )
}
