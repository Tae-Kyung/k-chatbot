import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '@/features/chat/store';

describe('useChatStore', () => {
  beforeEach(() => {
    useChatStore.getState().resetChat();
  });

  it('should start with empty messages', () => {
    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.conversationId).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.language).toBe('ko');
  });

  it('should add a message', () => {
    useChatStore.getState().addMessage('user', 'Hello');
    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].role).toBe('user');
    expect(state.messages[0].content).toBe('Hello');
  });

  it('should add multiple messages', () => {
    useChatStore.getState().addMessage('user', 'Question');
    useChatStore.getState().addMessage('assistant', 'Answer');
    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0].role).toBe('user');
    expect(state.messages[1].role).toBe('assistant');
  });

  it('should set loading state', () => {
    useChatStore.getState().setLoading(true);
    expect(useChatStore.getState().isLoading).toBe(true);
    useChatStore.getState().setLoading(false);
    expect(useChatStore.getState().isLoading).toBe(false);
  });

  it('should set language', () => {
    useChatStore.getState().setLanguage('en');
    expect(useChatStore.getState().language).toBe('en');
  });

  it('should set conversation ID', () => {
    useChatStore.getState().setConversationId('conv-123');
    expect(useChatStore.getState().conversationId).toBe('conv-123');
  });

  it('should update last assistant message', () => {
    useChatStore.getState().addMessage('user', 'Question');
    useChatStore.getState().addMessage('assistant', 'Part 1');
    useChatStore.getState().updateLastAssistantMessage('Part 1 Part 2');
    const state = useChatStore.getState();
    expect(state.messages[1].content).toBe('Part 1 Part 2');
  });

  it('should reset chat', () => {
    useChatStore.getState().addMessage('user', 'Hello');
    useChatStore.getState().setConversationId('conv-123');
    useChatStore.getState().setLoading(true);
    useChatStore.getState().resetChat();

    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.conversationId).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('should set error', () => {
    useChatStore.getState().setError('Something went wrong');
    expect(useChatStore.getState().error).toBe('Something went wrong');
    useChatStore.getState().setError(null);
    expect(useChatStore.getState().error).toBeNull();
  });
});
