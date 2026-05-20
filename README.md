# 🧠 JARVIS — Voice-Controlled AI Security OS

<div align="center">

![JARVIS](https://img.shields.io/badge/JARVIS-Voice%20OS-00d4ff?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgZmlsbD0iIzIyZDNlZSIvPjwvc3ZnPg==)
![Python](https://img.shields.io/badge/Python-3.10+-3776ab?style=for-the-badge&logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)

**A real-time, voice-activated cybersecurity dashboard and AI assistant.**  
Speak commands, monitor processes, analyze threats, and control your system — all from a stunning glassmorphic interface.

</div>

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Detailed Setup](#-detailed-setup)
- [How to Use](#-how-to-use)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Features

### 🎤 Voice Assistant (Voice OS)
- **Hands-free interaction** — Tap the glowing orb and speak naturally
- **Continuous listening** with automatic silence detection (auto-submits after 1.8s of silence)
- **Text-to-Speech responses** in British English accent
- **Cross-browser support** — Uses Web Speech API on Chrome/Edge/Safari, falls back to Groq Whisper transcription on Firefox
- **Real-time audio visualizer** — The orb pulses with your voice

### 🛡️ Security Dashboard
- **Live Process Monitor** — Risk-scored process table with KILL / QUARANTINE / INSPECT actions
- **Telemetry Stream** — Real-time tabs for Process Events, File Events, Network Connections, Security Logs
- **System Risk Meter** — Composite risk score from CPU, Memory, Process, and Security factors
- **Module Status Bar** — Integrity Check, Network C2, Registry Monitor, Kernel ETW, Ransomware Shield

### 🤖 AI Engine
- **Dual LLM Backend** — Google Gemini (primary) with Groq LLaMA 3.3 70B fallback
- **Intent Classification** — Maps commands to QUERY / ACTION / SECURITY intents
- **Natural Conversation** — Remembers chat history for context-aware responses
- **Anomaly Detection** — Isolation Forest ML model for behavioral analysis

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   BROWSER (React)                    │
│  ┌──────────┐  ┌────────────┐  ┌─────────────────┐  │
│  │ Voice Orb│  │  Chat UI   │  │ Security Dash   │  │
│  │ (WebAudio│  │ (useChat)  │  │ (Telemetry +    │  │
│  │ +Speech) │  │            │  │  ProcessPanel)  │  │
│  └────┬─────┘  └─────┬──────┘  └───────┬─────────┘  │
│       │              │                  │            │
└───────┼──────────────┼──────────────────┼────────────┘
        │              │                  │
   ┌────▼──────────────▼──┐    ┌──────────▼──────────┐
   │  AI Engine (:8001)   │    │ Core Agent (:8000)   │
   │  - Gemini / Groq LLM │    │ - psutil telemetry   │
   │  - Whisper STT       │    │ - Process monitor    │
   │  - pyttsx3 TTS       │    │ - File watcher       │
   │  - Isolation Forest  │    │ - Network monitor    │
   │  - Threat analysis   │    │ - Static file server │
   └──────────────────────┘    └──────────────────────┘
```

---

## 📦 Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Python** | 3.10+ | Tested on 3.12 and 3.14 |
| **Node.js** | 18+ | Only needed if you want to rebuild the frontend |
| **npm** | 9+ | Comes with Node.js |
| **Browser** | Chrome / Edge / Safari | Chrome recommended for best voice support |
| **OS** | macOS / Windows / Linux | macOS and Windows fully tested |

### API Keys Required

| Key | Purpose | Get it from |
|---|---|---|
| `GEMINI_API_KEY` | Primary AI (command parsing, conversation) | [Google AI Studio](https://aistudio.google.com/apikey) |
| `GROQ_API_KEY` | Fallback AI + Whisper audio transcription | [Groq Console](https://console.groq.com/keys) |

---

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/laavanay/jarvis.git
cd jarvis

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Create your .env file (or edit the existing one)
cat > .env << 'EOF'
GROQ_API_KEY=your_groq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
EOF

# 4. Launch JARVIS
python3 launcher.py
```

The browser will automatically open at **http://localhost:8000/**

---

## 🔧 Detailed Setup

### Step 1: Clone & Enter

```bash
git clone https://github.com/laavanay/jarvis.git
cd jarvis
```

### Step 2: Python Environment (Recommended: Virtual Environment)

```bash
# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate      # macOS/Linux
# venv\Scripts\activate       # Windows

# Install dependencies
pip install -r requirements.txt
```

**Key Python packages installed:**
- `fastapi` + `uvicorn` — API servers
- `psutil` — System telemetry
- `groq` — Groq API client (Whisper + LLaMA)
- `scikit-learn` — Anomaly detection (Isolation Forest)
- `pyttsx3` — Text-to-speech engine
- `watchdog` — File system monitoring
- `requests` — HTTP client for Gemini API
- `python-multipart` — File upload handling

### Step 3: Configure API Keys

Edit the `.env` file in the project root:

```env
GROQ_API_KEY=gsk_your_key_here
GEMINI_API_KEY=AIzaSy_your_key_here
```

> **Note:** Both keys are optional. If Gemini fails or is rate-limited, the system automatically falls back to Groq. If neither is set, a rule-based parser handles commands.

### Step 4: Launch

```bash
python3 launcher.py
```

This single command:
1. Installs any missing pip dependencies
2. Starts the **AI Engine** on port `8001`
3. Starts the **Core Agent** on port `8000` (also serves the frontend)
4. Opens your browser to `http://localhost:8000/`

### Step 5 (Optional): Rebuild the Frontend

Only needed if you modify React source files in `frontend/src/`:

```bash
cd frontend
npm install
npm run build
cd ..

# Restart the server
python3 launcher.py
```

---

## 🎮 How to Use

### Voice Commands (Tap the Orb)

1. **Tap the glowing orb** at the center of the screen
2. **Speak your command** naturally — e.g., *"What's my CPU usage?"*
3. **Wait** — JARVIS auto-detects when you stop speaking (1.8s silence)
4. **Listen** — JARVIS speaks the response back in a British accent
5. **Interrupt** — Tap the orb again while JARVIS is speaking to cut it off

### Text Commands (Type in the Input Box)

Type any command in the input box at the bottom and press **Enter** or click **Send**.

### Example Commands

| Command | What it does |
|---|---|
| `What's my CPU and memory usage?` | Shows real-time CPU % and RAM usage |
| `Show me running processes` | Lists active processes with risk scores |
| `What's my IP address?` | Displays local IP and network info |
| `Show disk usage` | Storage breakdown |
| `Get my hostname` | System hostname |
| `Show network connections` | Active TCP/UDP connections |
| `What's the DNS cache?` | DNS lookup cache |
| `Kill process 1234` | Terminates PID 1234 (asks confirmation) |
| `Run a security scan` | Full system threat analysis |
| `Generate a security report` | Export forensic report |
| `Hello` / `Tell me more` | Conversational AI chat |

### Shell Command Shortcut

Prefix with `run:` to execute a shell command directly:

```
run: ls -la /tmp
run: whoami
run: df -h
```

### Security Dashboard

Click **"▼ SHOW SECURITY DASHBOARD"** below the Voice OS panel to expand:

- **PROCESS tab** — Real-time process events (CREATE/TERMINATE)
- **FILES tab** — File system activity (CREATE/MODIFY/DELETE)
- **NET tab** — Active network connections with process names
- **LOGS tab** — Security event log with severity levels

---

## 📁 Project Structure

```
jarvis/
├── .env                          # API keys (GROQ + GEMINI)
├── launcher.py                   # One-click launcher (starts both servers + opens browser)
├── ai_engine.py                  # AI backend (port 8001) — LLM, Whisper, TTS, ML
├── core_agent.py                 # System backend (port 8000) — telemetry, processes, static files
├── requirements.txt              # Python dependencies
│
├── frontend/                     # React + Vite frontend
│   ├── index.html                # Vite dev entry point
│   ├── tsconfig.json             # TypeScript config
│   ├── vite.config.js            # Vite build config
│   ├── package.json              # Node dependencies
│   │
│   ├── src/
│   │   ├── main.tsx              # React entry point
│   │   ├── App.tsx               # Root component (Voice OS + Dashboard)
│   │   ├── App.css               # Main layout styles
│   │   │
│   │   ├── components/
│   │   │   ├── VoiceOrb/         # Animated voice visualizer orb
│   │   │   ├── Layout/           # Header, StatusBar, Workspace
│   │   │   ├── TelemetryPanel/   # Live telemetry stream (4 tabs)
│   │   │   ├── ProcessPanel/     # Process risk analysis table
│   │   │   ├── AICoPilot/        # Legacy AI chat panel
│   │   │   └── Common/           # Shared UI components
│   │   │
│   │   ├── hooks/
│   │   │   ├── useVoiceInput.ts  # Voice recognition + audio meter
│   │   │   ├── useChat.ts        # Chat state + AI command dispatch
│   │   │   └── useTelemetry.ts   # System telemetry polling
│   │   │
│   │   ├── services/
│   │   │   ├── aiEngineApi.ts    # Axios client for AI Engine (:8001)
│   │   │   └── coreAgentApi.ts   # Axios client for Core Agent (:8000)
│   │   │
│   │   ├── types/                # TypeScript interfaces
│   │   ├── utils/                # Risk scoring utilities
│   │   └── styles/               # Global CSS + variables
│   │
│   └── dist/                     # Built production bundle (served by core_agent.py)
│
└── ai_engine/                    # Additional AI engine modules
```

---

## 📡 API Reference

### Core Agent — `http://localhost:8000`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves the frontend UI |
| `GET` | `/api/system/status` | System risk score, CPU, RAM, module status |
| `GET` | `/api/system/processes` | Live process list with risk scores |
| `GET` | `/api/system/connections` | Active network connections |
| `GET` | `/api/system/events/processes` | Process creation/termination events |
| `GET` | `/api/system/events/files` | File system activity events |
| `GET` | `/api/system/events/security` | Security audit log events |
| `POST` | `/api/terminate/{pid}` | Kill a process by PID |
| `POST` | `/api/system/execute` | Execute a shell command |
| `POST` | `/api/file/quarantine` | Quarantine a file |

### AI Engine — `http://localhost:8001`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ai/parse_command` | Send text → get AI-parsed intent + response |
| `POST` | `/api/ai/transcribe` | Upload audio file → get text transcript (Whisper) |
| `POST` | `/api/ai/speak` | Text-to-speech via pyttsx3 |
| `POST` | `/api/ai/confirm_action` | Confirm a high-risk action |

---

## 🔍 Troubleshooting

### "Address already in use" error

```bash
# Kill processes on ports 8000 and 8001
lsof -i :8000 -t | xargs kill -9
lsof -i :8001 -t | xargs kill -9

# Then restart
python3 launcher.py
```

### Microphone not working

- **Use Chrome** — Best Web Speech API support
- **Use `http://localhost:8000`** — NOT `127.0.0.1` (Secure Context required for mic access)
- **Allow microphone permission** when the browser asks
- **Hard refresh** with `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows) if the page is cached

### AI not responding

- Check your `.env` file has valid API keys
- **Gemini rate limit (429)?** — The system auto-falls back to Groq
- **Both keys invalid?** — A rule-based parser still handles basic commands
- Test manually:
  ```bash
  curl -X POST http://localhost:8001/api/ai/parse_command \
    -H "Content-Type: application/json" \
    -d '{"command":"hello","text":"hello","history":[]}'
  ```

### Frontend shows old UI

```bash
# Hard refresh in browser
Cmd+Shift+R  (Mac)
Ctrl+Shift+R (Windows)

# Or rebuild from source
cd frontend && npm install && npm run build && cd ..
python3 launcher.py
```

### Voice recognition says "not supported"

- Web Speech API requires **Chrome, Edge, or Safari 14.1+**
- Firefox will automatically fall back to **MediaRecorder + Groq Whisper** (requires `GROQ_API_KEY`)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 8, TypeScript, Vanilla CSS |
| **Voice** | Web Speech API, Web Audio API, SpeechSynthesis |
| **Backend** | FastAPI, Uvicorn, Python 3.10+ |
| **AI** | Google Gemini 2.0 Flash, Groq LLaMA 3.3 70B, Whisper |
| **ML** | scikit-learn Isolation Forest (anomaly detection) |
| **Monitoring** | psutil, watchdog |
| **TTS** | pyttsx3 (server-side), SpeechSynthesis (client-side) |

---

## 👤 Author

**Laavanay** — [@laavanay](https://github.com/laavanay)

---

<div align="center">

*Built with ❤️ and a lot of voice commands.*

</div>
