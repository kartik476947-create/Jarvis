import React, { useState, useRef, useEffect } from 'react';
import { Card } from './ui.jsx';

const EXAMPLES = [
  'Why is my system slow?',
  'Close Chrome',
  'Check my internet',
  'Is my PC safe?',
  'Free up memory',
];

export default function VoiceAssistant({ onToast }) {
  const [messages, setMessages] = useState([
    {
      sender: 'Jarvis',
      text: 'Greetings, Operator. I am JARVIS — your core systems co-pilot. I have established a secure telemetry link to monitor CPU scheduler queues, memory tables, and active network interfaces. Issue commands by voice or text (e.g., "Jarvis check system health").',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [statusText, setStatusText] = useState('Co-pilot standby. Click the microphone or type below to interface with JARVIS.');
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const messagesEndRef = useRef(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Real-time Event Listener to WebSocket
  useEffect(() => {
    let ws;
    function connect() {
      ws = new WebSocket("ws://127.0.0.1:8000/ws");
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const isThreat = data && (
            data.type === "THREAT" || 
            data.event === "THREAT" || 
            data.event_type === "THREAT" || 
            (data.event_type === "SECURITY_LOG" && data.data?.severity === "CRITICAL")
          );
          if (isThreat) {
            const msg = data.message || data.details || data.data?.description || "Critical threat detected.";
            const alertText = `Warning: Critical threat detected. ${msg}. Do you want me to stop it?`;
            
            setMessages(prev => [
              ...prev,
              {
                sender: "Jarvis",
                text: alertText,
                timestamp: new Date().toLocaleTimeString(),
                parsedData: data
              }
            ]);
            
            speak(alertText);
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onclose = () => {
        setTimeout(connect, 5000);
      };

      ws.onerror = (err) => {
        console.error("WebSocket connection error:", err);
        ws.close();
      };
    }

    connect();
    return () => {
      if (ws) ws.close();
    };
  }, []);

  // TTS helper
  function speak(text) {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.98;
      window.speechSynthesis.speak(utterance);
    }
  }

  // Handle command parsing & response
  async function processUserCommand(text) {
    setLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:8001/api/ai/parse_command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      if (!response.ok) throw new Error("AI Engine error");

      const parsed = await response.json();
      let reply = parsed.response || 'Command executed.';

      setMessages(prev => [
        ...prev,
        {
          sender: 'Jarvis',
          text: reply,
          technicalDetails: parsed.technical_details,
          executionPlan: parsed.execution_plan,
          confirmationRequired: parsed.confirmation_required,
          timestamp: new Date().toLocaleTimeString(),
          parsedData: parsed
        }
      ]);

      speak(reply);
    } catch (err) {
      console.error(err);
      const errMsg = "I'm having trouble communicating with the AI Engine. Please check if launcher services are active.";
      setMessages(prev => [
        ...prev,
        {
          sender: 'Jarvis',
          text: errMsg,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
      speak(errMsg);
      onToast('error', 'AI Assistant offline');
    } finally {
      setLoading(false);
    }
  }

  // Voice recording triggers
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendAudioToWhisper(audioBlob);
      };

      recorder.start();
      setListening(true);
      setStatusText("Recording voice command (Groq Whisper)...");
    } catch (err) {
      console.error("Microphone access failed:", err);
      onToast('error', 'Microphone access denied or device not found.');
      speak("Microphone access denied.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setListening(false);
  }

  async function toggleListening() {
    if (listening) {
      stopRecording();
    } else {
      await startRecording();
    }
  }

  async function sendAudioToWhisper(blob) {
    setStatusText("Transcribing voice command via Groq Whisper...");
    const formData = new FormData();
    formData.append("file", blob, "audio.webm");

    try {
      const res = await fetch(`http://127.0.0.1:8001/api/ai/transcribe`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) throw new Error("Whisper endpoint returned error");

      const data = await res.json();
      const transcript = data.transcript;

      if (transcript && transcript.trim()) {
        // Append user's transcript to chat feed
        setMessages(prev => [
          ...prev,
          {
            sender: 'Operator',
            text: transcript,
            timestamp: new Date().toLocaleTimeString()
          }
        ]);

        // Send transcript to JARVIS command parser
        await processUserCommand(transcript);
      } else {
        const reply = "I couldn't hear any speech. Please try again.";
        setMessages(prev => [
          ...prev,
          { sender: 'Jarvis', text: reply, timestamp: new Date().toLocaleTimeString() }
        ]);
        speak("No speech detected.");
      }
    } catch (err) {
      console.error("Groq Whisper API failed:", err);
      const reply = "Groq Whisper API unavailable. Please verify your GROQ_API_KEY.";
      setMessages(prev => [
        ...prev,
        { sender: 'Jarvis', text: reply, timestamp: new Date().toLocaleTimeString() }
      ]);
      speak("Transcription error.");
    } finally {
      setStatusText("Assistant Standby. Click microphone and call 'Jarvis' to issue commands.");
    }
  }

  // Text commands submission
  function handleTextSubmit(e) {
    e.preventDefault();
    if (!inputText.trim()) return;

    const cmdText = inputText.trim();
    setInputText('');

    // Append operator message
    setMessages(prev => [
      ...prev,
      { sender: 'Operator', text: cmdText, timestamp: new Date().toLocaleTimeString() }
    ]);

    processUserCommand(cmdText);
  }

  // Action suggestions triggers
  function handleSuggestionClick(cmdText) {
    setMessages(prev => [
      ...prev,
      { sender: 'Operator', text: cmdText, timestamp: new Date().toLocaleTimeString() }
    ]);
    processUserCommand(cmdText);
  }

  // Confirm / cancel pending confirmation commands
  async function handlePendingConfirm(confirmFlag) {
    if (confirmFlag) {
      setMessages(prev => [
        ...prev,
        { sender: 'Operator', text: 'Confirm', timestamp: new Date().toLocaleTimeString() }
      ]);
      processUserCommand('confirm');
    } else {
      setMessages(prev => [
        ...prev,
        { sender: 'Operator', text: 'Cancel', timestamp: new Date().toLocaleTimeString() }
      ]);
      processUserCommand('cancel');
    }
  }

  return (
    <Card className="fade-up delay-3 flex flex-col gap-4 border border-slate-200/50 dark:border-slate-800/60 p-4 h-full min-h-[600px] justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
        <div>
          <h2 className="text-sm font-extrabold text-indigo-500 tracking-wider uppercase leading-none">TACTICAL AI CO-PILOT</h2>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase">JARVIS ENGINE ACTIVE</p>
        </div>
        <button 
          onClick={() => setMessages([{ sender: 'Jarvis', text: 'Greetings, Operator. I am JARVIS. How may I assist you?', timestamp: new Date().toLocaleTimeString() }])}
          className="text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-colors uppercase tracking-widest"
        >
          Clear Chat
        </button>
      </div>

      {/* Chat scroll feed */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 min-h-0 py-2">
        {messages.map((msg, i) => {
          const isJarvis = msg.sender === 'Jarvis';
          return (
            <div
              key={i}
              className={`flex flex-col max-w-[85%] ${isJarvis ? 'self-start' : 'self-end'}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <span className={`text-[9px] font-extrabold uppercase tracking-widest ${isJarvis ? 'text-indigo-500' : 'text-fuchsia-500'}`}>
                  {msg.sender}
                </span>
                <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-600">{msg.timestamp}</span>
              </div>
              <div className={`p-3.5 rounded-2xl text-xs font-semibold leading-relaxed border shadow-sm
                ${isJarvis 
                  ? 'bg-indigo-500/5 border-indigo-500/10 dark:bg-indigo-500/5 dark:border-indigo-500/20 text-slate-800 dark:text-slate-200 rounded-tl-none' 
                  : 'bg-fuchsia-500/5 border-fuchsia-500/10 dark:bg-fuchsia-500/5 dark:border-fuchsia-500/20 text-slate-800 dark:text-slate-200 rounded-tr-none'
                }`}
              >
                <p>{msg.text}</p>

                {/* Technical details disclosure */}
                {msg.technicalDetails && (
                  <details className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <summary className="text-[10px] font-bold text-indigo-500 hover:text-indigo-400 cursor-pointer select-none">
                      🔍 Technical Details
                    </summary>
                    <pre className="mt-1.5 p-2 bg-slate-950/80 rounded-lg text-[9px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap">
                      {msg.technicalDetails}
                    </pre>
                  </details>
                )}

                {/* Execution plan list */}
                {msg.executionPlan && msg.executionPlan.length > 0 && (
                  <details className="mt-1.5">
                    <summary className="text-[10px] font-bold text-indigo-500 hover:text-indigo-400 cursor-pointer select-none">
                      📋 Execution Plan
                    </summary>
                    <ol className="mt-1.5 list-decimal pl-4 gap-1 flex flex-col text-[10px] text-slate-500 dark:text-slate-400">
                      {msg.executionPlan.map((step, idx) => (
                        <li key={idx} className="font-mono">{step}</li>
                      ))}
                    </ol>
                  </details>
                )}

                {/* Confirmation Box if required */}
                {msg.confirmationRequired && (
                  <div className="mt-3 pt-2.5 border-t border-dashed border-rose-500/30 flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider">
                      ⚠️ Privileged Confirmation Required
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                      Are you sure you want to execute this system action?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePendingConfirm(true)}
                        className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-md text-[10px] font-bold transition-all"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => handlePendingConfirm(false)}
                        className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-md text-[10px] font-bold transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex items-center gap-2 pl-1 self-start">
            <span className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest animate-pulse">Jarvis is processing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Voice Status & Wave Visualizer */}
      <div className="flex flex-col items-center gap-1.5 bg-zinc-950/20 border border-zinc-900/40 rounded-xl p-2.5">
        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center leading-normal px-2">
          {statusText}
        </span>
        {listening && (
          <div className="flex items-center gap-1 h-3 mt-1">
            {[...Array(6)].map((_, idx) => (
              <div
                key={idx}
                className="w-0.5 rounded-full bg-rose-500 dark:bg-rose-400 wave-bar"
                style={{
                  height: '8px',
                  animationDelay: `${idx * 0.12}s`,
                  animationDuration: '0.6s'
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Input controls & Microphone */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          {/* Circular Microphone button */}
          <button
            onClick={toggleListening}
            className={`w-14 h-14 rounded-full flex items-center justify-center text-lg transition-all duration-300 active:scale-95 flex-shrink-0 border
              ${listening
                ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-400/30 shadow-[0_0_30px_rgba(244,63,94,0.45)] animate-pulse'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.25)] hover:shadow-[0_0_30px_rgba(99,102,241,0.45)]'
              }`}
            title="Toggle Mic Voice Command"
          >
            {listening ? '🎙️' : '🎤'}
          </button>

          {/* Text Command Form */}
          <form onSubmit={handleTextSubmit} className="flex-1 flex gap-1.5 items-center">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Ask your system anything..."
              className="flex-1 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl px-4 py-3.5 text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/40 transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || loading}
              className="px-4.5 py-3.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold tracking-wide transition-all active:scale-95 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>

        {/* Suggestion Prompts */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          {EXAMPLES.map(ex => (
            <button
              key={ex}
              onClick={() => handleSuggestionClick(ex)}
              className="text-[10px] font-bold bg-zinc-900/30 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-400 text-slate-400 border border-zinc-800/45 px-2.5 py-1.5 rounded-xl transition-all"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
