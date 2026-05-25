# Brief: Agent Debate Arena — UI Design

## What this is
A local-only desktop web app where AI agents debate each other via API.
A single human (the moderator) creates conversations, registers agents,
controls who can post, and watches the debate unfold live. Think
"observatory + control panel" — information-dense but calm, not flashy.

## Who uses it
One human, on a desktop browser, running on localhost. No mobile.
No multi-user concerns. The UI is the moderator's cockpit.

## Visual tone
- Dense, dashboard-like, monospace-friendly for agent messages
- Calm and serious — this is a place to watch agents argue, not a chat app
- Dark mode primary; light mode if cheap to add
- Subtle motion only (e.g. fade-in on new message, gentle pulse on a live indicator)
- Distinct visual treatment for the three timeline entry types:
  1. Agent message (named author, markdown body)
  2. Moderator message (you — same shape as agent but visually marked)
  3. System event (centered, muted — e.g. "Alice muted", "conversation re-opened")
  4. Rejected attempt (inline, warning-toned — "Bob tried to post (muted)")

## Screens

### 1. Conversation list (home)
- Left: app nav (Conversations, Agents, Settings)
- Main: table or card list of conversations
  - Topic (truncated)
  - Status pill: Open / Closed
  - Participant count
  - Message count
  - Last activity timestamp
- Top-right: "New conversation" button

### 2. Conversation view (the core screen)
Three-pane layout:
- LEFT RAIL: collapsed conversation list (clickable to switch)
- CENTER: the conversation
  - Header: topic, status pill, close/reopen button, export menu (JSON/Markdown)
  - Timeline: messages, system events, rejected attempts in chronological order
  - Composer (only if conversation is open): textarea with markdown support,
    labeled "Posting as Moderator", send button
- RIGHT RAIL: participants & permissions
  - For each registered agent: name, posting toggle (on/off), avatar/color dot
  - Bulk actions: "Mute everyone here", "Unmute everyone here"
  - Per-agent "Solo globally" button (mutes everyone but this agent in ALL
    open conversations — needs a confirmation tooltip because it's global)
  - Optimistic UI: toggles flip immediately, no save button

### 3. Agent registry
- Table of agents: name, status (active/deleted), can_create_conversations toggle,
  created date, last-seen timestamp
- Row actions: rename (inline edit), delete (soft, with confirm)
- "New agent" button opens a modal:
  - Field: name
  - Toggle: can create conversations (default off)
  - On submit: shows the generated token ONCE in a copy-to-clipboard box
    with a clear "you will not see this again" warning

### 4. Settings / DB management
- Section: "Database"
  - Current DB path + size
  - Button: "Archive current DB" (timestamps and saves to ./data/archives/)
  - Button: "Start fresh database" (auto-archives current first, confirms)
  - List of archives with: timestamp, size, "Restore" button per row
    (restoring auto-archives current as safety)

## Key data the UI must surface

Agent: { id, name, status, can_create_conversations, created_at, last_seen }
Conversation: { id, topic, status (open|closed), created_at, last_activity,
                message_count, participant_count }
TimelineEntry (one of):
  - Message: { id, author_type (agent|moderator), author_name, author_color,
              body_markdown, created_at }
  - SystemEvent: { id, kind (muted|unmuted|closed|reopened|solo|etc),
                   summary_text, created_at }
  - RejectedAttempt: { id, agent_name, reason (muted|closed|not_participant),
                       attempted_body_preview, created_at }
Permission: { conversation_id, agent_id, can_post }

## Key interactions to design for
- Live update: new entries fade in at the bottom; auto-scroll only if user
  is already at the bottom (don't yank them away from reading history)
- Permission toggle: optimistic flip, subtle inline system event appears
  in the timeline ("Moderator muted Alice")
- "Solo globally": needs a clear modal/confirm — it's a destructive-feeling
  power move that affects every open conversation
- Close conversation: confirm modal; composer disappears; timeline gets a
  "closed at HH:MM" system event; "Reopen" button appears in the header
- Rejected attempt: shown inline so silence is never mysterious

## Out of scope for this design
- Mobile / responsive below ~1024px
- Multi-user, login, sharing
- In-app replay scrubber (export-only for v1)
- Notifications, sound, browser tab badges

## Deliverable
High-fidelity mockups of the four screens above, plus the
"create agent → token reveal" modal and the "solo globally" confirm modal.
Dark mode primary. Use realistic example data (agent names like
"Socrates", "Hume", "Kant"; debate topics like "Is consciousness substrate-
independent?").
