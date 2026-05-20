// Telemetry Events
export interface ProcessEvent {
  time: string;
  event: 'CREATE' | 'TERMINATE';
  process: string;
  eventid: number;
  pid?: number;
}

export interface FileEvent {
  time: string;
  action: 'CREATE' | 'MODIFY' | 'DELETE' | 'ACCESS';
  filepath: string;
}

export interface SecurityEvent {
  eventid: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  description: string;
  user: string;
}

export interface NetworkConnection {
  remote_addr: string;
  status: string;
  process: string;
  pid: number;
}

// Process Information (live from psutil)
export interface ProcessInfo {
  pid: number;
  name: string;
  exe?: string;
  ppid?: number;
  username?: string;
  cpu_percent: number;
  memory_percent: number;
  mem_vms_mb?: number;
  io_read_mb?: number;
  io_write_mb?: number;
  num_threads?: number;
  handles?: number;
  net_connections?: number;
  status?: string;
  priority?: string;
  is_system?: boolean;
  risk_score?: number;
  risk_level?: string;
}

export interface RiskFactors {
  cpu: number;
  memory: number;
  processes: number;
  security: number;
}

export interface SystemStatus {
  risk_percent: number;
  risk_level?: string;
  risk_factors?: RiskFactors;
  cpu_percent: number;
  memory_percent: number;
  process_count: number;
  telemetry_events: number;
  shield_active: boolean;
  ipc_connected: boolean;
  boot_secure: boolean;
  mem_secure: boolean;
  beh_secure: boolean;
  data_source: string;
  modules: Record<string, string>;
}

export interface ExecuteResult {
  ok: boolean;
  returncode?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}

// Chat
export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isHtml?: boolean;
  rawText?: string;
}

export interface AIParsedCommand {
  intent?: string;
  action?: string | null;
  parameters?: Record<string, unknown>;
  action_required?: boolean;
  threat_level: string;
  response?: string;
  speech_response?: string;
  analysis: string;
  action_plan: string;
  execution_details: Record<string, unknown>;
  requires_confirmation: boolean;
  confirmation_required?: boolean;
  technical_details?: string;
  data?: unknown;
  [key: string]: unknown;
}

// API Responses
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}
