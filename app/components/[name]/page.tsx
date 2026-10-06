import { notFound } from "next/navigation"

import { DemoStage } from "@/components/gallery/demo-stage"
import { catalog } from "@/lib/catalog"

export function generateStaticParams() {
  return catalog.map(item => ({ name: item.name }))
}

export default async function ComponentPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const item = catalog.find(entry => entry.name === name)
  if (!item) notFound()
  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-medium tracking-display">{item.title}</h1>
        <p className="text-text-secondary">{item.description}</p>
      </header>
      <DemoStage name={item.name} />
    </article>
  )
}
