import axios from 'axios';
import type { AIParsedCommand } from '../types';

const AI_URL = 'http://127.0.0.1:8001';

const apiClient = axios.create({
  baseURL: AI_URL,
  timeout: 30000,
});

export const aiEngineApi = {
  async transcribeAudio(audioBlob: Blob): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');

      const res = await apiClient.post<{ transcript: string }>('/api/ai/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.transcript || '';
    } catch (error) {
      console.error('Failed to transcribe audio:', error);
      return '';
    }
  },

  async parseCommand(text: string): Promise<AIParsedCommand | null> {
    try {
      const res = await apiClient.post<AIParsedCommand>('/api/ai/parse_command', { command: text, text });
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
