interface ChatSocketToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatSocketReasoningChunk {
  type: 'reasoning_content';
  content: string;
}
interface ChatSocketContentChunk {
  type: 'content';
  content: string;
}
interface ChatSocketErrorChunk {
  type: 'error';
  content: string;
}
interface ChatSocketToolCallsChunk {
  type: 'tool_calls';
  content: ChatSocketToolCall[];
}

type ChatSocketChunk = ChatSocketReasoningChunk | ChatSocketContentChunk | ChatSocketErrorChunk | ChatSocketToolCallsChunk;

interface ChatSocketUserTextContent {
  type: 'text';
  text: string;
}
interface ChatSocketUserImageContent {
  type: 'image_url';
  image_url: { url: string };
}

interface ChatSocketUserMessage {
  role: 'user';
  content: (ChatSocketUserTextContent | ChatSocketUserImageContent)[];
  created_at: string;
}

interface ChatSocketAssistantMessage {
  role: 'assistant';
  content: string;
  created_at: string;
  tool_calls?: ChatSocketToolCall[];
  reasoning_content?: string;
}

interface ChatSocketToolMessage {
  role: 'tool';
  tool_call_id: string;
  content: string;
  created_at: string;
}

type ChatSocketMessage = ChatSocketUserMessage | ChatSocketAssistantMessage | ChatSocketToolMessage;

type ChatSocketPlanStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
interface ChatSocketPlanItem {
  id: string;
  content: string;
  status: ChatSocketPlanStatus;
  icon: ' ' | '>' | 'x' | '-';
}

type ChatSocketPayload = ChatSocketChunk | ChatSocketMessage | ChatSocketPlanItem[];

interface ChatSocketAgentPayload<T = ChatSocketPayload> {
  agent_id: string;
  path: string[];
  payload: T;
}

type ChatSocketServerMessage = ChatSocketAgentPayload;

interface ChatSocketClientMessage {
  content: string;
  provider: string;
  agent: string;
}
