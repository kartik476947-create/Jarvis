import { useState } from 'react';
import { ProcessEventTable } from './ProcessEventTable';
import { FileEventTable } from './FileEventTable';
import { NetworkTable } from './NetworkTable';
import { SecurityLogTable } from './SecurityLogTable';
import { useTelemetry } from '../../hooks/useTelemetry';
import './TelemetryPanel.css';

type TabType = 'PROCESS' | 'FILES' | 'NET' | 'LOGS';

export const TelemetryPanel = () => {
  const [activeTab, setActiveTab] = useState<TabType>('PROCESS');
  const { processEvents, fileEvents, connections, securityEvents, loading } = useTelemetry();

  return (
    <div className="telemetry-panel">
      <div className="telemetry-header">
        <h3>LIVE TELEMETRY STREAM</h3>
      </div>

      <div className="telemetry-tabs">
        {(['PROCESS', 'FILES', 'NET', 'LOGS'] as TabType[]).map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="telemetry-content">
        {loading && <p>Loading...</p>}
        {!loading && activeTab === 'PROCESS' && <ProcessEventTable events={processEvents} />}
        {!loading && activeTab === 'FILES' && <FileEventTable events={fileEvents} />}
        {!loading && activeTab === 'NET' && <NetworkTable connections={connections} />}
        {!loading && activeTab === 'LOGS' && <SecurityLogTable events={securityEvents} />}
      </div>
    </div>
  );
};
