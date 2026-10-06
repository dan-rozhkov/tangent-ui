"use client"

import { CommentThread, type CommentAuthor, type ThreadComment } from "@/components/ui/comment-thread"
import { avatar } from "@/lib/media"

const emma: CommentAuthor = { id: "emma", name: "Emma Collins", avatar: avatar("emma-collins") }
const marcus: CommentAuthor = { id: "marcus", name: "Marcus Johnson", avatar: avatar("marcus-johnson") }
const jasmine: CommentAuthor = { id: "jasmine", name: "Jasmine Brooks", avatar: avatar("jasmine-brooks") }
const daniel: CommentAuthor = { id: "daniel", name: "Daniel Kim", avatar: avatar("daniel-kim") }

const comments: ThreadComment[] = [
  {
    id: "c1",
    author: jasmine,
    body: "The headline wraps onto three lines on mobile. Can we get it down to two?",
    createdAt: "2h",
    reactions: [{ emoji: "👀", users: ["marcus", "daniel"] }],
    replies: [
      {
        id: "c2",
        author: marcus,
        body: "We could drop \"thoughtfully\". @Emma Collins, does that still read right?",
        createdAt: "1h",
        reactions: [{ emoji: "👍", users: ["jasmine"] }],
      },
      {
        id: "c3",
        author: emma,
        body: "Yes, shorter is better. I will update the copy doc.",
        createdAt: "45m",
        edited: true,
      },
    ],
  },
  {
    id: "c4",
    author: daniel,
    body: "Also worth checking the contrast on the dark hero image.",
    createdAt: "20m",
  },
]

export default function Demo() {
  return (
    <div className="w-full max-w-[460px]">
      <CommentThread
        title="Hero headline"
        currentUser={emma}
        people={[emma, marcus, jasmine, daniel]}
        defaultComments={comments}
      />
    </div>
  )
}
