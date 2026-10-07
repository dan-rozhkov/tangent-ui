import { OpenMenuButton } from "@/components/gallery/open-menu-button"
import { SiteFooter } from "@/components/gallery/site-footer"
import { SiteHeader } from "@/components/gallery/site-header"
import { ShowcaseGrid } from "@/components/gallery/showcase-grid"
import { catalog } from "@/lib/catalog"

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-14 px-4 py-14 sm:px-6">
        <section className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <h1 className="font-display text-4xl leading-display font-medium tracking-display text-balance">
            React components with calm, physical motion
          </h1>
          <p className="max-w-xl text-lg text-pretty text-text-secondary">
            {catalog.length} components and blocks built on Base UI, Tailwind and Motion. Every demo is live: press, drag and scroll them.
          </p>
          <div>
            <OpenMenuButton />
          </div>
        </section>
        <section aria-label="In motion">
          <ShowcaseGrid />
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
