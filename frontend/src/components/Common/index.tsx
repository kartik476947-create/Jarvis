export interface RiskBadgeProps {
  level: 'safe' | 'warn' | 'err';
  text: string;
}

export const RiskBadge = ({ level, text }: RiskBadgeProps) => (
  <span className={`risk-badge ${level}`}>{text}</span>
);

export const LoadingSpinner = () => <div className="spinner" />;
