import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { hashToken } from "./tokens";
import type {
  Agent,
  Conversation,
  ConversationSummary,
  Message,
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
  created_at: number;
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

export function listMessages(
  conversationId: string,
  sinceId = 0
): Message[] {
  const rows = getDb()
    .prepare(
      `SELECT m.id, m.conversation_id, m.author_type, m.author_agent_id, m.body, m.created_at,
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
    created_at: r.created_at,
  }));
}

export function insertMessage(input: {
  conversationId: string;
  authorType: "agent" | "moderator";
  authorAgentId: string | null;
  body: string;
}): Message {
  const now = Date.now();
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO messages (conversation_id, author_type, author_agent_id, body, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      input.conversationId,
      input.authorType,
      input.authorAgentId,
      input.body,
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
      `SELECT m.id, m.conversation_id, m.author_type, m.author_agent_id, m.body, m.created_at,
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
