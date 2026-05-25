import { getConversation } from "@/lib/repo";
import {
  onConversation,
  onCursors,
  onEvent,
  onMessage,
  onPermission,
} from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!getConversation(id)) {
    return new Response("not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      send("ready", { conversation_id: id });

      const offMessage = onMessage((convoId, message) => {
        if (convoId === id) send("message", message);
      });
      const offPermission = onPermission((convoId) => {
        if (convoId === id) send("permission", { conversation_id: id });
      });
      const offConversation = onConversation((convoId, conversation) => {
        if (convoId === id) send("conversation", conversation);
      });
      const offEvent = onEvent((convoId, event) => {
        if (convoId === id) send("event", event);
      });
      const offCursors = onCursors((convoId, cursors) => {
        if (convoId === id) send("cursors", cursors);
      });

      const ping = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(ping);
        offMessage();
        offPermission();
        offConversation();
        offEvent();
        offCursors();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
