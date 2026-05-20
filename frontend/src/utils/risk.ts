export type RiskLevel = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export type RiskBadgeLevel = 'safe' | 'warn' | 'err';

export const riskLevelToBadge = (level: string): RiskBadgeLevel => {
  const u = level.toUpperCase();
  if (u === 'CRITICAL' || u === 'HIGH') return 'err';
  if (u === 'ELEVATED' || u === 'MODERATE') return 'warn';
  return 'safe';
};

export const riskLevelColor = (level: string): string => {
  const u = level.toUpperCase();
  if (u === 'CRITICAL') return '#f87171';
  if (u === 'HIGH') return '#fb923c';
  if (u === 'ELEVATED') return '#fbbf24';
  if (u === 'MODERATE') return '#a3e635';
  return '#4ade80';
};

export const formatRiskScore = (score: number): string => `${Math.round(score)}`;

/** Client fallback when API omits risk_score (matches backend weights). */
export const computeProcessRiskFallback = (proc: {
  cpu_percent: number;
  memory_percent: number;
  num_threads?: number;
  handles?: number;
  net_connections?: number;
  io_read_mb?: number;
  io_write_mb?: number;
  is_system?: boolean;
}): { risk_score: number; risk_level: string } => {
  const cpu = Math.min(100, Math.max(0, proc.cpu_percent || 0));
  const mem = Math.min(100, Math.max(0, proc.memory_percent || 0));
  const threads = proc.num_threads ?? 0;
  const handles = proc.handles ?? 0;
  const conns = proc.net_connections ?? 0;
  const io = (proc.io_read_mb ?? 0) + (proc.io_write_mb ?? 0);

  let score =
    (cpu / 100) ** 1.1 * 42 +
    (mem / 100) ** 1.05 * 28 +
    Math.min(threads / 120, 1) * 12 +
    Math.min(handles / 1200, 1) * 10 +
    Math.min(conns / 12, 1) * 6 +
    Math.min(io / 300, 1) * 4;

  if (score < 8 && (threads >= 1 || handles >= 20)) {
    score = Math.max(score, 6 + Math.min(threads / 30, 4) + Math.min(handles / 400, 4));
  }
  if (proc.is_system && score < 50) score *= 0.8;

  score = Math.round(Math.min(100, Math.max(1, score)) * 10) / 10;
  const level =
    score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 40 ? 'ELEVATED' : score >= 20 ? 'MODERATE' : 'LOW';
  return { risk_score: score, risk_level: level };
};
