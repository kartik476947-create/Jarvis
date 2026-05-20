import React from 'react';
import { Card, HealthRing, Badge } from './ui.jsx';

export default function HealthCard({ score, colour, label, issues, loading }) {
  if (loading) {
    return (
      <Card className="fade-up col-span-full flex items-center gap-6 animate-pulse">
        <div className="w-36 h-36 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0" />
        <div className="flex-1 space-y-4">
          <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-xl w-1/3" />
          <div className="h-4 bg-slate-100 dark:bg-slate-700/50 rounded-xl w-1/2" />
        </div>
      </Card>
    );
  }

  const statusBadge = colour === 'green' ? 'safe' : colour === 'yellow' ? 'warn' : 'danger';
  const badgeLabel = colour === 'green' ? 'System Protected' : colour === 'yellow' ? 'Attention Needed' : 'Action Required';

  const cardBorder = colour === 'green' ? 'hover:border-emerald-500/30' : colour === 'yellow' ? 'hover:border-amber-500/30' : 'hover:border-rose-500/30';

  return (
    <Card className={`fade-up col-span-full flex flex-col md:flex-row items-center md:items-start gap-8 ${cardBorder}`}>
      {/* Score gauge container */}
      <div className="flex-shrink-0 flex flex-col items-center gap-3">
        <HealthRing score={score} colour={colour} />
        <Badge status={statusBadge} className="shadow-sm">
          {badgeLabel}
        </Badge>
      </div>

      {/* Details container */}
      <div className="flex-1 text-center md:text-left min-w-0">
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
          {score >= 75 ? 'Your system is running smoothly' : 'Your system needs attention'}
        </h2>
        <p className="text-base font-semibold text-slate-500 dark:text-slate-400 mb-6">
          {score >= 75 ? 'No major issues detected' : 'Optimization actions recommended.'}
        </p>

        {issues.length > 0 && (
          <div className="space-y-3 bg-slate-950/20 dark:bg-slate-900/20 border border-slate-200/10 dark:border-slate-800/30 rounded-2xl p-5 text-left">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Detections & Warnings</p>
            <div className="grid gap-2">
              {issues.map((iss, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300 font-semibold">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colour === 'green' ? 'bg-emerald-400' : colour === 'yellow' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                  {iss}
                </div>
              ))}
            </div>
          </div>
        )}

        {issues.length === 0 && (
          <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 rounded-2xl p-4 inline-flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold">
              All defenses active and optimal. Your system is safe.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
