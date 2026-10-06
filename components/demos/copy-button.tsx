"use client"

import { CopyButton } from "@/components/ui/copy-button"

export default function Demo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <CopyButton value="npx shadcn@latest add @arc/copy-button" />
      <CopyButton value="https://tangent-ui.onrender.com" label="Copy link" />
      <CopyButton value="sk_live_51H8" label="Copy key" iconOnly />
      <CopyButton value="pnpm dlx arc" label="Copy command" variant="plain" />
      <CopyButton value="" label="Copy" disabled />
    </div>
  )
}
