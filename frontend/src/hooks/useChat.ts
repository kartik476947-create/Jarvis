import { useState, useCallback, useEffect } from 'react';
import { aiEngineApi } from '../services/aiEngineApi';
import { coreAgentApi } from '../services/coreAgentApi';
import type { ChatMessage, AIParsedCommand } from '../types';

export const useChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingCommand, setPendingCommand] = useState<AIParsedCommand | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleSendCommand = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        sendCommand(customEvent.detail);
      }
    };
    window.addEventListener('jarvis-send-command', handleSendCommand);
    return () => window.removeEventListener('jarvis-send-command', handleSendCommand);
  }, [sendCommand]);

  const addMessage = useCallback((type: 'user' | 'assistant', content: string, isHtml = false) => {
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      type,
      content,
      timestamp: new Date(),
      isHtml,
    };
    setMessages(prev => [...prev, message]);
    return message;
  }, []);

  const sendCommand = useCallback(async (text: string) => {
    addMessage('user', text);
    setIsLoading(true);

    const shellPrefix = /^(run|exec|execute|powershell|cmd):\s*/i;
    const direct = text.match(shellPrefix);
    if (direct) {
      const cmd = text.replace(shellPrefix, '').trim();
      const shell = /^cmd:/i.test(text) ? 'cmd' : 'powershell';
      try {
        const result = await coreAgentApi.executeCommand(cmd, shell);
        const output = (result.stdout || result.stderr || result.error || 'Done.').trim();
        addMessage('assistant', output.slice(0, 8000));
      } catch {
        addMessage('assistant', 'Failed to execute command on the host.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const parsed = await aiEngineApi.parseCommand(text);
      if (parsed) {
        setPendingCommand(parsed);

        // Format and add AI response
        const responseHtml = `
          <div class="ai-response">
            <div class="threat-level">Threat Level: ${parsed.threat_level}</div>
            <div class="analysis">${parsed.analysis}</div>
            <div class="action-plan">${parsed.action_plan}</div>
            <div class="execution-details">${JSON.stringify(parsed.execution_details)}</div>
          </div>
        `;
        addMessage('assistant', responseHtml, true);

        // Speak the response
        await aiEngineApi.speak(parsed.analysis);
      }
    } catch (error) {
      console.error('Failed to process command:', error);
      addMessage('assistant', 'Error processing command. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [addMessage]);

  const confirmAction = useCallback(async () => {
    if (pendingCommand) {
      setIsLoading(true);
      try {
        const success = await aiEngineApi.confirmAction('pending-command');
        if (success) {
          addMessage('assistant', 'Action confirmed and executed.');
        }
      } finally {
        setPendingCommand(null);
        setIsLoading(false);
      }
    }
  }, [pendingCommand, addMessage]);

  const cancelAction = useCallback(() => {
    setPendingCommand(null);
  }, []);

  return {
    messages,
    isLoading,
    pendingCommand,
    addMessage,
    sendCommand,
    confirmAction,
    cancelAction,
  };
};

