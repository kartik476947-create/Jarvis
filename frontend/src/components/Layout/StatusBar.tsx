import { useEffect, useState } from 'react';
import { coreAgentApi } from '../../services/coreAgentApi';
import './StatusBar.css';

const MODULE_LABELS: Record<string, string> = {
  integrity: 'INTEGRITY CHECK',
  network_c2: 'NETWORK C2',
  registry: 'REGISTRY MONITOR',
  kernel_etw: 'KERNEL ETW',
  ransomware_shield: 'RANSOMWARE SHIELD',
};

export const StatusBar = () => {
  const [modules, setModules] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      const status = await coreAgentApi.getSystemStatus();
      if (status?.modules) setModules(status.modules);
    };
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  const entries = Object.keys(MODULE_LABELS).map(key => ({
    name: MODULE_LABELS[key],
    status: modules[key] ?? '…',
  }));

  return (
    <div className="status-bar">
      {entries.map(module => (
        <div key={module.name} className="status-module">
          <div className="module-indicator pulse" />
          <div className="module-info">
            <div className="module-name">{module.name}</div>
            <div className="module-status">{module.status}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
