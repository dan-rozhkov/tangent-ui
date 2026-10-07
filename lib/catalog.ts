// Catalog of every component and block shown in the gallery.
export type CatalogItem = { name: string; title: string; description: string; category: string; kind: "component" | "block" }

/** Category order and display labels, shared by the sidebar and the search palette. */
export const categories = ["original", "actions", "inputs", "disclosure", "data", "feedback", "text", "special", "blocks"]
export const categoryLabel = (category: string) => (category === "original" ? "Signature" : category[0].toUpperCase() + category.slice(1))

/** Our own implementations of signature components. */

export const catalog: CatalogItem[] = [
  {
    "name": "button",
    "title": "Button",
    "description": "A clear, responsive action with quiet secondary states.",
    "category": "actions",
    "kind": "component"
  },
  {
    "name": "action-button",
    "title": "Action button",
    "description": "A compact button for frequent toolbar actions.",
    "category": "actions",
    "kind": "component"
  },
  {
    "name": "split-button",
    "title": "Split button",
    "description": "A primary action with a menu of nearby alternatives.",
    "category": "actions",
    "kind": "component"
  },
  {
    "name": "button-group",
    "title": "Button group",
    "description": "Related actions joined into one surface with hairline dividers: a hover highlight glides between segments, the pressed one answers in place, and an attached menu can close the row.",
    "category": "actions",
    "kind": "component"
  },
  {
    "name": "floating-button-group",
    "title": "Floating button group",
    "description": "Separate soft buttons in a quiet tray, with one shared highlight that morphs from button to button as you move, and a pressed state that settles in place.",
    "category": "actions",
    "kind": "component"
  },
  {
    "name": "expanding-button-group",
    "title": "Expanding button group",
    "description": "Icon buttons in a compact group: the one you point at or focus grows to reveal its label while its neighbours slide aside, and an action confirms in place.",
    "category": "actions",
    "kind": "component"
  },
  {
    "name": "dropdown-menu",
    "title": "Dropdown menu",
    "description": "A focused list of actions anchored to a trigger.",
    "category": "actions",
    "kind": "component"
  },
  {
    "name": "context-menu",
    "title": "Context menu",
    "description": "Secondary actions kept close to the selected object.",
    "category": "actions",
    "kind": "component"
  },
  {
    "name": "copy-button",
    "title": "Copy button",
    "description": "Copy a value with immediate confirmation.",
    "category": "actions",
    "kind": "component"
  },
  {
    "name": "drawer",
    "title": "Drawer",
    "description": "A temporary side surface for focused work.",
    "category": "disclosure",
    "kind": "component"
  },
  {
    "name": "theme-switch",
    "title": "Theme switcher",
    "description": "Four smooth ways to move between light and dark appearance.",
    "category": "actions",
    "kind": "component"
  },
  {
    "name": "theme-switch-eclipse",
    "title": "Eclipse",
    "description": "The next appearance crosses the page like an eclipse.",
    "category": "actions",
    "kind": "component"
  },
  {
    "name": "theme-switch-split",
    "title": "Split",
    "description": "The next appearance opens from a slim center seam.",
    "category": "actions",
    "kind": "component"
  },
  {
    "name": "theme-switch-rise",
    "title": "Rise",
    "description": "The next appearance rises into place.",
    "category": "actions",
    "kind": "component"
  },
  {
    "name": "avatar",
    "title": "Avatar",
    "description": "A compact identity marker for people and accounts.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "avatar-group",
    "title": "Avatar group",
    "description": "Show a team or set of contributors in a small space.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "input",
    "title": "Input",
    "description": "A single line field with clear labels and useful states.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "textarea",
    "title": "Textarea",
    "description": "A multiline field for notes, descriptions, and longer text.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "select",
    "title": "Select",
    "description": "A compact choice field with a keyboard friendly menu.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "combobox",
    "title": "Combobox",
    "description": "Search and select from a list without leaving the field.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "checkbox",
    "title": "Checkbox",
    "description": "A binary choice with a precise, legible state.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "switch",
    "title": "Switch",
    "description": "A tactile toggle for settings that take effect immediately.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "multi-select",
    "title": "Multi-select",
    "description": "Select several values while keeping the field readable.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "number-field",
    "title": "Number field",
    "description": "Enter a bounded number with clear increment controls.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "password-field",
    "title": "Password field",
    "description": "Capture sensitive text with a visible reveal control.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "search-field",
    "title": "Search field",
    "description": "A recognizable search entry point with clear affordances.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "tag-input",
    "title": "Tag input",
    "description": "Turn short text values into removable tags.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "file-dropzone",
    "title": "File dropzone",
    "description": "A generous target for dropping one or more files.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "radio-group",
    "title": "Radio group",
    "description": "Choose one option from a visible set.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "segmented-control",
    "title": "Segmented control",
    "description": "Switch between a small set of related views.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "calendar",
    "title": "Calendar",
    "description": "Browse dates in a clear, compact month view.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "date-picker",
    "title": "Date picker",
    "description": "Choose a date without losing context.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "time-picker",
    "title": "Time picker",
    "description": "Choose a time with sensible keyboard behavior.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "accordion",
    "title": "Accordion",
    "description": "Progressively reveal supporting information in place.",
    "category": "disclosure",
    "kind": "component"
  },
  {
    "name": "dialog",
    "title": "Dialog",
    "description": "A focused surface for decisions that need attention.",
    "category": "disclosure",
    "kind": "component"
  },
  {
    "name": "popover",
    "title": "Popover",
    "description": "A small anchored surface for contextual information.",
    "category": "disclosure",
    "kind": "component"
  },
  {
    "name": "tooltip",
    "title": "Tooltip",
    "description": "Short supporting text for unfamiliar controls.",
    "category": "disclosure",
    "kind": "component"
  },
  {
    "name": "tabs",
    "title": "Tabs",
    "description": "Switch between related content in the same context.",
    "category": "disclosure",
    "kind": "component"
  },
  {
    "name": "expandable-card",
    "title": "Expandable card",
    "description": "Give a dense card more room when requested.",
    "category": "disclosure",
    "kind": "component"
  },
  {
    "name": "breadcrumb",
    "title": "Breadcrumb",
    "description": "Show where a page sits in a hierarchy.",
    "category": "disclosure",
    "kind": "component"
  },
  {
    "name": "alert",
    "title": "Alert",
    "description": "A persistent message that helps people recover or continue.",
    "category": "feedback",
    "kind": "component"
  },
  {
    "name": "toast",
    "title": "Toast",
    "description": "Brief confirmation for a completed background action.",
    "category": "feedback",
    "kind": "component"
  },
  {
    "name": "progress",
    "title": "Progress",
    "description": "Show how much of a known task is complete.",
    "category": "feedback",
    "kind": "component"
  },
  {
    "name": "skeleton",
    "title": "Skeleton",
    "description": "Reserve space while content is still loading.",
    "category": "feedback",
    "kind": "component"
  },
  {
    "name": "badge",
    "title": "Badge",
    "description": "A small label for status, category, or metadata.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "card",
    "title": "Card",
    "description": "A contained group of related content and actions.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "metric-card",
    "title": "Metric card",
    "description": "A compact summary for a number that needs context.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "empty-state",
    "title": "Empty state",
    "description": "A useful next step when there is nothing to show yet.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "tree-view",
    "title": "Tree view",
    "description": "Navigate nested folders and structured content.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "pagination",
    "title": "Pagination",
    "description": "Move through a long collection with clear bounds.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "filter-toolbar",
    "title": "Filter toolbar",
    "description": "Keep collection filters close and easy to reset.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "sortable-data-table",
    "title": "Sortable data table",
    "description": "Compare structured records with sortable columns.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "sparkline",
    "title": "Sparkline",
    "description": "Show a compact trend beside a value.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "gauge",
    "title": "Gauge",
    "description": "Show a value against a known range.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "animated-counter",
    "title": "Animated counter",
    "description": "Give changing totals a clear sense of movement.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "code-block",
    "title": "Code block",
    "description": "Present code with legible hierarchy and copy access.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "text-reveal",
    "title": "Text reveal",
    "description": "Reveal a short piece of content with restrained motion.",
    "category": "text",
    "kind": "component"
  },
  {
    "name": "in-view-title",
    "title": "In-view title",
    "description": "Bring a section title in as it scrolls into view.",
    "category": "text",
    "kind": "component"
  },
  {
    "name": "text-morph",
    "title": "Text morph",
    "description": "Morph a label into its next state, letter by letter.",
    "category": "text",
    "kind": "component"
  },
  {
    "name": "text-shimmer",
    "title": "Text shimmer",
    "description": "Show ongoing work with a calm light across the words.",
    "category": "text",
    "kind": "component"
  },
  {
    "name": "hold-to-confirm",
    "title": "Hold to confirm",
    "description": "Confirm a destructive action by holding, not tapping.",
    "category": "actions",
    "kind": "component"
  },
  {
    "name": "swipe-actions",
    "title": "Swipe actions",
    "description": "Reveal row actions with a swipe, or from the same actions in a menu.",
    "category": "actions",
    "kind": "component"
  },
  {
    "name": "slider",
    "title": "Slider",
    "description": "Pick a value or a range on a track that follows your finger.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "inline-edit",
    "title": "Inline edit",
    "description": "Rename in place: the text becomes a field without moving.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "expanding-search",
    "title": "Expanding search",
    "description": "An icon that morphs into a search field with results beneath it.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "chip-group",
    "title": "Chip group",
    "description": "Filter by a few facets with chips that morph as you pick them.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "password-strength",
    "title": "Password strength",
    "description": "Show how strong a new password is while it is typed.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "bottom-sheet",
    "title": "Bottom sheet",
    "description": "A sheet that rests at a peek or full height and follows your finger.",
    "category": "disclosure",
    "kind": "component"
  },
  {
    "name": "hover-card",
    "title": "Hover card",
    "description": "Preview a person or link on hover or focus without leaving the page.",
    "category": "disclosure",
    "kind": "component"
  },
  {
    "name": "resizable-panels",
    "title": "Resizable panels",
    "description": "Trade space between panes by dragging the divider between them.",
    "category": "disclosure",
    "kind": "component"
  },
  {
    "name": "toast-stack",
    "title": "Toast stack",
    "description": "Stack short results at the edge until you reach for them.",
    "category": "feedback",
    "kind": "component"
  },
  {
    "name": "usage-meter",
    "title": "Usage meter",
    "description": "Show what fills an allowance and how close it is to the limit.",
    "category": "feedback",
    "kind": "component"
  },
  {
    "name": "image-compare",
    "title": "Image compare",
    "description": "Drag a divider across two images to see what changed.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "carousel",
    "title": "Carousel",
    "description": "Browse a row of slides by dragging, flicking, or arrowing through them.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "card-stack",
    "title": "Card stack",
    "description": "Review a deck one card at a time, with a throw and an undo.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "bar-chart",
    "title": "Bar chart",
    "description": "Compare one measure across days and scrub any bar for its value.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "activity-heatmap",
    "title": "Activity heatmap",
    "description": "See a year of activity at a glance, one square per day.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "timeline",
    "title": "Timeline",
    "description": "Follow what happened, newest first, grouped by day.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "user-menu",
    "title": "User menu",
    "description": "Your account, settings, theme, and sign out behind the avatar. Opens as a bottom sheet on phones.",
    "category": "actions",
    "kind": "component"
  },
  {
    "name": "stepper",
    "title": "Stepper",
    "description": "Show where a person is in a multi-step flow and what is done.",
    "category": "feedback",
    "kind": "component"
  },
  {
    "name": "signature-pad",
    "title": "Signature pad",
    "description": "Smooth ink that thins with speed, with undo, replay, and PNG or SVG export.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "date-range-picker",
    "title": "Date range picker",
    "description": "A range picker that grows from its trigger into two months with presets and a stretching range highlight.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "color-picker",
    "title": "Color picker",
    "description": "A swatch that grows into a picker with format morphing, eyedropper, saved swatches, and contrast readout.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "morph-select",
    "title": "Morph select",
    "description": "A select whose trigger grows into the list, with a gliding highlight and type-ahead.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "line-chart",
    "title": "Line chart",
    "description": "A multi-series line chart with a gliding crosshair, legend toggles, and paths that morph between ranges.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "donut-chart",
    "title": "Donut chart",
    "description": "A donut whose arcs morph between datasets, with the active value rolling into the center.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "streamgraph",
    "title": "Streamgraph",
    "description": "Layered streams on a wiggle baseline that morph between ranges, with a layer you can isolate and read week by week.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "brush-chart",
    "title": "Brush chart",
    "description": "A dense time series with an overview strip: drag a window to zoom, resize it by its handles, and read events in place.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "ridgeline",
    "title": "Ridgeline",
    "description": "Overlapping distributions, one ridge per group: hover to lift a ridge and read its quartiles, switch datasets and every curve morphs.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "treemap",
    "title": "Treemap",
    "description": "A squarified treemap: click to drill and the tiles grow to fill the view, with a breadcrumb back and metrics that morph every tile.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "waffle-chart",
    "title": "Waffle chart",
    "description": "A ten by ten unit chart where every cell is one percent, and cells fly to their new group when the data changes.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "slope-chart",
    "title": "Slope chart",
    "description": "Before and after on two axes: lines draw in, rank moves sit beside each value, and switching datasets slides every line to its new slope.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "countdown",
    "title": "Countdown",
    "description": "A launch countdown with rolling digits that morphs into a live state at zero.",
    "category": "feedback",
    "kind": "component"
  },
  {
    "name": "announcement-bar",
    "title": "Announcement bar",
    "description": "A top banner that rotates messages, counts down, and collapses smoothly when dismissed.",
    "category": "feedback",
    "kind": "component"
  },
  {
    "name": "json-viewer",
    "title": "JSON viewer",
    "description": "A collapsible JSON tree with search, paging for long arrays, and copy value or path.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "phone-input",
    "title": "Phone input",
    "description": "A phone field with a country picker, formatting as you type, and E.164 output.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "money-input",
    "title": "Money input",
    "description": "A currency field with live grouping, stable width, rolling digits, and minor-unit output.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "shortcut-recorder",
    "title": "Shortcut recorder",
    "description": "Record key combinations into key caps, with conflict warnings, Kbd, and a searchable cheatsheet.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "confirm-morph",
    "title": "Confirm morph",
    "description": "A destructive button that morphs into an inline confirmation, a spinner, and a result with undo.",
    "category": "actions",
    "kind": "component"
  },
  {
    "name": "mention-input",
    "title": "Mention input",
    "description": "A textarea with @people and #channel mentions that act as single tokens, with suggestions at the caret.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "chat-thread",
    "title": "Chat thread",
    "description": "A chat thread with grouped messages, reactions, read receipts, typing, and a composer with attachments.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "rich-text-editor",
    "title": "Rich text editor",
    "description": "A lightweight editor with markdown shortcuts, a floating toolbar, a slash menu, and HTML and markdown output.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "billing-toggle",
    "title": "Billing toggle",
    "description": "A monthly and yearly switch with a savings badge and prices that roll to the new amount.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "scroll-area",
    "title": "Scroll area",
    "description": "A native scroll container with thin overlay scrollbars and edge fades that appear only when content overflows.",
    "category": "disclosure",
    "kind": "component"
  },
  {
    "name": "radio-cards",
    "title": "Radio cards",
    "description": "Selectable option cards with a sliding selection ring, price and description slots, and radio keyboard behavior.",
    "category": "inputs",
    "kind": "component"
  },
  {
    "name": "comment-thread",
    "title": "Comment thread",
    "description": "Threaded comments with replies, reactions, mentions, inline edit, and resolve.",
    "category": "data",
    "kind": "component"
  },
  {
    "name": "slot-text",
    "title": "Slot text",
    "description": "Text and numbers that spin into their new value on staggered slot machine reels.",
    "category": "special",
    "kind": "component"
  },
  {
    "name": "signup-form",
    "title": "Sign up form",
    "description": "An account creation flow with field validation, password strength, and a clear completion state.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "logo-marquee",
    "title": "Logo marquee",
    "description": "A quiet, continuously moving row of brand marks with a pause control.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "plan-comparison",
    "title": "Plan comparison",
    "description": "Compare meaningful differences between plans and billing periods.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "command-palette",
    "title": "Command palette",
    "description": "A complete keyboard driven action surface with search, grouped results, and shortcuts.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "notification-center",
    "title": "Notification center",
    "description": "A home for updates with read state, grouped information, and animated disclosure.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "file-upload",
    "title": "File upload",
    "description": "A complete file selection flow with constraints, progress, and error feedback.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "otp-input",
    "title": "OTP input",
    "description": "A six digit verification flow with paste support and keyboard navigation.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "changelog-feed",
    "title": "Changelog feed",
    "description": "Release notes you can filter, open in place, and scroll through month by month.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "sign-in",
    "title": "Sign in",
    "description": "A sign in card that morphs from email to a six digit code to your account.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "page-header",
    "title": "Page header",
    "description": "A project page header that folds into a compact bar as you scroll, with tabs whose counts roll.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "empty-states",
    "title": "Empty states",
    "description": "Four empty states in one illustration whose shapes morph between scenes as you switch tabs.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "login-centered",
    "title": "Centered login",
    "description": "A passkey-first login card on a quiet ring backdrop that morphs through email and code.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "site-header",
    "title": "Site header",
    "description": "A sticky website header that turns solid on scroll, with a gliding active link, mega menu panels, and a mobile sheet.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "site-footer",
    "title": "Site footer",
    "description": "A website footer with link columns and newsletter, a minimal layout, and a large fading brand mark.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "hero-section",
    "title": "Hero section",
    "description": "Three full screen SaaS heroes: a live dashboard rising from the bottom edge over a drifting mesh, a workflow graph that routes sample events node by node, and editorial type over a mesh gradient.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "faq-section",
    "title": "FAQ section",
    "description": "FAQs as an accordion, a topic rail, or a searchable list that highlights matches.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "contact-section",
    "title": "Contact section",
    "description": "A validated contact form that morphs into a confirmation, support channels, and office cards with local times.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "blog-grid",
    "title": "Blog grid",
    "description": "A blog index with a featured post, category filter, post cards, pagination and an in-place reader.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "comparison-table",
    "title": "Comparison table",
    "description": "An us versus them table with a sticky header, a highlighted column, and a stacked phone view.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "stats-band",
    "title": "Stats band",
    "description": "Headline numbers that count up in view, each with a tiny visual that proves it and a context line on hover, plain or in a hairline grid.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "cta-section",
    "title": "CTA section",
    "description": "A call to action as a centered closing section, a split beside a setup card that completes itself, or a dismissible banner.",
    "category": "blocks",
    "kind": "block"
  },
  {
    "name": "newsletter-signup",
    "title": "Newsletter signup",
    "description": "An email signup framed by a stack of past issues; subscribing drops the next issue, addressed to you, onto the front.",
    "category": "blocks",
    "kind": "block"
  },
  {"name": "compose-fab", "title": "Compose FAB", "description": "A round plus button that grows into a short entry menu, turns into a small form for the pick, then settles back with a check.", "category": "original", "kind": "component"},
  {"name": "share-panel", "title": "Share panel", "description": "A button that unfolds into a card for copying a URL, setting who can open it, posting through a route, or delivering to contacts.", "category": "original", "kind": "component"},
  {"name": "toolbar-menu", "title": "Toolbar menu", "description": "A compact icon bar that names each icon as you hover and morphs into a full menu with pages of its own.", "category": "original", "kind": "component"},
  {"name": "task-input", "title": "Task input", "description": "A quick-add task row that reads dates and #lists as you type, morphs its date and list pickers into chips, and drops each new task into a list.", "category": "original", "kind": "component"},
  {"name": "voice-chat", "title": "Voice chat", "description": "A pill of stacked avatars that morphs into a card of participants, with each avatar flying from the stack to its place in the grid.", "category": "original", "kind": "component"},
  {"name": "fluid-header", "title": "Fluid header", "description": "A site header whose single surface stretches into section menus, a search panel, and a slimmer bar on scroll.", "category": "original", "kind": "component"},
  {"name": "magnify-bar", "title": "Magnify bar", "description": "A floating icon bar whose hover label slides between slots, whose highlight springs to the active one, and whose group slots unfold a tray.", "category": "original", "kind": "component"},
  {"name": "blob-tabs", "title": "Blob tabs", "description": "A tab row whose selection is a gooey pill that reaches toward the next tab, thins as it travels, and reveals each icon's caption as it lands.", "category": "original", "kind": "component"},
  {"name": "radial-picker", "title": "Radial picker", "description": "A round trigger that fans a handful of choices around it; slide toward one and release to pick, or tap and use the keyboard.", "category": "original", "kind": "component"},
  {"name": "reserve-pill", "title": "Reserve pill", "description": "A floating pill that stretches and folds as you step through player count, day, hourly slot, and a confirmation ticket.", "category": "original", "kind": "component"},
  {"name": "mini-player", "title": "Mini player", "description": "A slim playback bar that swells into a full player with a waveform seek strip, cover art that slides as you skip, and a pull-down to fold it away.", "category": "original", "kind": "component"},
  {"name": "drill-sheets", "title": "Drill sheets", "description": "Layered panels that open one inside another, keep each parent peeking behind, swipe down to step back, and turn into centered dialogs on wide hosts.", "category": "original", "kind": "component"},
  {"name": "pass-deck", "title": "Pass deck", "description": "A shuffled deck of membership and transit passes that fans on hover and lifts one out beside its credit and history.", "category": "original", "kind": "component"},
  {"name": "shape-spinner", "title": "Shape spinner", "description": "A four-stroke activity indicator that regroups into pulse, columns, orbit or frame loops and resolves into a drawn check or cross.", "category": "original", "kind": "component"},
  {"name": "float-tabs", "title": "Float tabs", "description": "A frosted tab bar that hovers over scrolling content, with a draggable glass lens under the active tab, a round side button, and a compact pill form on scroll.", "category": "original", "kind": "component"},
  {"name": "depth-rail", "title": "Depth rail", "description": "A row of angled image cards in perspective that you flick through, each one casting a shadow and a faint mirrored reflection.", "category": "original", "kind": "component"},
  {"name": "zoom-gallery", "title": "Zoom gallery", "description": "A staggered grid of images; tapping one lifts it out of its tile into a full-screen viewer with swipe paging, pinch zoom, and drag-down dismissal.", "category": "original", "kind": "component"},
  {"name": "paste-preview", "title": "Paste preview", "description": "A reply box that turns each pasted address into an inline link, then opens it into a small card with image and source once the details arrive.", "category": "original", "kind": "component"},
  {"name": "skeleton-reveal", "title": "Skeleton reveal", "description": "Size-matched placeholders that dissolve in place as the real content fades up beneath them.", "category": "original", "kind": "component"},
  {"name": "time-wheel", "title": "Time wheel", "description": "Drum-style wheels for choosing a date and clock time, with flick momentum, snapping, quick shortcuts and full keyboard control.", "category": "original", "kind": "component"},
  {"name": "onboarding-flow", "title": "Onboarding flow", "description": "A phone-sized sign-up flow whose one button rides up on a keypad, renames itself step to step, and wakes once the field is filled, while steps slide past and a dash tracks progress.", "category": "original", "kind": "component"},
  {"name": "progressive-blur-card", "title": "Progressive blur card", "description": "A stack of portrait creator cards whose lower third melts into a progressive blur that grows upward on hover to reveal a bio, with a Connect pill that morphs into Connected; swipe the front card away and it tucks in at the back.", "category": "original", "kind": "component"},
]

/** The catalog grouped by category in `categories` order. Empty groups are left out; `filter` narrows the items first. */
export function catalogByCategory(filter?: (item: CatalogItem) => boolean): { category: string; label: string; items: CatalogItem[] }[] {
  return categories
    .map(category => ({
      category,
      label: categoryLabel(category),
      items: catalog.filter(item => item.category === category && (!filter || filter(item))),
    }))
    .filter(group => group.items.length > 0)
}
