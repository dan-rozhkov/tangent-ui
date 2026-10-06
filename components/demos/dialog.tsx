"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

const steps = [
  { title: "Invite your team", description: "Add people who should see this project." },
  { title: "Choose a role", description: "Editors can change content. Viewers can only read." },
  { title: "Send invites", description: "We email each person a link that expires in seven days." },
]

export default function Demo() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [step, setStep] = useState(0)

  return (
    <div className="flex flex-wrap gap-3">
      <Dialog>
        <DialogTrigger render={<Button>Rename</Button>} />
        <DialogContent title="Rename project" description="This changes the URL too.">
          <div className="grid gap-4">
            <Input label="Project name" defaultValue="Tangent" />
            <div className="flex justify-end gap-2">
              <DialogClose render={<Button variant="secondary">Cancel</Button>} />
              <DialogClose render={<Button>Save</Button>} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogTrigger render={<Button variant="danger">Delete project</Button>} />
        <DialogContent title="Delete project?" description="This cannot be undone.">
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button variant="secondary">Cancel</Button>} />
            <Button variant="danger" onClick={() => setConfirmOpen(false)}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => open && setStep(0)}>
        <DialogTrigger render={<Button variant="secondary">Invite</Button>} />
        <DialogContent title={steps[step].title} description={steps[step].description}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-text-muted">
              Step {step + 1} of {steps.length}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
              {step < steps.length - 1 ? (
                <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
              ) : (
                <DialogClose render={<Button>Send</Button>} />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
