import { TelemetryPanel } from '../TelemetryPanel/TelemetryPanel';
import { ProcessPanel } from '../ProcessPanel/ProcessPanel';
import { AICoPilot } from '../AICoPilot/AICoPilot';
import './Workspace.css';

export const Workspace = () => (
  <div className="workspace">
    <div className="workspace-column">
      <TelemetryPanel />
    </div>
    <div className="workspace-column">
      <ProcessPanel />
    </div>
    <div className="workspace-column">
      <AICoPilot />
    </div>
  </div>
);
