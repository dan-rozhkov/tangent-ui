"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { SignaturePad, signatureToSvg, type InkStroke } from "@/components/ui/signature-pad"

export default function Demo() {
  const [strokes, setStrokes] = useState<InkStroke[]>([])
  const [signed, setSigned] = useState(false)

  return (
    <form
      className="grid w-full max-w-[520px] gap-4"
      onSubmit={event => {
        event.preventDefault()
        // A real form would send this SVG to the server.
        setSigned(signatureToSvg(strokes).length > 0)
      }}
    >
      <SignaturePad
        signer="Emma Collins"
        fileName="emma-signature"
        onChange={next => {
          setStrokes(next)
          setSigned(false)
        }}
      />
      <Button type="submit" disabled={!strokes.length} className="justify-self-start">
        {signed ? "Signed" : "Sign"}
      </Button>
    </form>
  )
}
