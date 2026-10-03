export interface ChatStream {
  messages: ChatHistoryEntry[];
  drafts: Record<string, number>;
}

export function openChatStream(messages: ChatHistoryEntry[] = []): ChatStream {
  return { messages, drafts: {} };
}

export function chatPayloadError(payload: ChatPayload): string | null {
  if (Array.isArray(payload) || !('type' in payload) || payload.type !== 'error') {
    return null;
  }
  return payload.content;
}

export function applyChatPayload(stream: ChatStream, agentId: string, payload: ChatPayload): ChatStream {
  if (Array.isArray(payload)) {
    return stream;
  }
  return isChunk(payload) ? applyChunk(stream, agentId, payload) : applyMessage(stream, agentId, payload);
}

function isChunk(payload: ChatChunk | ChatMessage): payload is ChatChunk {
  return 'type' in payload;
}

function applyChunk(stream: ChatStream, agentId: string, chunk: ChatChunk): ChatStream {
  switch (chunk.type) {
    case 'reasoning_content':
      return withDraft(stream, agentId, (message) => ({ ...message, reasoning_content: `${message.reasoning_content ?? ''}${chunk.content}` }));
    case 'content':
      return withDraft(stream, agentId, (message) => ({ ...message, content: `${message.content}${chunk.content}` }));
    case 'tool_calls':
      return withDraft(stream, agentId, (message) => ({ ...message, tool_calls: chunk.content }));
    case 'error':
      return stream;
  }
}

function applyMessage(stream: ChatStream, agentId: string, message: ChatMessage): ChatStream {
  if (message.role === 'assistant') {
    return finalizeAssistant(stream, agentId, message);
  }
  if (message.role === 'tool' && isRepeatTool(stream.messages, message)) {
    return stream;
  }
  return { messages: [...stream.messages, messageEntry(stream.messages.length, message)], drafts: withoutDraft(stream.drafts, agentId) };
}

function withDraft(stream: ChatStream, agentId: string, update: (message: ChatAssistantMessage) => ChatAssistantMessage): ChatStream {
  const index = stream.drafts[agentId];
  const entry = index === undefined ? undefined : stream.messages[index];
  if (index !== undefined && entry?.role === 'assistant') {
    const messages = [...stream.messages];
    messages[index] = { ...entry, data: update(entry.data) };
    return { messages, drafts: stream.drafts };
  }
  const message = update({ role: 'assistant', content: '', created_at: new Date().toISOString() });
  return { messages: [...stream.messages, assistantEntry(stream.messages.length, message)], drafts: { ...stream.drafts, [agentId]: stream.messages.length } };
}

function finalizeAssistant(stream: ChatStream, agentId: string, message: ChatAssistantMessage): ChatStream {
  const index = stream.drafts[agentId];
  const entry = index === undefined ? undefined : stream.messages[index];
  const drafts = withoutDraft(stream.drafts, agentId);
  if (index !== undefined && entry?.role === 'assistant') {
    const messages = [...stream.messages];
    messages[index] = assistantEntry(entry.seq, message);
    return { messages, drafts };
  }
  return { messages: [...stream.messages, messageEntry(stream.messages.length, message)], drafts };
}

function isRepeatTool(messages: ChatHistoryEntry[], message: ChatToolMessage): boolean {
  const last = messages[messages.length - 1];
  return last?.role === 'tool' && last.data.tool_call_id === message.tool_call_id && last.data.created_at === message.created_at;
}

function withoutDraft(drafts: Record<string, number>, agentId: string): Record<string, number> {
  return Object.fromEntries(Object.entries(drafts).filter(([key]) => key !== agentId));
}

function assistantEntry(seq: number, data: ChatAssistantMessage): ChatHistoryEntry {
  return { seq, role: 'assistant', data, created_at: data.created_at };
}

function messageEntry(seq: number, message: ChatMessage): ChatHistoryEntry {
  switch (message.role) {
    case 'user':
      return { seq, role: 'user', data: message, created_at: message.created_at };
    case 'assistant':
      return { seq, role: 'assistant', data: message, created_at: message.created_at };
    case 'tool':
      return { seq, role: 'tool', data: message, created_at: message.created_at };
    case 'system':
      return { seq, role: 'system', data: message, created_at: message.created_at };
    case 'summary':
      return { seq, role: 'summary', data: message, created_at: null };
  }
}
