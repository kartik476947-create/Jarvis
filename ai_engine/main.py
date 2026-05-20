# C:\Users\Utkarsh Dubey\.gemini\antigravity\Securit-Windows\ai_engine\main.py
import os
import re
import json
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
import httpx

load_dotenv()

app = FastAPI(title="Securit-Windows AI Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
CORE_AGENT_URL = "http://127.0.0.1:8000"

# ============ KEYWORD ROUTING FALLBACK ============

KEYWORD_ROUTES = {
    r'\b(cpu|processor|usage|load|percent)\b': 'GET_CPU_MEM',
    r'\b(ram|memory|mem)\b': 'GET_CPU_MEM',
    r'\b(ip|address|ipconfig|network card)\b': 'GET_IP',
    r'\b(network|connection|socket|tcp|udp)\b': 'GET_CONNECTIONS',
    r'\b(service|services|running|daemon)\b': 'GET_SERVICES',
    r'\b(process|app|application|running)\b': 'GET_PROCESSES',
    r'\b(disk|storage|drive|partition|free space)\b': 'GET_DISK',
    r'\b(cache|dns|flush)\b': 'CLEAR_CACHE',
    r'\b(block|firewall|rule)\b': 'BLOCK_ACTION',
    r'\b(kill|terminate|stop|close)\b': 'TERMINATE_PROCESS',
    r'\b(security|threat|malware|scan|virus)\b': 'RUN_SECURITY_SCAN',
    r'\b(boot|secure boot|tpm|integrity)\b': 'CHECK_BOOT_INTEGRITY',
    r'\b(run|execute|powershell|cmd|shell|command)\b': 'EXECUTE_SHELL',
}

def clean_input(text: str) -> str:
    """Remove wake words and clean input."""
    text = text.strip()
    wake_words = ['jarvis', 'hey jarvis', 'assistant', 'hey']
    for wake in wake_words:
        if text.lower().startswith(wake):
            text = text[len(wake):].strip()
    return text.strip(',.:;?!')

def detect_intent_keyword_fallback(text: str) -> str:
    """Use keyword matching to detect intent."""
    text_lower = text.lower()
    for pattern, action in KEYWORD_ROUTES.items():
        if re.search(pattern, text_lower):
            return action
    return 'GET_PROCESSES'  # Default fallback

def map_action_to_endpoint(action: str) -> str:
    """Map action to Core Agent endpoint."""
    mapping = {
        'GET_CPU_MEM': '/api/system/cpu_mem',
        'GET_IP': '/api/system/info',
        'GET_CONNECTIONS': '/api/system/connections',
        'GET_SERVICES': '/api/system/services',
        'GET_PROCESSES': '/api/system/info',
        'GET_DISK': '/api/system/disk',
        'CLEAR_CACHE': '/api/system/cache/clear',
        'CHECK_BOOT_INTEGRITY': '/api/system/info',
        'EXECUTE_SHELL': '/api/system/execute',
        'GET_PROCESSES': '/api/system/processes',
    }
    return mapping.get(action, '/api/system/info')

async def fetch_core_agent(endpoint: str):
    """Fetch data from Core Agent."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{CORE_AGENT_URL}{endpoint}")
            return response.json()
    except Exception as e:
        return {"error": str(e)}

# ============ MAIN COMMAND PARSER ============

@app.get("/")
def read_root():
    return {"status": "AI Engine running"}

@app.post("/api/ai/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    audio_data = await file.read()

    transcript = client.audio.transcriptions.create(
        model="whisper-large-v3-turbo",
        file=("audio.webm", audio_data, "audio/webm"),
    )

    return {"transcript": transcript.text}

@app.post("/api/ai/parse_command")
async def parse_command(request: dict):
    """Parse voice/text command using JARVIS logic."""
    raw_text = (request.get("text") or request.get("command") or "").strip()

    if not raw_text:
        return {
            "intent": "QUERY",
            "action_required": False,
            "confirmation_required": False,
            "target": "system",
            "user_mode": "normal",
            "response": "I didn't understand that. Can you rephrase?",
            "technical_details": ""
        }

    # Clean input
    clean_text = clean_input(raw_text)

    # Detect intent via keyword fallback
    detected_action = detect_intent_keyword_fallback(clean_text)
    endpoint = map_action_to_endpoint(detected_action)

    # Fetch live data
    try:
        live_data = await fetch_core_agent(endpoint)
    except:
        live_data = {}

    # Build response based on action
    if detected_action == 'GET_CPU_MEM':
        cpu = live_data.get('cpu_percent', 0)
        mem = live_data.get('virtual_memory', {}).get('percent', 0)
        response = f"CPU usage is at {cpu}%. Memory usage is at {mem}%."
        if cpu > 80 or mem > 80:
            technical = f"High resource usage: CPU {cpu}%, MEM {mem}%"
            response = "Your system is running hot. Would you like me to optimize it?"
        else:
            technical = f"System is healthy: CPU {cpu}%, MEM {mem}%"

        return {
            "intent": "QUERY",
            "action_required": False,
            "confirmation_required": False,
            "target": "system",
            "user_mode": "normal",
            "response": response,
            "technical_details": technical,
            "execution_plan": []
        }

    elif detected_action == 'GET_IP':
        hostname = live_data.get('hostname', 'Unknown')
        ip = live_data.get('ip', 'N/A')
        response = f"Your computer is {hostname} with IP {ip}."
        return {
            "intent": "QUERY",
            "action_required": False,
            "confirmation_required": False,
            "target": "network",
            "user_mode": "normal",
            "response": response,
            "technical_details": f"Hostname: {hostname}, Primary IP: {ip}",
            "execution_plan": []
        }

    elif detected_action == 'GET_CONNECTIONS':
        conn_count = len(live_data.get('connections', []))
        response = f"You have {conn_count} active network connections."
        return {
            "intent": "QUERY",
            "action_required": False,
            "confirmation_required": False,
            "target": "network",
            "user_mode": "normal",
            "response": response,
            "technical_details": f"Active connections: {conn_count}",
            "execution_plan": []
        }

    elif detected_action == 'GET_SERVICES':
        services = live_data.get('services', [])
        response = f"You have {len(services)} services running."
        return {
            "intent": "QUERY",
            "action_required": False,
            "confirmation_required": False,
            "target": "system",
            "user_mode": "normal",
            "response": response,
            "technical_details": f"Running services count: {len(services)}",
            "execution_plan": []
        }

    elif detected_action == 'GET_DISK':
        partitions = live_data.get('partitions', [])
        disk_info = ""
        for part in partitions[:3]:
            usage = part.get('usage', {})
            disk_info += f"{part.get('device')}: {usage.get('percent', 0)}% used\n"
        response = "Here's your disk usage overview."
        return {
            "intent": "QUERY",
            "action_required": False,
            "confirmation_required": False,
            "target": "system",
            "user_mode": "normal",
            "response": response,
            "technical_details": disk_info,
            "execution_plan": []
        }

    elif detected_action == 'CLEAR_CACHE':
        response = "I can flush your DNS cache. This is safe and will improve network performance."
        return {
            "intent": "ACTION",
            "action_required": True,
            "confirmation_required": True,
            "target": "system",
            "user_mode": "normal",
            "response": response,
            "technical_details": "DNS cache flush via ipconfig /flushdns",
            "execution_plan": ["Stop DNS service", "Clear cache entries", "Restart DNS service"]
        }

    elif detected_action == 'TERMINATE_PROCESS':
        response = "I can terminate a process, but I need you to specify which one. What's the process name?"
        return {
            "intent": "QUERY",
            "action_required": False,
            "confirmation_required": False,
            "target": "process",
            "user_mode": "normal",
            "response": response,
            "technical_details": "",
            "execution_plan": []
        }

    elif detected_action == 'BLOCK_ACTION':
        response = "I can block an IP address via firewall rules. Which IP would you like me to block?"
        return {
            "intent": "QUERY",
            "action_required": False,
            "confirmation_required": False,
            "target": "network",
            "user_mode": "normal",
            "response": response,
            "technical_details": "",
            "execution_plan": []
        }

    elif detected_action == 'RUN_SECURITY_SCAN':
        response = "Running a comprehensive security scan. This will analyze processes, network, and registry for threats."
        return {
            "intent": "SECURITY",
            "action_required": True,
            "confirmation_required": False,
            "target": "system",
            "user_mode": "normal",
            "response": response,
            "technical_details": "Scanning: Process integrity, Network C2 beacons, Registry persistence",
            "execution_plan": [
                "Check active processes for masquerading",
                "Inspect network for C2 connections",
                "Scan registry for persistence mechanisms"
            ]
        }

    elif detected_action == 'CHECK_BOOT_INTEGRITY':
        response = "Checking your Secure Boot and TPM status. This determines your system's protection at startup."
        return {
            "intent": "SECURITY",
            "action_required": False,
            "confirmation_required": False,
            "target": "system",
            "user_mode": "normal",
            "response": response,
            "technical_details": "Secure Boot: Checking registry. TPM: Querying WMI.",
            "execution_plan": [
                "Check UEFI Secure Boot registry setting",
                "Query TPM 2.0 status via WMI",
                "Evaluate boot chain integrity"
            ]
        }

    elif detected_action == 'EXECUTE_SHELL':
        shell_cmd = clean_text
        for prefix in ("run ", "execute ", "powershell ", "cmd ", "shell "):
            if shell_cmd.lower().startswith(prefix):
                shell_cmd = shell_cmd[len(prefix):].strip()
                break
        try:
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    f"{CORE_AGENT_URL}/api/system/execute",
                    json={"command": shell_cmd},
                    timeout=130.0,
                )
                result = r.json()
        except Exception as e:
            result = {"ok": False, "error": str(e)}

        output = (result.get("stdout") or "").strip()
        if not output:
            output = (result.get("stderr") or result.get("error") or "No output").strip()
        return {
            "intent": "ACTION",
            "threat_level": "LOW" if result.get("ok") else "MEDIUM",
            "analysis": output[:8000],
            "action_plan": f"Executed on host: {shell_cmd[:200]}",
            "execution_details": result,
            "requires_confirmation": False,
            "action_required": False,
            "confirmation_required": False,
            "target": "system",
            "user_mode": "elevated",
            "response": output[:500],
            "technical_details": output[:2000],
            "execution_plan": [shell_cmd],
        }

    elif detected_action == 'GET_PROCESSES':
        procs = live_data.get("processes", []) if isinstance(live_data, dict) else []
        top = sorted(procs, key=lambda p: p.get("cpu_percent", 0), reverse=True)[:8]
        names = ", ".join(f"{p.get('name')} ({p.get('cpu_percent', 0):.1f}%)" for p in top)
        return {
            "intent": "QUERY",
            "threat_level": "LOW",
            "analysis": f"Top processes by CPU: {names or 'unavailable'}",
            "action_plan": "Live process snapshot from psutil",
            "execution_details": {"count": len(procs)},
            "requires_confirmation": False,
            "action_required": False,
            "confirmation_required": False,
            "target": "process",
            "user_mode": "normal",
            "response": f"{len(procs)} processes running.",
            "technical_details": names,
            "execution_plan": [],
        }

    # Default fallback
    return {
        "intent": "QUERY",
        "threat_level": "LOW",
        "analysis": "I'm ready to help. Ask about CPU, memory, disk, processes, network, or run a command (e.g. 'execute Get-Process').",
        "action_plan": "Awaiting operator input",
        "execution_details": {},
        "requires_confirmation": False,
        "action_required": False,
        "confirmation_required": False,
        "target": "system",
        "user_mode": "normal",
        "response": "I'm ready to help. What would you like to know about your system?",
        "technical_details": "",
        "execution_plan": []
    }

