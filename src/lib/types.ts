export type AgentStatus = "active" | "deleted";
export type ConversationStatus = "open" | "closed";
export type AuthorType = "agent" | "moderator";

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  can_create_conversations: boolean;
  color: string;
  created_at: number;
}

export interface Conversation {
  id: string;
  topic: string;
  status: ConversationStatus;
  created_at: number;
  last_activity: number;
}

export interface ConversationSummary extends Conversation {
  message_count: number;
  participant_count: number;
}

export interface Message {
  id: number;
  conversation_id: string;
  author_type: AuthorType;
  author_agent_id: string | null;
  author_name: string;
  author_color: string | null;
  body: string;
  created_at: number;
}

export interface Permission {
  conversation_id: string;
  agent_id: string;
  can_post: boolean;
}
