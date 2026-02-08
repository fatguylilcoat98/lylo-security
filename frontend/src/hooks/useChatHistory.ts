import { useState } from 'react';
import { Message } from '../types';
export function useChatHistory(accessCode: string) {
  const [currentSessionId, setCurrentSessionId] = useState<string>('session-1');
  const saveMessage = async (message: Message) => {};
  const loadSessionMessages = async (sessionId: string) => { return [] as Message[]; };
  const createSession = async () => {
    const newId = Date.now().toString();
    setCurrentSessionId(newId);
    return newId;
  };
  return { currentSessionId, saveMessage, loadSessionMessages, createSession };
}