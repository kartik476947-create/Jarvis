import { useCallback, useEffect, useRef, useState } from 'react';
import { aiEngineApi } from '../services/aiEngineApi';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnySpeechRecognition = any;

const SILENCE_MS = 1800;
const MIN_SUBMIT_CHARS = 1;

/**
 * Continuous, hands-free voice input with cross-browser fallback.
 *
 * Strategy:
 *  1. Try Web Speech API (Chrome, Edge, Safari 14.1+) for real-time transcription.
 *  2. If unavailable, fall back to MediaRecorder + Groq Whisper for transcription.
 *
 * In both modes we run a Web Audio AnalyserNode for the visualizer's audioLevel.
 */
export const useVoiceInput = (onTranscript?: (text: string) => void) => {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const recognitionRef = useRef<AnySpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const intentRef = useRef<'idle' | 'listening'>('idle');
  const onTranscriptRef = useRef(onTranscript);
  const lastLevelRef = useRef(0);
  const modeRef = useRef<'speech-api' | 'media-recorder'>('speech-api');

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // ─── Shared teardown ──────────────────────────────────────────────
  const teardown = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch { /* already stopped */ }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* */ }
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    lastLevelRef.current = 0;
    setAudioLevel(0);
  }, []);

  // ─── Deliver final text ───────────────────────────────────────────
  const deliverTranscript = useCallback((text: string) => {
    if (text.length >= MIN_SUBMIT_CHARS) {
      setTranscript(text);
      setIsTranscribing(true);
      try {
        onTranscriptRef.current?.(text);
      } finally {
        setTimeout(() => setIsTranscribing(false), 0);
      }
    }
  }, []);

  // ─── Finalize (Speech API mode) ──────────────────────────────────
  const finalize = useCallback(() => {
    if (intentRef.current !== 'listening') return;
    intentRef.current = 'idle';
    const text = finalTranscriptRef.current.trim();
    finalTranscriptRef.current = '';
    teardown();
    setIsListening(false);
    deliverTranscript(text);
  }, [teardown, deliverTranscript]);

  // ─── Finalize (MediaRecorder mode) ───────────────────────────────
  const finalizeRecording = useCallback(async () => {
    intentRef.current = 'idle';
    teardown();
    setIsListening(false);

    const chunks = audioChunksRef.current;
    if (chunks.length === 0) return;

    const mimeType = chunks[0]?.type || 'audio/webm';
    const audioBlob = new Blob(chunks, { type: mimeType });
    audioChunksRef.current = [];

    if (audioBlob.size < 1000) return; // too small, probably silence

    setIsTranscribing(true);
    try {
      const text = await aiEngineApi.transcribeAudio(audioBlob);
      if (text.trim()) {
        setTranscript(text.trim());
        onTranscriptRef.current?.(text.trim());
      }
    } catch (e) {
      console.error('Transcription failed:', e);
    } finally {
      setIsTranscribing(false);
    }
  }, [teardown]);

  const armSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
    }
    if (modeRef.current === 'speech-api') {
      silenceTimerRef.current = window.setTimeout(finalize, SILENCE_MS);
    } else {
      silenceTimerRef.current = window.setTimeout(finalizeRecording, SILENCE_MS + 500);
    }
  }, [finalize, finalizeRecording]);

  // ─── Audio visualizer meter ───────────────────────────────────────
  const startAudioMeter = useCallback((stream: MediaStream) => {
    try {
      const AC: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        const a = analyserRef.current;
        if (!a) return;
        a.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        const avg = sum / buf.length / 255;
        const level = Math.min(1, avg * 2.4);
        if (Math.abs(level - lastLevelRef.current) > 0.02) {
          lastLevelRef.current = level;
          setAudioLevel(level);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      console.warn('Audio meter init failed:', e);
    }
  }, []);

  // ─── Start listening ──────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (intentRef.current === 'listening') return;

    setError(null);
    setTranscript('');
    finalTranscriptRef.current = '';

    // Acquire mic stream first
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e: any) {
      setError(e?.message || 'Microphone access denied.');
      return;
    }
    streamRef.current = stream;
    startAudioMeter(stream);

    // Decide mode: SpeechRecognition or MediaRecorder
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SR) {
      // ──── Speech API mode ─────────────────────────────────────
      modeRef.current = 'speech-api';

      const recognition: AnySpeechRecognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-GB';
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let interim = '';
        let finalText = finalTranscriptRef.current;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const txt: string = res[0]?.transcript ?? '';
          if (res.isFinal) finalText += txt + ' ';
          else interim += txt;
        }
        finalTranscriptRef.current = finalText;
        setTranscript((finalText + interim).trim());
        armSilenceTimer();
      };

      recognition.onerror = (e: any) => {
        const err = e?.error;
        if (err === 'no-speech' || err === 'aborted') return;
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          setError('Microphone permission denied.');
          intentRef.current = 'idle';
          teardown();
          setIsListening(false);
          return;
        }
        console.warn('SpeechRecognition error:', err);
      };

      recognition.onend = () => {
        if (intentRef.current === 'listening' && recognitionRef.current === recognition) {
          try { recognition.start(); } catch { /* already starting */ }
        }
      };

      recognitionRef.current = recognition;
      intentRef.current = 'listening';

      try {
        recognition.start();
      } catch (e) {
        console.error('Failed to start recognition:', e);
        setError('Could not start speech recognition.');
        teardown();
        return;
      }
    } else {
      // ──── MediaRecorder fallback (Firefox, etc.) ──────────────
      modeRef.current = 'media-recorder';
      intentRef.current = 'listening';

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // finalization is handled by armSilenceTimer → finalizeRecording
      };

      mediaRecorder.start(500); // collect in 500ms chunks for smoother processing
    }

    setIsListening(true);
    armSilenceTimer();
  }, [armSilenceTimer, startAudioMeter, teardown]);

  // ─── Stop listening ───────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (intentRef.current === 'listening') {
      if (modeRef.current === 'speech-api') {
        finalize();
      } else {
        finalizeRecording();
      }
    } else {
      teardown();
      setIsListening(false);
    }
  }, [finalize, finalizeRecording, teardown]);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
    finalTranscriptRef.current = '';
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    intentRef.current = 'idle';
    teardown();
  }, [teardown]);

  return {
    isListening,
    isTranscribing,
    transcript,
    audioLevel,
    error,
    startListening,
    stopListening,
    reset,
  };
};
