import { useState, useCallback, useEffect, useRef } from 'react';
import { aiEngineApi } from '../services/aiEngineApi';
import { coreAgentApi } from '../services/coreAgentApi';
import type { ChatMessage, AIParsedCommand } from '../types';

/**
 * Pick the best available British English voice.
 */
function getBritishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const gb = voices.filter(v => v.lang.startsWith('en-GB'));
  if (gb.length > 0) {
    const female = gb.find(v => /female|fiona|kate|serena|martha/i.test(v.name));
    return female || gb[0];
  }
  const en = voices.find(v => v.lang.startsWith('en'));
  return en || null;
}

export const useChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('jarvis-chat-history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      } catch { return []; }
    }
    return [];
  });

  const [pendingCommand, setPendingCommand] = useState<AIParsedCommand | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const messagesRef = useRef(messages);

  // Keep ref in sync so sendCommand always reads the latest messages
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Pre-load voices
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const loadVoices = () => { voiceRef.current = getBritishVoice(); };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('jarvis-chat-history', JSON.stringify(messages));
  }, [messages]);

  const addMessage = useCallback((type: 'user' | 'assistant', content: string, isHtml = false, rawText?: string) => {
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      type,
      content,
      timestamp: new Date(),
      isHtml,
      rawText: rawText || content,
    };
    setMessages(prev => [...prev, message]);
    return message;
  }, []);

  const speakText = useCallback((text: string) => {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    if (voiceRef.current) utterance.voice = voiceRef.current;
    utterance.lang = 'en-GB';
    window.speechSynthesis.speak(utterance);
  }, []);

  // Use ref for messages so this callback is stable and doesn't re-create on every message change
  const sendCommand = useCallback(async (text: string) => {
    if (!text.trim()) return;

    addMessage('user', text);
    setIsLoading(true);

    // Shell command shortcut
    const shellPrefix = /^(run|exec|execute|powershell|cmd|sh|bash):\s*/i;
    const direct = text.match(shellPrefix);
    if (direct) {
      const cmd = text.replace(shellPrefix, '').trim();
      const shell = /^cmd:/i.test(text) ? 'cmd' : 'powershell';
      try {
        const result = await coreAgentApi.executeCommand(cmd, shell);
        const output = (result.stdout || result.stderr || result.error || 'Done.').trim();
        addMessage('assistant', output.slice(0, 8000));
        speakText('Command executed successfully.');
      } catch {
        addMessage('assistant', 'Failed to execute command on the host.');
        speakText('Sorry, the command failed.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      // Use ref to read latest messages without depending on `messages` state
      const currentMessages = messagesRef.current;
      const history = currentMessages.slice(-10).map(m => ({
        type: m.type,
        content: m.rawText || m.content
      }));

      const parsed = await aiEngineApi.parseCommand(text, history);

      if (parsed) {
        if (parsed.requires_confirmation) {
          setPendingCommand(parsed);
        }

        // Extract readable response text
        const responseText = parsed.response || parsed.analysis || parsed.action_plan || 'I processed your request.';

        const responseHtml = `
          <div class="ai-response">
            <div class="threat-level">Threat Level: ${parsed.threat_level || 'SAFE'}</div>
            <div class="analysis">${responseText}</div>
            ${parsed.action_plan ? `<div class="action-plan">${parsed.action_plan}</div>` : ''}
          </div>
        `;
        addMessage('assistant', responseHtml, true, responseText);
        speakText(responseText);
      } else {
        addMessage('assistant', 'I could not process that. Please try again.');
        speakText('Sorry, I could not process that.');
      }
    } catch (error) {
      console.error('Failed to process command:', error);
      addMessage('assistant', 'Error processing command. Please try again.');
      speakText('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [addMessage, speakText]); // No `messages` dependency — uses messagesRef instead

  useEffect(() => {
    const handleSendCommand = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) sendCommand(customEvent.detail);
    };
    window.addEventListener('jarvis-send-command', handleSendCommand);
    return () => window.removeEventListener('jarvis-send-command', handleSendCommand);
  }, [sendCommand]);

  const confirmAction = useCallback(async () => {
    if (pendingCommand) {
      setIsLoading(true);
      try {
        const success = await aiEngineApi.confirmAction('pending-command');
        if (success) addMessage('assistant', 'Action confirmed and executed.');
      } finally {
        setPendingCommand(null);
        setIsLoading(false);
      }
    }
  }, [pendingCommand, addMessage]);

  const cancelAction = useCallback(() => { setPendingCommand(null); }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem('jarvis-chat-history');
  }, []);

  return {
    messages,
    isLoading,
    pendingCommand,
    addMessage,
    sendCommand,
    confirmAction,
    cancelAction,
    clearHistory,
  };
};
