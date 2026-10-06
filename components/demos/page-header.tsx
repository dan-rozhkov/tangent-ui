"use client"

import { PageHeader } from "@/components/ui/page-header"

/* The block is its own page: a fixed header over a scroll container inside the frame, so scrolling the panel folds the header. */
export default function Demo() {
  return (
    <div className="w-full">
      <PageHeader />
    </div>
  )
}
