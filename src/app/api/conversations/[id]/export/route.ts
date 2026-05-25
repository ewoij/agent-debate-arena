import { getConversation, listEvents, listMessages } from "@/lib/repo";
import { exportJson, exportMarkdown } from "@/lib/exporter";

export const runtime = "nodejs";

function filenameSafe(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversation = getConversation(id);
  if (!conversation) {
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
  const messages = listMessages(id);
  const events = listEvents(id);
  const stem = filenameSafe(conversation.topic) || conversation.id;

  if (format === "markdown" || format === "md") {
    const body = exportMarkdown(conversation, messages, events);
    return new Response(body, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${stem}.md"`,
      },
    });
  }

  const body = exportJson(conversation, messages, events);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${stem}.json"`,
    },
  });
}
