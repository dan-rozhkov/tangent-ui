"use client"

import { useState } from "react"

import { Pagination } from "@/components/ui/pagination"

export default function Demo() {
  const [page, setPage] = useState(1)
  return <Pagination page={page} pageCount={12} onPageChange={setPage} />
}
