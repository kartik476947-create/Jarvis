import { CSSProperties } from 'react';
import './VoiceOrb.css';

export type OrbState = 'idle' | 'listening' | 'speaking' | 'thinking';

interface VoiceOrbProps {
  state: OrbState;
  audioLevel?: number; // 0..1
  onClick?: () => void;
  size?: number;       // px, default 320
}

export function VoiceOrb({ state, audioLevel = 0, onClick, size = 320 }: VoiceOrbProps) {
  const level = Math.max(0, Math.min(1, audioLevel));

  // CSS custom properties drive the visual pulse so we don't re-render styles
  const style: CSSProperties = {
    '--orb-size': `${size}px`,
    '--audio-level': level.toFixed(3),
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`voice-orb voice-orb--${state}`}
      onClick={onClick}
      style={style}
      aria-label={`Voice assistant ${state}`}
      aria-pressed={state === 'listening'}
    >
      <span className="orb-ring orb-ring--outer" aria-hidden />
      <span className="orb-ring orb-ring--middle" aria-hidden />
      <span className="orb-ring orb-ring--inner" aria-hidden />
      <span className="orb-core" aria-hidden>
        <span className="orb-core-highlight" />
        <span className="orb-core-shadow" />
      </span>
      <span className="orb-aura" aria-hidden />
    </button>
  );
}
