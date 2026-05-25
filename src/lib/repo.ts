import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { hashToken } from "./tokens";
import type {
  Agent,
  ArenaEvent,
  Conversation,
  ConversationSummary,
  EventKind,
  Message,
  MessageAttachment,
  Permission,
} from "./types";

interface AgentRow {
  id: string;
  name: string;
  token_hash: string;
  status: string;
  can_create_conversations: number;
  color: string;
  created_at: number;
}

interface ConversationRow {
  id: string;
  topic: string;
  status: string;
  created_at: number;
  last_activity: number;
}

interface MessageRow {
  id: number;
  conversation_id: string;
  author_type: string;
  author_agent_id: string | null;
  author_name: string | null;
  author_color: string | null;
  body: string;
  attachments: string | null;
  created_at: number;
}

function parseAttachments(raw: string | null | undefined): MessageAttachment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MessageAttachment[]) : [];
  } catch {
    return [];
  }
}

function agentFromRow(r: AgentRow): Agent {
  return {
    id: r.id,
    name: r.name,
    status: r.status as Agent["status"],
    can_create_conversations: !!r.can_create_conversations,
    color: r.color,
    created_at: r.created_at,
  };
}

function conversationFromRow(r: ConversationRow): Conversation {
  return {
    id: r.id,
    topic: r.topic,
    status: r.status as Conversation["status"],
    created_at: r.created_at,
    last_activity: r.last_activity,
  };
}

export function createAgent(input: {
  name: string;
  tokenHash: string;
  color: string;
  canCreateConversations?: boolean;
}): Agent {
  const id = randomUUID();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO agents (id, name, token_hash, status, can_create_conversations, color, created_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?)`
    )
    .run(
      id,
      input.name,
      input.tokenHash,
      input.canCreateConversations ? 1 : 0,
      input.color,
      now
    );
  return {
    id,
    name: input.name,
    status: "active",
    can_create_conversations: !!input.canCreateConversations,
    color: input.color,
    created_at: now,
  };
}

export function listAgents(): Agent[] {
  const rows = getDb()
    .prepare(`SELECT * FROM agents ORDER BY created_at ASC`)
    .all() as AgentRow[];
  return rows.map(agentFromRow);
}

export function getAgentByToken(token: string): Agent | null {
  const r = getDb()
    .prepare(`SELECT * FROM agents WHERE token_hash = ? AND status = 'active'`)
    .get(hashToken(token)) as AgentRow | undefined;
  return r ? agentFromRow(r) : null;
}

export function getAgent(id: string): Agent | null {
  const r = getDb().prepare(`SELECT * FROM agents WHERE id = ?`).get(id) as
    | AgentRow
    | undefined;
  return r ? agentFromRow(r) : null;
}

export function updateAgent(
  id: string,
  patch: {
    name?: string;
    status?: "active" | "deleted";
    can_create_conversations?: boolean;
  }
): Agent | null {
  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (patch.name !== undefined) {
    sets.push("name = ?");
    values.push(patch.name);
  }
  if (patch.status !== undefined) {
    sets.push("status = ?");
    values.push(patch.status);
  }
  if (patch.can_create_conversations !== undefined) {
    sets.push("can_create_conversations = ?");
    values.push(patch.can_create_conversations ? 1 : 0);
  }
  if (sets.length === 0) return getAgent(id);
  values.push(id);
  getDb()
    .prepare(`UPDATE agents SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values);
  return getAgent(id);
}

export function createConversation(input: { topic: string }): Conversation {
  const id = randomUUID();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO conversations (id, topic, status, created_at, last_activity)
       VALUES (?, ?, 'open', ?, ?)`
    )
    .run(id, input.topic, now, now);
  return {
    id,
    topic: input.topic,
    status: "open",
    created_at: now,
    last_activity: now,
  };
}

export function listConversations(): ConversationSummary[] {
  const rows = getDb()
    .prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
              (SELECT COUNT(*) FROM permissions p WHERE p.conversation_id = c.id AND p.can_post = 1) AS participant_count
       FROM conversations c
       ORDER BY c.last_activity DESC`
    )
    .all() as (ConversationRow & {
    message_count: number;
    participant_count: number;
  })[];
  return rows.map((r) => ({
    ...conversationFromRow(r),
    message_count: r.message_count,
    participant_count: r.participant_count,
  }));
}

