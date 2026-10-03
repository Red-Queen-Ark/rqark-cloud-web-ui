import { describe, expect, it } from 'vitest';
import { applyChatPayload, chatPayloadError, openChatStream } from './chatStream';

const at = '2026-05-06T07:08:09Z';

const tool: ChatToolMessage = { role: 'tool', tool_call_id: 'call_1', content: 'plan updated', created_at: at };

const toolCall: ChatToolCall = { id: 'call_1', type: 'function', function: { name: 'plan_update', arguments: '{}' } };

function contents(stream: ReturnType<typeof openChatStream>): unknown[] {
  return stream.messages.map((message) => message.data.content);
}

describe('chatPayloadError', () => {
  it('reads the message out of an error chunk', () => {
    expect(chatPayloadError({ type: 'error', content: 'APIConnectionError: Connection error.' })).toBe('APIConnectionError: Connection error.');
  });

  it('ignores anything that is not an error chunk', () => {
    expect(chatPayloadError({ type: 'content', content: 'hi' })).toBeNull();
    expect(chatPayloadError(tool)).toBeNull();
    expect(chatPayloadError([{ id: '1', content: 'step', status: 'pending', icon: ' ' }])).toBeNull();
  });
});

describe('applyChatPayload', () => {
  it('grows one assistant message out of the content chunks', () => {
    let stream = openChatStream();
    stream = applyChatPayload(stream, 'agent', { type: 'content', content: 'It ' });
    stream = applyChatPayload(stream, 'agent', { type: 'content', content: 'is sunny.' });

    expect(stream.messages).toHaveLength(1);
    expect(stream.messages[0]).toMatchObject({ seq: 0, role: 'assistant', data: { role: 'assistant', content: 'It is sunny.' } });
  });

  it('keeps reasoning beside the answer it belongs to', () => {
    let stream = openChatStream();
    stream = applyChatPayload(stream, 'agent', { type: 'reasoning_content', content: 'Let me ' });
    stream = applyChatPayload(stream, 'agent', { type: 'reasoning_content', content: 'check.' });
    stream = applyChatPayload(stream, 'agent', { type: 'content', content: 'Sunny.' });

    expect(stream.messages).toHaveLength(1);
    expect(stream.messages[0].data).toMatchObject({ content: 'Sunny.', reasoning_content: 'Let me check.' });
  });

  it('carries the tool calls the model asked for', () => {
    let stream = openChatStream();
    stream = applyChatPayload(stream, 'agent', { type: 'tool_calls', content: [toolCall] });

    expect(stream.messages[0].data).toMatchObject({ tool_calls: [toolCall] });
  });

  it('settles the streamed message on the one the engine assembled', () => {
    let stream = openChatStream();
    stream = applyChatPayload(stream, 'agent', { type: 'content', content: 'It is ' });
    stream = applyChatPayload(stream, 'agent', { role: 'assistant', content: 'It is sunny.', created_at: at });

    expect(stream.messages).toHaveLength(1);
    expect(stream.messages[0]).toMatchObject({ created_at: at, data: { content: 'It is sunny.', created_at: at } });
  });

  it('starts a new message for the answer that follows a tool result', () => {
    let stream = openChatStream();
    stream = applyChatPayload(stream, 'agent', { type: 'content', content: 'Checking.' });
    stream = applyChatPayload(stream, 'agent', { role: 'assistant', content: 'Checking.', created_at: at });
    stream = applyChatPayload(stream, 'agent', tool);
    stream = applyChatPayload(stream, 'agent', { type: 'content', content: 'Sunny.' });

    expect(stream.messages.map((message) => message.role)).toEqual(['assistant', 'tool', 'assistant']);
    expect(contents(stream)).toEqual(['Checking.', 'plan updated', 'Sunny.']);
  });

  it('appends a tool result once, though the socket says it twice', () => {
    let stream = openChatStream();
    stream = applyChatPayload(stream, 'agent', tool);
    stream = applyChatPayload(stream, 'agent', tool);

    expect(stream.messages).toHaveLength(1);
    expect(stream.messages[0].role).toBe('tool');
  });

  it('keeps a second tool result that answered a different call', () => {
    let stream = openChatStream();
    stream = applyChatPayload(stream, 'agent', tool);
    stream = applyChatPayload(stream, 'agent', { ...tool, tool_call_id: 'call_2' });

    expect(stream.messages).toHaveLength(2);
  });

  it('numbers the messages it appends after the loaded history', () => {
    let stream = openChatStream([{ seq: 0, role: 'user', data: { role: 'user', content: [{ type: 'text', text: 'hi' }], created_at: at }, created_at: at }]);
    stream = applyChatPayload(stream, 'agent', { role: 'user', content: [{ type: 'text', text: 'hello' }], created_at: at });

    expect(stream.messages.map((message) => message.seq)).toEqual([0, 1]);
  });

  it('streams each agent into its own message', () => {
    let stream = openChatStream();
    stream = applyChatPayload(stream, 'parent', { type: 'content', content: 'A' });
    stream = applyChatPayload(stream, 'sub', { type: 'content', content: 'B' });
    stream = applyChatPayload(stream, 'parent', { type: 'content', content: 'C' });

    expect(contents(stream)).toEqual(['AC', 'B']);
  });

  it('drops the plan, which is session state rather than a message', () => {
    const stream = openChatStream();
    expect(applyChatPayload(stream, 'agent', [{ id: '1', content: 'step', status: 'pending', icon: ' ' }])).toBe(stream);
  });
});
