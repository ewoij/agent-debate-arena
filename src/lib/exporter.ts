import type { ArenaEvent, Conversation, Message } from "./types";

function timeString(ts: number): string {
  return new Date(ts).toISOString();
}

export function exportJson(
  conversation: Conversation,
  messages: Message[],
  events: ArenaEvent[]
): string {
  const timeline = [
    ...messages.map((m) => ({ type: "message" as const, data: m })),
    ...events.map((e) => ({ type: "event" as const, data: e })),
  ].sort((a, b) => a.data.created_at - b.data.created_at);
  return JSON.stringify({ conversation, timeline }, null, 2);
}

export function exportMarkdown(
  conversation: Conversation,
  messages: Message[],
  events: ArenaEvent[]
): string {
  const lines: string[] = [];
  lines.push(`# ${conversation.topic}`);
  lines.push("");
  lines.push(
    `> Conversation \`${conversation.id}\` — created ${timeString(
      conversation.created_at
    )}`
  );
  lines.push(`> Status: ${conversation.status}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  const timeline: Array<
    | { kind: "message"; m: Message }
    | { kind: "event"; e: ArenaEvent }
  > = [
    ...messages.map((m) => ({ kind: "message" as const, m })),
    ...events.map((e) => ({ kind: "event" as const, e })),
  ].sort((a, b) => {
    const at = a.kind === "message" ? a.m.created_at : a.e.created_at;
    const bt = b.kind === "message" ? b.m.created_at : b.e.created_at;
    return at - bt;
  });

  for (const entry of timeline) {
    if (entry.kind === "message") {
      const m = entry.m;
      const tag = m.author_type === "moderator" ? " (moderator)" : "";
      lines.push(`**${m.author_name}**${tag} · ${timeString(m.created_at)}`);
      lines.push("");
      lines.push(m.body);
    } else {
      const e = entry.e;
      const t = timeString(e.created_at);
      switch (e.kind) {
        case "permission_changed":
          lines.push(
            `_Moderator ${
              e.payload.can_post ? "unmuted" : "muted"
            } ${e.agent_name ?? "an agent"}_ · ${t}`
          );
          break;
        case "closed":
          lines.push(`_Conversation closed_ · ${t}`);
          break;
        case "reopened":
          lines.push(`_Conversation reopened_ · ${t}`);
          break;
        case "muted_all":
          lines.push(`_Moderator muted everyone_ · ${t}`);
          break;
        case "unmuted_all":
          lines.push(`_Moderator unmuted everyone_ · ${t}`);
          break;
        case "soloed":
          lines.push(
            `_Soloed ${e.agent_name ?? "an agent"} globally_ · ${t}`
          );
          break;
        case "rejected":
          lines.push(
            `_${e.agent_name ?? "An agent"} tried to post — ${
              e.payload.reason ?? "blocked"
            }_ · ${t}`
          );
          if (e.payload.body_preview) {
            lines.push("");
            lines.push(`> ${e.payload.body_preview.replace(/\n/g, "\n> ")}`);
          }
          break;
      }
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}
