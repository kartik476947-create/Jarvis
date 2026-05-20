import { useTelemetry } from '../../hooks/useTelemetry';
import { coreAgentApi } from '../../services/coreAgentApi';
import { RiskBadge } from '../Common';
import { riskLevelToBadge, formatRiskScore, computeProcessRiskFallback } from '../../utils/risk';
import './ProcessPanel.css';

export const ProcessPanel = () => {
  const { processes, loading, refresh } = useTelemetry();

  const handleTerminate = async (pid: number, name: string, isSystem = false) => {
    let warning = `Are you sure you want to terminate process "${name}" (PID ${pid})?`;
    if (isSystem) {
      warning = `?? WARNING: "${name}" is a critical SYSTEM process. Terminating it may cause Windows to crash or become unstable.\n\nAre you sure you want to proceed?`;
    }
    if (!window.confirm(warning)) return;
    const ok = await coreAgentApi.terminateProcess(pid);
    if (ok) {
      alert(`Process "${name}" (PID ${pid}) terminated successfully.`);
      refresh();
    } else {
      alert(`Could not terminate process "${name}" (access denied or process is protected).`);
    }
  };

  const handleQuarantine = async (filepath: string, name: string) => {
    if (!window.confirm(`Are you sure you want to QUARANTINE the executable file for "${name}"?\nPath: ${filepath}`)) return;
    const result = await (coreAgentApi as any).quarantineFile(filepath);
    if (result && result.status === 'Success') {
      alert(`Success: ${result.message}`);
      refresh();
    } else {
      alert(`Error: ${result ? result.message : 'Failed to quarantine file.'} (Requires admin permissions)`);
    }
  };

  const handleInspect = (proc: any) => {
    const cmd = `run: Get-Process -Id ${proc.pid} | Select-Object -Property Id, ProcessName, Path, Company, Description, StartTime, CPU, WorkingSet`;
    const event = new CustomEvent('jarvis-send-command', { detail: cmd });
    window.dispatchEvent(event);
  };

  const riskOf = (p: (typeof processes)[0]) =>
    p.risk_score != null ? p.risk_score : computeProcessRiskFallback(p).risk_score;

  const sorted = [...processes].sort((a, b) => riskOf(b) - riskOf(a));

  return (
    <div className="process-panel">
      <div className="panel-header">
        <h3>SYSTEM BEHAVIOR & RISK ANALYSIS</h3>
        <button type="button" onClick={() => refresh()}>SCAN ALL PROCESSES</button>
      </div>

      <div className="panel-content">
        <table>
          <thead>
            <tr>
              <th>PROCESS & EXE PATH</th>
              <th>PID / PARENT</th>
              <th>CPU %</th>
              <th>MEM % / VMS</th>
              <th>DISK I/O</th>
              <th>THREADS / HANDLES / NET</th>
              <th>STATUS / USER</th>
              <th>RISK</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9}>Loading live processes...</td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={9}>No processes — ensure core agent is running on port 8000</td>
              </tr>
            ) : (
              sorted.slice(0, 50).map(proc => {
                const risk =
                  proc.risk_score != null
                    ? { risk_score: proc.risk_score, risk_level: proc.risk_level ?? 'LOW' }
                    : computeProcessRiskFallback(proc);
                const score = risk.risk_score;
                const level = risk.risk_level;
                const badge = riskLevelToBadge(level);
                const exe = proc.exe && proc.exe !== 'N/A' ? proc.exe : proc.name;

                return (
                  <tr key={proc.pid} className={score >= 60 ? 'row-high-risk' : ''}>
                    <td title={exe}>{proc.name}</td>
                    <td>{proc.pid} / {proc.ppid ?? '—'}</td>
                    <td>{Math.min(proc.cpu_percent, 100).toFixed(1)}</td>
                    <td>{proc.memory_percent.toFixed(1)} / {(proc.mem_vms_mb ?? 0).toFixed(0)} MB</td>
                    <td>{(proc.io_read_mb ?? 0).toFixed(1)} / {(proc.io_write_mb ?? 0).toFixed(1)}</td>
                    <td>{proc.num_threads ?? '—'} | {proc.handles ?? '—'} | {proc.net_connections ?? 0}</td>
                    <td>{(proc.status ?? 'unknown').toUpperCase()} / {proc.username ?? '—'}</td>
                    <td>
                      <div className="risk-cell">
                        <RiskBadge level={badge} text={formatRiskScore(score)} />
                        <span className="risk-level-label">{level}</span>
                      </div>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button
                          type="button"
                          className="danger action-btn"
                          onClick={() => handleTerminate(proc.pid, proc.name, proc.is_system)}
                          title="Terminate process"
                        >
                          KILL
                        </button>
                        {proc.exe && proc.exe !== 'N/A' && (
                          <button
                            type="button"
                            className="warning action-btn"
                            onClick={() => handleQuarantine(proc.exe, proc.name)}
                            title="Quarantine executable file"
                          >
                            QUAR
                          </button>
                        )}
                        <button
                          type="button"
                          className="info action-btn"
                          onClick={() => handleInspect(proc)}
                          title="Inspect process details via host OS"
                        >
                          INSP
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};


