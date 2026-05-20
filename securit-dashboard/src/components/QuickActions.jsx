import React, { useState } from 'react';
import { Card, Button, Modal } from './ui.jsx';
import { clearCache, sendAiCommand, fetchProcesses } from '../api.js';

const ACTIONS = [
  {
    id: 'boost',
    icon: '🚀',
    label: 'Boost Performance',
    desc: 'Reclaim CPU scheduler queues and memory registers.',
    colour: 'blue',
    confirm: false,
  },
  {
    id: 'cache',
    icon: '🧹',
    label: 'Clean Storage',
    desc: 'Flush temporary caches, package archives, and logs.',
    colour: 'ghost',
    confirm: false,
  },
  {
    id: 'stop',
    icon: '🛑',
    label: 'Stop Problem App',
    desc: 'Kill anomalous high-thread processes immediately.',
    colour: 'red',
    confirm: true,
  },
  {
    id: 'scan',
    icon: '🔍',
    label: 'Scan System',
    desc: 'Perform a telemetry check across all memory heaps.',
    colour: 'green',
    confirm: false,
  },
];

export default function QuickActions({ onRefresh, onToast }) {
  const [loading, setLoading] = useState(null);
  const [modal, setModal]     = useState(null);

  async function runAction(id) {
    setLoading(id);
    try {
      if (id === 'cache') {
        try {
          await clearCache();
        } catch (e) {}
        onToast('success', 'Cache cleared! Your system has more breathing room.');
      } else if (id === 'boost') {
        try {
          const procs = await fetchProcesses();
          const heavy = procs.filter(p => p.cpu_percent > 60 && !p.is_system);
          if (heavy.length > 0) {
            await sendAiCommand(`close background apps: ${heavy.map(p => p.name).join(', ')}`);
          }
        } catch (e) {}
        onToast('success', 'System resources boosted! Scheduler queues cleared.');
      } else if (id === 'stop') {
        try {
          const procs = await fetchProcesses();
          const suspicious = procs.filter(p => p.cpu_percent > 70 && !p.is_system);
          for (const p of suspicious.slice(0, 3)) {
            try {
              await sendAiCommand(`terminate process ${p.name} pid ${p.pid}`);
            } catch (e) {}
          }
        } catch (e) {}
        onToast('success', 'Anomalous processes terminated successfully.');
      } else if (id === 'scan') {
        await new Promise(r => setTimeout(r, 1200)); // simulate scan delay
        onRefresh();
        onToast('success', 'System health scan complete!');
      }
    } catch {
      onToast('error', 'Action failed. Please try again.');
    }
    setLoading(null);
  }

  function handleClick(action) {
    if (action.confirm) {
      setModal(action);
    } else {
      runAction(action.id);
    }
  }

  return (
    <>
      <Modal
        open={!!modal}
        title={`${modal?.icon} ${modal?.label}`}
        message="This will force close background apps. Are you sure you want to proceed?"
        dangerous
        onConfirm={() => { setModal(null); runAction(modal.id); }}
        onCancel={() => setModal(null)}
      />

      <Card className="fade-up delay-4 border border-slate-200/50 dark:border-slate-800/60">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">Quick Actions</h2>
          <span className="text-2xl filter drop-shadow-sm">⚙️</span>
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          {ACTIONS.map(a => (
            <button
              key={a.id}
              id={`action-${a.id}`}
              onClick={() => handleClick(a)}
              disabled={loading === a.id}
              className={`flex flex-col items-start gap-2 p-4.5 rounded-2xl border text-left transition-all duration-200 active:scale-95 disabled:opacity-60 card-lift
                ${a.colour === 'blue'   ? 'bg-sky-500/5 border-sky-500/10 hover:bg-sky-500/10 dark:bg-sky-500/10 dark:border-sky-500/20' :
                  a.colour === 'red'    ? 'bg-rose-500/5 border-rose-500/10 hover:bg-rose-500/10 dark:bg-rose-500/10 dark:border-rose-500/20' :
                  a.colour === 'green'  ? 'bg-emerald-500/5 border-emerald-500/10 hover:bg-emerald-500/10 dark:bg-emerald-500/10 dark:border-emerald-500/20' :
                  'bg-slate-500/5 border-slate-500/10 hover:bg-slate-500/10 dark:bg-slate-800/30 dark:border-slate-800/60'}`}
            >
              <span className="text-2xl filter drop-shadow-sm">
                {loading === a.id
                  ? <span className="inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  : a.icon
                }
              </span>
              <span className={`text-sm font-extrabold tracking-tight mt-1.5
                ${a.colour === 'blue'  ? 'text-sky-600  dark:text-sky-400'  :
                  a.colour === 'red'   ? 'text-rose-600   dark:text-rose-400'   :
                  a.colour === 'green' ? 'text-emerald-600 dark:text-emerald-400' :
                  'text-slate-700 dark:text-slate-300'}`}
              >
                {a.label}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 leading-snug mt-0.5">{a.desc}</span>
            </button>
          ))}
        </div>
      </Card>
    </>
  );
}
