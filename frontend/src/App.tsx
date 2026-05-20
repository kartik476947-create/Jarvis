import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VoiceOrb, type OrbState } from './components/VoiceOrb/VoiceOrb';
import { Header } from './components/Layout/Header';
import { StatusBar } from './components/Layout/StatusBar';
import { TelemetryPanel } from './components/TelemetryPanel/TelemetryPanel';
import { ProcessPanel } from './components/ProcessPanel/ProcessPanel';
import { useVoiceInput } from './hooks/useVoiceInput';
import { useChat } from './hooks/useChat';
import './styles/global.css';
import './App.css';

export default function App() {
  const { messages, isLoading, sendCommand, clearHistory } = useChat();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [showDashboard, setShowDashboard] = useState(false);
  const conversationRef = useRef<HTMLElement>(null);

  const handleTranscript = useCallback(
    (text: string) => { sendCommand(text); },
    [sendCommand]
  );

  const {
    isListening,
    transcript,
    audioLevel,
    error,
    startListening,
    stopListening,
  } = useVoiceInput(handleTranscript);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const id = window.setInterval(() => {
      setIsSpeaking(window.speechSynthesis.speaking);
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  const orbState: OrbState = useMemo(() => {
    if (isListening) return 'listening';
    if (isLoading) return 'thinking';
    if (isSpeaking) return 'speaking';
    return 'idle';
  }, [isListening, isLoading, isSpeaking]);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [messages, transcript]);

  const handleOrbClick = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    if (isListening && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
  }, [isListening]);

  const handleTextSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const text = textInput.trim();
    if (!text || isLoading) return;
    setTextInput('');
    sendCommand(text);
  }, [textInput, isLoading, sendCommand]);

  const hint = useMemo(() => {
    if (error) return error;
    if (isListening) return 'Listening... speak naturally. I\'ll respond when you pause.';
    if (isLoading) return 'Thinking...';
    if (isSpeaking) return 'Speaking -- tap the orb to interrupt.';
    return 'Tap the orb or type a command below.';
  }, [error, isListening, isLoading, isSpeaking]);

  return (
    <div className="app-root">
      {/* ── Top: Security Header ─────────────────────────────── */}
      <Header />
      <StatusBar />

      {/* ── Voice OS Section ─────────────────────────────────── */}
      <div className="voice-section-wrapper">
        <div className="voice-panel">
          <div className="voice-panel-header">
            <div className="voice-brand">
              <span className="brand-mark" aria-hidden />
              <span className="brand-name">JARVIS</span>
              <span className="brand-sub">VOICE OS</span>
            </div>
            <div className="voice-header-actions">
              <div className={`status-pill status-pill--${orbState}`}>
                <span className="status-dot" />
                {orbState.toUpperCase()}
              </div>
              <button className="clear-btn" onClick={clearHistory} title="Clear conversation">
                ✕ Clear
              </button>
            </div>
          </div>

          <div className="voice-body">
            <div className="orb-stage">
              <VoiceOrb
                state={orbState}
                audioLevel={isListening ? audioLevel : isSpeaking ? 0.35 : 0}
                onClick={handleOrbClick}
                size={200}
              />
            </div>

            <section className="conversation" ref={conversationRef} aria-live="polite">
              {messages.map((msg) => (
                <div key={msg.id} className={`conv-row conv-row--${msg.type === 'user' ? 'user' : 'ai'}`}>
                  <div className="conv-label">{msg.type === 'user' ? 'You' : 'JARVIS'}</div>
                  {msg.isHtml ? (
                    <div
                      className={`conv-bubble conv-bubble--${msg.type === 'user' ? 'user' : 'ai'}`}
                      dangerouslySetInnerHTML={{ __html: msg.content }}
                    />
                  ) : (
                    <div className={`conv-bubble conv-bubble--${msg.type === 'user' ? 'user' : 'ai'}`}>
                      {msg.content}
                    </div>
                  )}
                </div>
              ))}
              {transcript && isListening && (
                <div className="conv-row conv-row--user">
                  <div className="conv-label">You (live)</div>
                  <div className="conv-bubble conv-bubble--user conv-bubble--live">{transcript}</div>
                </div>
              )}
            </section>

            <p className={`hint ${error ? 'hint--error' : ''}`}>{hint}</p>

            <form className="text-input-bar" onSubmit={handleTextSubmit}>
              <input
                type="text"
                className="text-input"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type a command..."
                disabled={isLoading}
              />
              <button type="submit" className="send-btn" disabled={isLoading || !textInput.trim()}>
                Send
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ── Dashboard Toggle ─────────────────────────────────── */}
      <div className="dashboard-toggle-bar">
        <button
          className={`dashboard-toggle ${showDashboard ? 'active' : ''}`}
          onClick={() => setShowDashboard(!showDashboard)}
        >
          {showDashboard ? '▲ HIDE SECURITY DASHBOARD' : '▼ SHOW SECURITY DASHBOARD'}
        </button>
      </div>

      {/* ── Bottom: Dashboard Panels ─────────────────────────── */}
      {showDashboard && (
        <div className="dashboard-section">
          <div className="dashboard-grid">
            <div className="dashboard-col">
              <TelemetryPanel />
            </div>
            <div className="dashboard-col">
              <ProcessPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
