import { useEffect, useState } from 'react';
import { coreAgentApi } from '../../services/coreAgentApi';
import type { SystemStatus } from '../../types';
import { riskLevelColor } from '../../utils/risk';
import './Header.css';

export const Header = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    const load = async () => {
      const data = await coreAgentApi.getSystemStatus();
      setStatus(data);
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const risk = status?.risk_percent ?? 0;
  const level = (status?.risk_level ?? 'LOW').toUpperCase();
  const accent = riskLevelColor(level);
  const factors = status?.risk_factors;

  return (
    <div className="header">
      <div className="header-left">
        <h1 className="jarvis-logo">
          JARVIS
          <span className="version">v1.2 LIVE</span>
        </h1>
      </div>

      <div className="header-status">
        <div className={`status-indicator ${status?.shield_active ? '' : 'off'}`}>
          <span className="dot pulse" />
          SHIELD {status?.shield_active ? 'ACTIVE' : 'OFF'}
        </div>
        <div className={`status-indicator ${status?.ipc_connected ? '' : 'off'}`}>
          <span className="dot pulse" />
          IPC {status?.ipc_connected ? 'CONNECTED' : 'STANDBY'}
        </div>
        <div className={`status-indicator ${status?.boot_secure ? '' : 'off'}`}>
          <span className="dot pulse" />
          BOOT {status?.boot_secure ? 'SECURE' : 'CHECK'}
        </div>
        <div className={`status-indicator ${status?.mem_secure ? '' : 'off'}`}>
          <span className="dot pulse" />
          MEM {status?.mem_secure ? 'OK' : 'HIGH'}
        </div>
        <div className={`status-indicator ${status?.beh_secure ? '' : 'off'}`}>
          <span className="dot pulse" />
          BEH {status?.beh_secure ? 'SECURE' : 'ALERT'}
        </div>
      </div>

      <div className="header-right">
        <div className="risk-meter">
          <div className="risk-meter-top">
            <label>SYSTEM RISK</label>
            <span className="risk-level-badge" style={{ color: accent, borderColor: accent }}>
              {level}
            </span>
          </div>
          <div className="risk-score-row">
            <span className="risk-value" style={{ color: accent }}>{risk.toFixed(1)}</span>
            <span className="risk-value-suffix">/ 100</span>
          </div>
          <div className="meter-bar">
            <div
              className="meter-fill"
              style={{ width: `${risk}%`, backgroundColor: accent }}
            />
          </div>
          {factors && (
            <div className="risk-factors">
              <span title="CPU load contribution">CPU {factors.cpu}</span>
              <span title="Memory pressure">MEM {factors.memory}</span>
              <span title="Hot / anomalous processes">PROC {factors.processes}</span>
              <span title="Security events">SEC {factors.security}</span>
            </div>
          )}
          {status && (
            <span className="data-source">
              Host load · CPU {status.cpu_percent}% · RAM {status.memory_percent}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
