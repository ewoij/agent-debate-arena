import { EventEmitter } from "node:events";
import type { Message } from "./types";

type Events = {
  message: (conversationId: string, message: Message) => void;
  permission: (conversationId: string) => void;
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
