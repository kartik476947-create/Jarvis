import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchCpuMem, fetchDisk, fetchProcesses, fetchConnections,
  computeHealthScore
} from './api.js';
import { Toast } from './components/ui.jsx';
import HealthCard      from './components/HealthCard.jsx';
import PerformanceCard from './components/PerformanceCard.jsx';
import SecurityCard    from './components/SecurityCard.jsx';
import VoiceAssistant  from './components/VoiceAssistant.jsx';
import QuickActions    from './components/QuickActions.jsx';
import InsightsPanel   from './components/InsightsPanel.jsx';

// ── Toast hook ─────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((type, message) => {
    const id = Date.now();
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  const remove = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []);
  return { toasts, add, remove };
}

// ── Advanced Table (only shown in Advanced mode) ───────────────────────────────
function AdvancedTable({ processes }) {
  if (!processes?.length) return null;
  return (
    <div className="fade-up overflow-hidden rounded-3xl border border-slate-200/50 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl shadow-slate-200/40 dark:shadow-black/35">
      <div className="px-6 py-5 border-b border-slate-200/20 dark:border-slate-800/40 flex items-center gap-2.5">
        <span className="text-lg">📊</span>
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">Active Process Diagnostics</h2>
        <span className="ml-auto text-[10px] font-bold text-sky-500 uppercase tracking-widest bg-sky-500/10 px-2 py-0.5 rounded-md">Diagnostic Mode</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="bg-slate-100/50 dark:bg-slate-950/40 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <th className="px-5 py-3">Process</th>
              <th className="px-5 py-3">PID</th>
              <th className="px-5 py-3 text-right">CPU %</th>
              <th className="px-5 py-3 text-right">RAM %</th>
              <th className="px-5 py-3 text-right">RSS MB</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">User</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/20 dark:divide-slate-800/40 font-medium">
            {processes.slice(0, 20).map(p => (
              <tr key={p.pid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                <td className="px-5 py-3 font-bold text-slate-800 dark:text-slate-200">
                  {p.is_system && <span className="text-rose-400 mr-1 text-[10px] font-bold">[SYS]</span>}
                  {p.name}
                </td>
                <td className="px-5 py-3 font-mono text-slate-400 dark:text-slate-500">{p.pid}</td>
                <td className={`px-5 py-3 font-mono text-right ${p.cpu_percent > 60 ? 'text-rose-500 font-extrabold' : 'text-slate-600 dark:text-slate-400'}`}>
                  {p.cpu_percent?.toFixed(1)}%
                </td>
                <td className="px-5 py-3 font-mono text-right text-slate-600 dark:text-slate-400">
                  {p.memory_percent?.toFixed(1)}%
                </td>
                <td className="px-5 py-3 font-mono text-right text-slate-400 dark:text-slate-500">{p.mem_rss_mb}</td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase
                    ${p.status === 'running' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-400 dark:text-slate-500 truncate max-w-[120px]">{p.username}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const dark = true;
  const advanced = false;
  const [loading, setLoading]   = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [cpuMem,      setCpuMem]      = useState(null);
  const [disk,        setDisk]        = useState(null);
  const [processes,   setProcesses]   = useState([]);
  const [connections, setConnections] = useState([]);

  const { toasts, add: toast, remove: removeToast } = useToast();
  const intervalRef = useRef(null);

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [cm, dk, pr, cn] = await Promise.allSettled([
        fetchCpuMem(),
        fetchDisk(),
        fetchProcesses(),
        fetchConnections(),
      ]);
      if (cm.status === 'fulfilled') setCpuMem(cm.value);
      if (dk.status === 'fulfilled') setDisk(Array.isArray(dk.value) ? dk.value : [dk.value]);
      if (pr.status === 'fulfilled') setProcesses(pr.value);
      if (cn.status === 'fulfilled') setConnections(Array.isArray(cn.value) ? cn.value : []);
      setLastUpdated(new Date());
    } catch {
      toast('error', 'Could not reach SECURIT Core Agent');
    }
    setLoading(false);
  }, [toast]);

  // Initial load + 15s auto-refresh
  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, 15000);
    return () => clearInterval(intervalRef.current);
  }, [refresh]);

  const health = computeHealthScore(cpuMem, disk, processes);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${dark ? 'dark' : ''}`}>
      <div className="min-h-screen pb-10">

        {/* ── Top Navigation ── */}
        <header className="sticky top-0 z-40 bg-black/60 backdrop-blur-3xl border-b border-zinc-900 transition-all">
          <div className="w-full px-8 py-4.5 flex items-center gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-base font-extrabold shadow-md shadow-indigo-500/20 select-none">
                S
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-none tracking-tight">SECURIT OS AI</p>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 leading-none mt-1">Your PC Guardian</p>
              </div>
            </div>

            {/* Health pill */}
            <div className={`hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold shadow-sm border transition-all whitespace-nowrap
              ${health.colour === 'green' ? 'bg-emerald-500/5 text-emerald-600 border-emerald-500/10 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
                health.colour === 'yellow' ? 'bg-amber-500/5 text-amber-600 border-amber-500/10 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' :
                'bg-rose-500/5 text-rose-600 border-rose-500/10 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'}`}>
              <span className={`w-2 h-2 rounded-full animate-pulse flex-shrink-0
                ${health.colour === 'green' ? 'bg-emerald-500' : health.colour === 'yellow' ? 'bg-amber-500' : 'bg-rose-500'}`} />
              {health.colour === 'green' ? 'System Healthy' : health.colour === 'yellow' ? 'Attention Needed' : 'Action Required'}
            </div>

            <div className="ml-auto flex items-center gap-3">
              {/* Last updated */}
              {lastUpdated && (
                <span className="hidden md:block text-xs font-bold text-slate-400 dark:text-slate-500">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}

              {/* Refresh button */}
              <button
                onClick={refresh}
                disabled={loading}
                className="p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-all disabled:opacity-50 border border-transparent hover:border-slate-200/50 dark:hover:border-slate-700/60"
                title="Refresh"
              >
                <span className={`inline-block text-base ${loading ? 'animate-spin' : ''}`}>🔄</span>
              </button>

              {/* Profile Avatar */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-extrabold text-white border border-indigo-400/20 select-none shadow-sm cursor-pointer hover:scale-105 transition-transform" title="User Profile">
                UD
              </div>
            </div>
          </div>
        </header>

        {/* ── Main Grid (Apple + Windows + Jarvis Premium 3-Column Layout) ── */}
        <main className="w-full px-8 pt-8 grid gap-6 grid-cols-1 lg:grid-cols-3">
          
          {/* COLUMN 1: LEFT PANEL (VOICE AI) */}
          <div className="flex flex-col h-full">
            <VoiceAssistant onToast={toast} />
          </div>

          {/* COLUMN 2: CENTER PANEL (MAIN FOCUS) */}
          <div className="flex flex-col gap-6">
            <HealthCard
              score={health.score}
              colour={health.colour}
              label={health.label}
              issues={health.issues}
              loading={loading && !cpuMem}
            />
            <PerformanceCard cpuMem={cpuMem} disk={disk} advanced={advanced} />
          </div>

          {/* COLUMN 3: RIGHT PANEL (SECURITY, ACTIONS & INSIGHTS) */}
          <div className="flex flex-col gap-6">
            <SecurityCard
              processes={processes}
              connections={connections}
              advanced={advanced}
              onToast={toast}
            />
            <QuickActions onRefresh={refresh} onToast={toast} />
            <InsightsPanel cpuMem={cpuMem} disk={disk} processes={processes} />
          </div>

        </main>

        {/* ── Footer ── */}
        <footer className="w-full px-8 mt-12 text-center text-xs font-semibold text-slate-400 dark:text-slate-600">
          SECURIT OS AI &nbsp;·&nbsp; {advanced ? 'Diagnostic Dashboard' : 'Beginner Companion'} &nbsp;·&nbsp; Telemetry Auto-refresh (15s)
        </footer>
      </div>

      <Toast toasts={toasts} remove={removeToast} />
    </div>
  );
}
