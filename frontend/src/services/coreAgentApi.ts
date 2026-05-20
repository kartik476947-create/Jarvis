import axios from 'axios';
import type {
  ProcessEvent,
  FileEvent,
  SecurityEvent,
  NetworkConnection,
  ProcessInfo,
  SystemStatus,
  ExecuteResult,
} from '../types';

const CORE_URL = 'http://127.0.0.1:8000';

const apiClient = axios.create({
  baseURL: CORE_URL,
  timeout: 130000,
});

export const coreAgentApi = {
  async getSystemStatus(): Promise<SystemStatus | null> {
    try {
      const res = await apiClient.get<SystemStatus>('/api/system/status');
      return res.data;
    } catch (error) {
      console.error('Failed to fetch system status:', error);
      return null;
    }
  },

  async getProcessEvents(): Promise<ProcessEvent[]> {
    try {
      const res = await apiClient.get<{ events: ProcessEvent[] }>('/api/system/events/processes');
      return res.data.events || [];
    } catch (error) {
      console.error('Failed to fetch process events:', error);
      return [];
    }
  },

  async getSecurityEvents(): Promise<SecurityEvent[]> {
    try {
      const res = await apiClient.get<{ events: SecurityEvent[] }>('/api/system/events/security');
      return res.data.events || [];
    } catch (error) {
      console.error('Failed to fetch security events:', error);
      return [];
    }
  },

  async getFileEvents(): Promise<FileEvent[]> {
    try {
      const res = await apiClient.get<{ events: FileEvent[] }>('/api/system/events/files');
      return res.data.events || [];
    } catch (error) {
      console.error('Failed to fetch file events:', error);
      return [];
    }
  },

  async getConnections(): Promise<NetworkConnection[]> {
    try {
      const res = await apiClient.get<{ connections: NetworkConnection[] }>('/api/system/connections');
      return res.data.connections || [];
    } catch (error) {
      console.error('Failed to fetch connections:', error);
      return [];
    }
  },

  async getProcesses(): Promise<ProcessInfo[]> {
    try {
      const res = await apiClient.get<{ processes: ProcessInfo[] }>('/api/system/processes');
      return res.data.processes || [];
    } catch (error) {
      console.error('Failed to fetch processes:', error);
      return [];
    }
  },

  async terminateProcess(pid: number): Promise<boolean> {
    try {
      await apiClient.post(`/api/terminate/${pid}`);
      return true;
    } catch (error) {
      console.error('Failed to terminate process:', error);
      return false;
    }
  },

  async executeCommand(command: string, shell: 'powershell' | 'cmd' = 'powershell'): Promise<ExecuteResult> {
    try {
      const res = await apiClient.post<ExecuteResult>('/api/system/execute', { command, shell });
      return res.data;
    } catch (error) {
      console.error('Failed to execute command:', error);
      return { ok: false, error: String(error) };
    }
  },

  async quarantineFile(filepath: string): Promise<{ status: string; message: string }> {
    try {
      const res = await apiClient.post<{ status: string; message: string }>(`/api/file/quarantine?filepath=\${encodeURIComponent(filepath)}`);
      return res.data;
    } catch (error) {
      console.error('Failed to quarantine file:', error);
      return { status: 'Error', message: String(error) };
    }
  },
};

