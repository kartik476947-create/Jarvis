import React from 'react';
import { Card, ProgressBar, Badge } from './ui.jsx';
import { humanCpu, humanRam, humanDisk } from '../api.js';

function MetricRow({ icon, label, human, pct, advancedValue, showAdvanced }) {
  const levelBadge = { safe: 'safe', warn: 'warn', danger: 'danger' };
  
  return (
    <div className="flex flex-col gap-2.5 p-4 rounded-2xl bg-zinc-950/20 border border-zinc-900/40">
      <div className="flex items-center gap-3.5">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 shadow-sm
          ${human.level === 'safe' ? 'bg-emerald-950/20 text-emerald-400' :
            human.level === 'warn' ? 'bg-amber-950/20 text-amber-400' :
            'bg-rose-950/20 text-rose-400'}`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight">{label}</span>
            <Badge status={levelBadge[human.level]}>{human.icon} {human.level.toUpperCase()}</Badge>
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{human.text}</p>
          {showAdvanced && (
            <p className="text-xs font-bold text-sky-500 dark:text-sky-400 font-mono mt-1">{advancedValue}</p>
          )}
        </div>
      </div>
      {showAdvanced && <ProgressBar pct={pct} colour={human.level} />}
    </div>
  );
}

export default function PerformanceCard({ cpuMem, disk, advanced }) {
  const cpu     = cpuMem?.cpu_percent ?? 0;
  const ram     = cpuMem?.virtual_memory?.percent ?? 0;
  const ramUsedGb = Math.round((cpuMem?.virtual_memory?.used ?? 0) / 1024 / 1024 / 1024 * 10) / 10;
  const diskPct = disk?.[0]?.usage?.percent ?? 0;

  const cpuH  = humanCpu(cpu);
  const ramH  = humanRam(ram);
  const diskH = humanDisk(diskPct);

  return (
    <Card className="fade-up delay-1 border border-slate-200/50 dark:border-slate-800/60">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">System Performance</h2>
        <span className="text-2xl filter drop-shadow-sm">⚡</span>
      </div>
      <div className="space-y-4">
        <MetricRow
          icon="🖥️" label="Processor (CPU)"
          human={cpuH} pct={cpu}
          advancedValue={`CPU: ${cpu.toFixed(1)}%`}
          showAdvanced={advanced}
        />
        <MetricRow
          icon="🧠" label="Memory (RAM)"
          human={ramH} pct={ram}
          advancedValue={`RAM: ${ram.toFixed(1)}% | Used: ${ramUsedGb} GB`}
          showAdvanced={advanced}
        />
        <MetricRow
          icon="💾" label="Storage"
          human={diskH} pct={diskPct}
          advancedValue={`Disk: ${diskPct.toFixed(1)}% used`}
          showAdvanced={advanced}
        />
      </div>
    </Card>
  );
}