export function getConversation(id: string): Conversation | null {
  const r = getDb()
    .prepare(`SELECT * FROM conversations WHERE id = ?`)
    .get(id) as ConversationRow | undefined;
  return r ? conversationFromRow(r) : null;
}

export function setConversationStatus(
  id: string,
  status: "open" | "closed"
): Conversation | null {
  getDb()
    .prepare(`UPDATE conversations SET status = ? WHERE id = ?`)
    .run(status, id);
  return getConversation(id);
}

export function listMessages(
  conversationId: string,
  sinceId = 0
): Message[] {
  const rows = getDb()
    .prepare(
      `SELECT m.id, m.conversation_id, m.author_type, m.author_agent_id, m.body, m.attachments, m.created_at,
              a.name AS author_name, a.color AS author_color
       FROM messages m
       LEFT JOIN agents a ON a.id = m.author_agent_id
       WHERE m.conversation_id = ? AND m.id > ?
       ORDER BY m.id ASC`
    )
    .all(conversationId, sinceId) as MessageRow[];
  return rows.map((r) => ({
    id: r.id,
    conversation_id: r.conversation_id,
    author_type: r.author_type as Message["author_type"],
    author_agent_id: r.author_agent_id,
    author_name:
      r.author_type === "moderator" ? "Moderator" : r.author_name ?? "(unknown)",
    author_color: r.author_color,
    body: r.body,
    attachments: parseAttachments(r.attachments),
    created_at: r.created_at,
  }));
}

export function insertMessage(input: {
  conversationId: string;
  authorType: "agent" | "moderator";
  authorAgentId: string | null;
  body: string;
  attachments?: MessageAttachment[];
}): Message {
  const now = Date.now();
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO messages (conversation_id, author_type, author_agent_id, body, attachments, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.conversationId,
      input.authorType,
      input.authorAgentId,
      input.body,
      JSON.stringify(input.attachments ?? []),
      now
    );
  db.prepare(`UPDATE conversations SET last_activity = ? WHERE id = ?`).run(
    now,
    input.conversationId
  );
  const id = Number(result.lastInsertRowid);
  const [msg] = listMessagesByIds([id]);
  return msg;
}

function listMessagesByIds(ids: number[]): Message[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `SELECT m.id, m.conversation_id, m.author_type, m.author_agent_id, m.body, m.attachments, m.created_at,
              a.name AS author_name, a.color AS author_color
       FROM messages m
       LEFT JOIN agents a ON a.id = m.author_agent_id
       WHERE m.id IN (${placeholders})
       ORDER BY m.id ASC`
    )
    .all(...ids) as MessageRow[];
  return rows.map((r) => ({
    id: r.id,
    conversation_id: r.conversation_id,
    author_type: r.author_type as Message["author_type"],
    author_agent_id: r.author_agent_id,
    author_name:
      r.author_type === "moderator" ? "Moderator" : r.author_name ?? "(unknown)",
    author_color: r.author_color,
    body: r.body,
    attachments: parseAttachments(r.attachments),
    created_at: r.created_at,
  }));
}

export function listPermissions(conversationId: string): Permission[] {
  const rows = getDb()
    .prepare(`SELECT conversation_id, agent_id, can_post FROM permissions WHERE conversation_id = ?`)
    .all(conversationId) as Array<{
    conversation_id: string;
    agent_id: string;
    can_post: number;
  }>;
  return rows.map((r) => ({
    conversation_id: r.conversation_id,
    agent_id: r.agent_id,
    can_post: !!r.can_post,
  }));
}

export function setPermission(input: {
  conversationId: string;
  agentId: string;
  canPost: boolean;
}): void {
  getDb()
    .prepare(
      `INSERT INTO permissions (conversation_id, agent_id, can_post)
       VALUES (?, ?, ?)
       ON CONFLICT(conversation_id, agent_id)
       DO UPDATE SET can_post = excluded.can_post`
    )
    .run(input.conversationId, input.agentId, input.canPost ? 1 : 0);
}

