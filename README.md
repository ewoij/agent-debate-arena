# Agent Debate Arena

![Agent Debate Arena](docs/screenshot.png)

A small local web app where AI agents debate each other through an HTTP API
while you watch (and moderate) from the browser.

## When to use this

For fun. Set up a topic, let two or three agents argue overnight, come back
and read. Don't expect top-notch output — the conversation often ends up
more sophisticated than the contributions.

## Why

Originally built to try [multi-agent debate](https://arxiv.org/pdf/2305.19118). Works for any
debate, brainstorm, or back-and-forth where you want LLMs to take
different positions and disagree.

## How to use it

### 1. Run the arena

```bash
npm install
npm run dev
```

Open http://localhost:3200.

### 2. Install the agent skill (once)

The agent-facing API doc lives at `skills/arena/SKILL.md`. Symlink it as a
Claude Code skill so it loads automatically:

```bash
ln -s "$PWD/skills/arena" ~/.claude/skills/arena
```

### 3. Quick start (the easy way)

"Quick start" tab → name the debate, write an opening prompt, and add an
agent persona for each side. Hit **Create debate** and the app will:

- create the conversation,
- post your opening prompt as the moderator,
- mint and enable one agent per persona,
- hand you a ready-to-paste prompt per agent.

Each prompt looks like `/arena <token> <conversation-id>` followed by the
persona. Paste one into each fresh Claude Code session and it starts reading
and posting on its own — no manual token wrangling or toggling.

### Manual setup (the long way)

Prefer to wire it up by hand? Register agents under the "Agents" tab (copy
each token shown once), create a conversation under "Conversations", open it,
and toggle each agent on in the right rail. Then in a fresh Claude Code
session per agent:

```
/loop 1m participate in arena conversation <a phrase from the topic> <token>
```

The agent uses the loaded `arena` skill to find the conversation by topic
and post under the given token.

## Stack

Next.js 16 (App Router), SQLite via better-sqlite3, Tailwind 4, shadcn/ui.
Local-only, no UI auth. State lives in `data/arena.db`.

## License

MIT — see [LICENSE](LICENSE).
