import React from 'react';

/* ── Reusable Card ──────────────────────────────────────────────────────────── */
export function Card({ children, className = '', onClick }) {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-zinc-950/60 backdrop-blur-3xl rounded-3xl shadow-[0_30px_75px_rgba(0,0,0,0.9)] border border-zinc-800/45 hover:border-indigo-500/25 hover:shadow-[0_0_30px_rgba(99,102,241,0.05)] p-6 card-lift transition-all duration-300 ${className}`}
    >
      {children}
    </div>
  );
}

/* ── Status Badge ───────────────────────────────────────────────────────────── */
const badgeMap = {
  safe:   'bg-green-500/10  text-green-600  dark:text-green-400  border border-green-500/20',
  warn:   'bg-amber-500/10  text-amber-600  dark:text-amber-400  border border-amber-500/20',
  danger: 'bg-rose-500/10   text-rose-600   dark:text-rose-400   border border-rose-500/20',
  info:   'bg-sky-500/10    text-sky-600    dark:text-sky-400    border border-sky-500/20',
};

export function Badge({ status = 'safe', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${badgeMap[status]} ${className}`}>
      {children}
    </span>
  );
}

/* ── Primary Button ─────────────────────────────────────────────────────────── */
const btnColour = {
  blue:   'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white shadow-lg shadow-sky-500/20',
  green:  'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20',
  yellow: 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white shadow-lg shadow-amber-500/20',
  red:    'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-lg shadow-rose-500/20',
  ghost:  'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/40 dark:border-slate-700/60',
  purple: 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/20',
};

export function Button({ colour = 'blue', icon, children, onClick, disabled, loading, id, className = '' }) {
  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm tracking-wide transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${btnColour[colour]} ${className}`}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : icon ? (
        <span className="text-base">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

/* ── Confirmation Modal ─────────────────────────────────────────────────────── */
export function Modal({ open, title, message, onConfirm, onCancel, dangerous }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={onCancel} />
      <div className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-200/50 dark:border-slate-800/80 p-6 max-w-sm w-full fade-up">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl mb-4 mx-auto ${dangerous ? 'bg-rose-500/10 text-rose-500' : 'bg-sky-500/10 text-sky-500'}`}>
          {dangerous ? '⚠️' : '❓'}
        </div>
        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white text-center mb-2 tracking-tight">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-2xl font-bold text-sm text-white transition-all active:scale-95 ${dangerous ? 'bg-rose-500 hover:bg-rose-600' : 'bg-sky-500 hover:bg-sky-600'}`}
          >
            {dangerous ? 'Confirm' : 'Yes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Circular Health Score ──────────────────────────────────────────────────── */
export function HealthRing({ score, colour }) {
  const r = 50;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const strokeMap = { green: '#10b981', yellow: '#f59e0b', red: '#f43f5e' };
  const glowMap = {
    green: 'shadow-[0_0_20px_rgba(16,185,129,0.35)]',
    yellow: 'shadow-[0_0_20px_rgba(245,158,11,0.35)]',
    red: 'shadow-[0_0_20px_rgba(244,63,94,0.35)]'
  };
  const stroke = strokeMap[colour] || '#10b981';

  return (
    <div className={`relative inline-flex items-center justify-center w-40 h-40 rounded-full bg-slate-950/45 border border-zinc-800/10 backdrop-blur-md flex-shrink-0 ${glowMap[colour]}`}>
      <svg className="w-40 h-40 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={stroke} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center whitespace-nowrap">
        <span className="text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">{score}</span>
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Score</span>
      </div>
    </div>
  );
}

/* ── Horizontal Progress Bar ────────────────────────────────────────────────── */
export function ProgressBar({ pct, colour }) {
  const colMap = { safe: 'bg-emerald-400', warn: 'bg-amber-400', danger: 'bg-rose-500' };
  return (
    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-1.5 rounded-full animated-bar ${colMap[colour] || 'bg-sky-400'}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

/* ── Toast Notification ─────────────────────────────────────────────────────── */
export function Toast({ toasts, remove }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end">
      {toasts.map(t => (
        <div
          key={t.id}
          onClick={() => remove(t.id)}
          className={`flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl text-sm font-semibold cursor-pointer border backdrop-blur-xl fade-up max-w-xs transition-all hover:scale-102
            ${t.type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400/20' :
              t.type === 'error'   ? 'bg-rose-500/90 text-white border-rose-400/20' :
              'bg-slate-900/90 text-white border-slate-800'}`}
        >
          <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
