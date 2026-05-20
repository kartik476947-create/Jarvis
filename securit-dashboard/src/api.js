// Shared API helper — talks to the SECURIT Core Agent (port 8000) and AI Engine (port 8001)
const CORE = 'http://127.0.0.1:8000';
const AI   = 'http://127.0.0.1:8001';

// ─── Raw data fetchers ─────────────────────────────────────────────────────────
export async function fetchSystemInfo()    { return _get(`${CORE}/api/system/info`); }
export async function fetchCpuMem()        { return _get(`${CORE}/api/system/cpu_mem`); }
export async function fetchDisk()          { return _get(`${CORE}/api/system/disk`); }
export async function fetchProcesses()     { return _get(`${CORE}/api/system/processes`); }
export async function fetchOsInfo()        { return _get(`${CORE}/api/system/os_info`); }
export async function fetchConnections()   { return _get(`${CORE}/api/system/connections`); }

export async function clearCache()         { return _post(`${CORE}/api/system/cache/clear`); }

export async function sendAiCommand(text) {
  return _post(`${AI}/api/ai/parse_command`, { text });
}

export async function terminateProcess(pid) {
  return _post(`${CORE}/api/terminate/${pid}`, {});
}

export async function blockIp(ip) {
  return _post(`${CORE}/api/firewall/block?ip=${ip}`, {});
}

// ─── Human-readable translators ────────────────────────────────────────────────

/**
 * Returns { score, status, label, colour } from raw system data.
 * score  = 0..100
 * status = 'safe' | 'warn' | 'danger'
 */
export function computeHealthScore(cpuMem, disk, processes) {
  let score = 100;
  const issues = [];

  // CPU
  const cpu = cpuMem?.cpu_percent ?? 0;
  if (cpu > 85)       { score -= 25; issues.push('Processor Congestion: CPU scheduler is under heavy execution stress.'); }
  else if (cpu > 60)  { score -= 10; issues.push('Elevated Processor Threads: CPU load is rising above standard baseline.'); }

  // RAM
  const ram = cpuMem?.virtual_memory?.percent ?? 0;
  if (ram > 85)       { score -= 20; issues.push('RAM Saturation: Available physical memory is heavily allocated.'); }
  else if (ram > 65)  { score -= 8;  issues.push('Memory Overhead: RAM registers show moderate background usage.'); }

  // Disk
  const diskPct = disk?.[0]?.usage?.percent ?? 0;
  if (diskPct > 90)   { score -= 20; issues.push('Disk Capacity Limit: Available disk sectors are below 10% on primary volume.'); }
  else if (diskPct > 75) { score -= 8; issues.push('Disk Capacity Warning: Storage usage is expanding beyond normal range.'); }

  // Suspicious processes (high cpu)
  const suspicious = (processes || []).filter(p => p.cpu_percent > 70);
  if (suspicious.length > 0) {
    score -= 15;
    issues.push(`${suspicious.length} anomalous process thread(s) consuming excessive CPU cycles.`);
  }

  score = Math.max(0, Math.min(100, score));

  let status = 'safe', colour = 'green';
  if (score < 50)      { status = 'danger'; colour = 'red'; }
  else if (score < 75) { status = 'warn';   colour = 'yellow'; }

  const label = score >= 75
    ? 'Shield Active: System resources optimized and operating within safe thresholds. ✅'
    : score >= 50
      ? 'Shield Status Alert: Low-level diagnostics indicate optimization opportunities. ⚠️'
      : 'Critical Defense Action Needed: Anomalous resource patterns detected in active threads. ❗';

  return { score, status, colour, label, issues };
}

export function humanCpu(pct) {
  if (pct < 30) return { text: 'Running smoothly', icon: '🟢', level: 'safe' };
  if (pct < 65) return { text: 'Moderately busy', icon: '🟡', level: 'warn' };
  return           { text: 'CPU overloaded', icon: '🔴', level: 'danger' };
}

export function humanRam(pct) {
  if (pct < 50) return { text: 'Plenty of memory available', icon: '🟢', level: 'safe' };
  if (pct < 75) return { text: 'Memory usage is moderate', icon: '🟡', level: 'warn' };
  return           { text: 'Memory is almost full', icon: '🔴', level: 'danger' };
}

export function humanDisk(pct) {
  if (pct < 60) return { text: 'Plenty of storage available', icon: '🟢', level: 'safe' };
  if (pct < 85) return { text: 'Storage is getting full', icon: '🟡', level: 'warn' };
  return           { text: 'Storage almost full', icon: '🔴', level: 'danger' };
}

export function generateInsights(cpuMem, disk, processes) {
  const hints = [];
  const cpu    = cpuMem?.cpu_percent ?? 0;
  const ram    = cpuMem?.virtual_memory?.percent ?? 0;
  const diskPct = disk?.[0]?.usage?.percent ?? 0;
  const procCount = (processes || []).length;

  if (procCount > 40)
    hints.push({ icon: '📦', text: `Process Congestion: ${procCount} active processes are running. Pruning background daemons can free scheduler slots.` });
  if (cpu > 60)
    hints.push({ icon: '🔥', text: 'Execution Spike: A background thread is drawing high CPU power. Terminate anomalous tasks to cool cores.' });
  if (ram > 75)
    hints.push({ icon: '🧠', text: 'Memory Saturation: RAM modules are reaching threshold limits. Clear caches or terminate idle IDEs.' });
  if (diskPct > 80)
    hints.push({ icon: '💾', text: 'Disk Congestion: Storage blocks are exceeding 80% capacity. Delete temp files and npm caches to regain workspace sectors.' });
  if (hints.length === 0)
    hints.push({ icon: '🌟', text: 'Optimal State: Guardian shield active. Core telemetry stream confirms perfect system health.' });

  return hints;
}

// ─── Private helpers ───────────────────────────────────────────────────────────
async function _get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function _post(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

