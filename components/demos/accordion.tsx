"use client"

import { Accordion } from "@/components/ui/accordion"

const faq = [
  { title: "Can I cancel anytime?", content: "Yes. Your plan stays active until the end of the billing period, and you keep access to everything you made." },
  { title: "Do you offer refunds?", content: "Within 14 days of purchase, no questions asked. Write to support and we will refund the full amount." },
  { title: "Can I switch plans later?", content: "Upgrades apply right away and are prorated. Downgrades take effect at the next renewal." },
  { title: "Is there a discount for teams?", content: "Teams of five or more get 20% off every seat. Education and nonprofit pricing is available on request." },
]

export default function Demo() {
  return (
    <div className="grid w-full max-w-xl gap-12">
      <Accordion items={faq} />
      <Accordion size="lg" defaultOpen={-1} items={faq.slice(0, 3)} />
    </div>
  )
}
