"use client"

import { NewsletterSignupBlock } from "@/components/ui/newsletter-signup"

/* Subscribing is simulated; the block's own switch makes the next send fail. */
export default function Demo() {
  return <NewsletterSignupBlock />
}
