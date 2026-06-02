import axios from 'axios';
import type { AIParsedCommand } from '../types';

// In production (Vercel), set VITE_AI_ENGINE_URL to your Render service URL.
// In local dev, falls back to localhost:8001
const AI_URL = import.meta.env.VITE_AI_ENGINE_URL || 'http://localhost:8001';

const apiClient = axios.create({
  baseURL: AI_URL,
  timeout: 30000,
});

export const aiEngineApi = {
  async transcribeAudio(audioBlob: Blob): Promise<string> {
    try {
      const formData = new FormData();
      const ext = audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
      formData.append('file', audioBlob, `recording.${ext}`);

      const res = await apiClient.post<{ transcript: string }>('/api/ai/transcribe', formData);
      return res.data.transcript || '';
    } catch (error) {
      console.error('Failed to transcribe audio:', error);
      return '';
    }
  },

  async parseCommand(text: string, history?: {type: string, content: string}[]): Promise<AIParsedCommand | null> {
    try {
      const res = await apiClient.post<AIParsedCommand>('/api/ai/parse_command', { 
        command: text, 
        text,
        history: history || []
      });
      return res.data;
    } catch (error) {
      console.error('Failed to parse command:', error);
      return null;
    }
  },

  async confirmAction(commandId: string): Promise<boolean> {
    try {
      await apiClient.post('/api/ai/confirm_action', { command_id: commandId });
      return true;
    } catch (error) {
      console.error('Failed to confirm action:', error);
      return false;
    }
  },

  async speak(text: string): Promise<void> {
    try {
      await apiClient.post('/api/ai/speak', { text });
    } catch (error) {
      console.error('Failed to speak:', error);
      // Fallback to browser speech synthesis
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  },
};
