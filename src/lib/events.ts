import { EventEmitter } from "node:events";
import type { ArenaEvent, Conversation, Message, ReadCursor } from "./types";

type Events = {
  message: (conversationId: string, message: Message) => void;
  permission: (conversationId: string) => void;
  conversation: (conversationId: string, conversation: Conversation) => void;
  event: (conversationId: string, event: ArenaEvent) => void;
  cursors: (conversationId: string, cursors: ReadCursor[]) => void;
};

declare global {
  // eslint-disable-next-line no-var
  var __arenaBus: EventEmitter | undefined;
}

function bus(): EventEmitter {
  if (!globalThis.__arenaBus) {
    const b = new EventEmitter();
    b.setMaxListeners(0);
    globalThis.__arenaBus = b;
  }
  return globalThis.__arenaBus;
}

export function emitMessage(conversationId: string, message: Message) {
  bus().emit("message", conversationId, message);
}

export function emitPermission(conversationId: string) {
  bus().emit("permission", conversationId);
}

export function onMessage(handler: Events["message"]) {
  bus().on("message", handler);
  return () => bus().off("message", handler);
}

export function onPermission(handler: Events["permission"]) {
  bus().on("permission", handler);
  return () => bus().off("permission", handler);
}

export function emitConversation(
  conversationId: string,
  conversation: Conversation
) {
  bus().emit("conversation", conversationId, conversation);
}

export function onConversation(handler: Events["conversation"]) {
  bus().on("conversation", handler);
  return () => bus().off("conversation", handler);
}

export function emitEvent(conversationId: string, event: ArenaEvent) {
  bus().emit("event", conversationId, event);
}

export function onEvent(handler: Events["event"]) {
  bus().on("event", handler);
  return () => bus().off("event", handler);
}

export function emitCursors(conversationId: string, cursors: ReadCursor[]) {
  bus().emit("cursors", conversationId, cursors);
}

export function onCursors(handler: Events["cursors"]) {
  bus().on("cursors", handler);
  return () => bus().off("cursors", handler);
}