export function muteAllInConversation(conversationId: string): void {
  getDb()
    .prepare(
      `UPDATE permissions SET can_post = 0
       WHERE conversation_id = ? AND can_post = 1`
    )
    .run(conversationId);
}

export function unmuteAllInConversation(conversationId: string): void {
  const db = getDb();
  const activeAgents = db
    .prepare(`SELECT id FROM agents WHERE status = 'active'`)
    .all() as { id: string }[];
  const upsert = db.prepare(
    `INSERT INTO permissions (conversation_id, agent_id, can_post)
     VALUES (?, ?, 1)
     ON CONFLICT(conversation_id, agent_id)
     DO UPDATE SET can_post = 1`
  );
  const tx = db.transaction((agentIds: string[]) => {
    for (const id of agentIds) upsert.run(conversationId, id);
  });
  tx(activeAgents.map((a) => a.id));
}

export function soloAgentGlobally(agentId: string): string[] {
  const db = getDb();
  const openConvos = db
    .prepare(`SELECT id FROM conversations WHERE status = 'open'`)
    .all() as { id: string }[];
  const upsertSolo = db.prepare(
    `INSERT INTO permissions (conversation_id, agent_id, can_post)
     VALUES (?, ?, 1)
     ON CONFLICT(conversation_id, agent_id)
     DO UPDATE SET can_post = 1`
  );
  const muteOthers = db.prepare(
    `UPDATE permissions SET can_post = 0
     WHERE conversation_id = ? AND agent_id != ? AND can_post = 1`
  );
  const tx = db.transaction((ids: string[]) => {
    for (const cid of ids) {
      upsertSolo.run(cid, agentId);
      muteOthers.run(cid, agentId);
    }
  });
  const ids = openConvos.map((c) => c.id);
  tx(ids);
  return ids;
}

export function canAgentPost(
  conversationId: string,
  agentId: string
): boolean {
  const r = getDb()
    .prepare(
      `SELECT can_post FROM permissions WHERE conversation_id = ? AND agent_id = ?`
    )
    .get(conversationId, agentId) as { can_post: number } | undefined;
  return !!r && !!r.can_post;
}

interface EventRow {
  id: number;
  conversation_id: string;
  kind: string;
  agent_id: string | null;
  agent_name: string | null;
  agent_color: string | null;
  payload: string;
  created_at: number;
}

function eventFromRow(r: EventRow): ArenaEvent {
  let payload: ArenaEvent["payload"] = {};
  try {
    payload = JSON.parse(r.payload || "{}") as ArenaEvent["payload"];
  } catch {
    payload = {};
  }
  return {
    id: r.id,
    conversation_id: r.conversation_id,
    kind: r.kind as EventKind,
    agent_id: r.agent_id,
    agent_name: r.agent_name,
    agent_color: r.agent_color,
    payload,
    created_at: r.created_at,
  };
}

export function insertEvent(input: {
  conversationId: string;
  kind: EventKind;
  agentId: string | null;
  payload: ArenaEvent["payload"];
}): ArenaEvent {
  const now = Date.now();
  const result = getDb()
    .prepare(
      `INSERT INTO events (conversation_id, kind, agent_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      input.conversationId,
      input.kind,
      input.agentId,
      JSON.stringify(input.payload ?? {}),
      now
    );
  const id = Number(result.lastInsertRowid);
  const row = getDb()
    .prepare(
      `SELECT e.*, a.name AS agent_name, a.color AS agent_color
       FROM events e
       LEFT JOIN agents a ON a.id = e.agent_id
       WHERE e.id = ?`
    )
    .get(id) as EventRow;
  return eventFromRow(row);
}

export function listEvents(conversationId: string): ArenaEvent[] {
  const rows = getDb()
    .prepare(
      `SELECT e.*, a.name AS agent_name, a.color AS agent_color
       FROM events e
       LEFT JOIN agents a ON a.id = e.agent_id
       WHERE e.conversation_id = ?
       ORDER BY e.id ASC`
    )
    .all(conversationId) as EventRow[];
  return rows.map(eventFromRow);
}
