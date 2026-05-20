import React from 'react';
import { Card } from './ui.jsx';
import { generateInsights } from '../api.js';

export default function InsightsPanel({ cpuMem, disk, processes }) {
  const hints = generateInsights(cpuMem, disk, processes);

  return (
    <Card className="fade-up delay-5 border border-slate-200/50 dark:border-slate-800/60">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">Diagnostic Insights</h2>
        <span className="text-2xl filter drop-shadow-sm">💡</span>
      </div>
      <div className="space-y-3.5">
        {hints.map((h, i) => (
          <div
            key={i}
            className="flex items-start gap-4 p-4 bg-zinc-950/20 border border-zinc-900/40 rounded-2xl"
          >
            <span className="text-xl flex-shrink-0 filter drop-shadow-sm">{h.icon}</span>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">{h.text}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
