interface ChatToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatReasoningChunk {
  type: 'reasoning_content';
  content: string;
}
interface ChatContentChunk {
  type: 'content';
  content: string;
}
interface ChatErrorChunk {
  type: 'error';
  content: string;
}
interface ChatToolCallsChunk {
  type: 'tool_calls';
  content: ChatToolCall[];
}
/** Server asking the client to push a fresh data cloud token; control, not content. */
interface ChatTokenRequiredChunk {
  type: 'token_required';
  content: string;
}

type ChatChunk = ChatReasoningChunk | ChatContentChunk | ChatErrorChunk | ChatToolCallsChunk | ChatTokenRequiredChunk;

interface ChatTextPart {
  type: 'text';
  text: string;
}
interface ChatImagePart {
  type: 'image_url';
  image_url: { url: string };
}

interface ChatUserMessage {
  role: 'user';
  content: (ChatTextPart | ChatImagePart)[];
  created_at: string;
  id?: string;
}

interface ChatAssistantMessage {
  role: 'assistant';
  content: string;
  created_at: string;
  tool_calls?: ChatToolCall[];
  reasoning_content?: string;
  id?: string;
}

interface ChatToolMessage {
  role: 'tool';
  tool_call_id: string;
  content: string;
  created_at: string;
  id?: string;
}

interface ChatSystemMessage {
  role: 'system';
  content: string;
  created_at: string;
  id?: string;
}

interface ChatSummaryMessage {
  role: 'summary';
  content: string;
  id?: string;
}

type ChatMessage = ChatUserMessage | ChatAssistantMessage | ChatToolMessage | ChatSystemMessage | ChatSummaryMessage;

type ChatPlanStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
interface ChatPlanItem {
  id: string;
  content: string;
  status: ChatPlanStatus;
  icon: ' ' | '>' | 'x' | '-';
}

type ChatPayload = ChatChunk | ChatMessage | ChatPlanItem[];

interface ChatEnvelope<T = ChatPayload> {
  agent_id: string;
  path: string[];
  payload: T;
  /** Per-room monotonic stamp from the replay log; absent on frames that were never recorded. */
  seq?: number;
}

type ChatServerMessage = ChatEnvelope;

interface ChatTurnMessage {
  content: string;
  provider: string;
  agent: string;
  /** Base64 data URIs, at most four, each under 5MB; the server re-checks them. */
  images?: string[];
}

interface ChatStopMessage {
  kind: 'stop';
}

type ChatClientMessage = ChatTurnMessage | ChatStopMessage;

type ChatHistoryEntry =
  | { seq: number; role: 'user'; data: ChatUserMessage; created_at: string }
  | { seq: number; role: 'assistant'; data: ChatAssistantMessage; created_at: string }
  | { seq: number; role: 'tool'; data: ChatToolMessage; created_at: string }
  | { seq: number; role: 'system'; data: ChatSystemMessage; created_at: string }
  | { seq: number; role: 'summary'; data: ChatSummaryMessage; created_at: null };
