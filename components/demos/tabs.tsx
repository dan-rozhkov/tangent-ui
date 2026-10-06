"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September"]

export default function Demo() {
  return (
    <div className="grid w-full max-w-md grid-cols-[minmax(0,1fr)] gap-12">
      <Tabs defaultValue="overview">
        <TabsList aria-label="Project">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <p>Harbour redesign ships the new booking flow and room pages. Twelve of eighteen tasks are done.</p>
        </TabsContent>
        <TabsContent value="activity">
          <ul className="grid gap-2">
            <li>Emma Collins updated the room gallery</li>
            <li>Marcus Johnson merged the checkout fixes</li>
            <li>Jasmine Brooks left feedback on pricing</li>
            <li>Olivia Bennett deployed to staging</li>
          </ul>
        </TabsContent>
        <TabsContent value="settings">
          <p>Only owners can change project settings.</p>
        </TabsContent>
      </Tabs>
      <Tabs defaultValue="March">
        <TabsList aria-label="Month">
          {months.map(month => (
            <TabsTrigger key={month} value={month} disabled={month === "August"}>
              {month}
            </TabsTrigger>
          ))}
        </TabsList>
        {months.map(month => (
          <TabsContent key={month} value={month}>
            Reports for {month}.
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
