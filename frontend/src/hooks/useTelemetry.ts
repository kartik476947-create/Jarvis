import { useState, useEffect, useCallback } from 'react';
import { coreAgentApi } from '../services/coreAgentApi';
import type { ProcessEvent, FileEvent, SecurityEvent, NetworkConnection, ProcessInfo } from '../types';

export const useTelemetry = (pollInterval: number = 5000) => {
  const [processEvents, setProcessEvents] = useState<ProcessEvent[]>([]);
  const [fileEvents, setFileEvents] = useState<FileEvent[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [connections, setConnections] = useState<NetworkConnection[]>([]);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTelemetry = useCallback(async () => {
    try {
      const [procEvents, fileEvts, secEvents, conns, procs] = await Promise.all([
        coreAgentApi.getProcessEvents(),
        coreAgentApi.getFileEvents(),
        coreAgentApi.getSecurityEvents(),
        coreAgentApi.getConnections(),
        coreAgentApi.getProcesses(),
      ]);

      setProcessEvents(procEvents);
      setFileEvents(fileEvts);
      setSecurityEvents(secEvents);
      setConnections(conns);
      setProcesses(procs);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch telemetry:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, pollInterval);
    return () => clearInterval(interval);
  }, [fetchTelemetry, pollInterval]);

  return {
    processEvents,
    fileEvents,
    securityEvents,
    connections,
    processes,
    loading,
    refresh: fetchTelemetry,
  };
};
