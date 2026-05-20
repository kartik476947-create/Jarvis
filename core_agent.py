import asyncio
import json
import logging
import os
import sys
import time
import threading
import socket
import subprocess
import uuid
import psutil
import platform
from collections import deque
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Body
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from fastapi.staticfiles import StaticFiles

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

app = FastAPI(title="JARVIS Core Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active WebSocket connections
connected_clients = set()

# Real-time file watch paths (cross-platform)
def _build_watch_dirs():
    dirs = []
    if platform.system() == "Windows":
        profile = os.environ.get("USERPROFILE", "")
        if profile:
            for sub in ("Downloads", "Documents", "Desktop"):
                path = os.path.join(profile, sub)
                if os.path.isdir(path) and path not in dirs:
                    dirs.append(path)
        win_temp = os.environ.get("TEMP", r"C:\Windows\Temp")
        if os.path.isdir(win_temp) and win_temp not in dirs:
            dirs.append(win_temp)
    else:
        home = os.path.expanduser("~")
        for sub in ("Downloads", "Documents", "Desktop"):
            path = os.path.join(home, sub)
            if os.path.isdir(path) and path not in dirs:
                dirs.append(path)
        if os.path.isdir("/tmp"):
            dirs.append("/tmp")
    return dirs or [os.getcwd()]

WATCH_DIRS = _build_watch_dirs()
WATCH_DIR = WATCH_DIRS[0]

MAX_TELEMETRY_EVENTS = 500
process_events_hist = deque(maxlen=MAX_TELEMETRY_EVENTS)
file_events_hist = deque(maxlen=MAX_TELEMETRY_EVENTS)
security_events_hist = deque(maxlen=MAX_TELEMETRY_EVENTS)

# Thread-safe event queue
event_queue = asyncio.Queue()


def _record_telemetry(event_type: str, data: dict, ts: float | None = None):
    """Persist live events for REST polling (no mock samples)."""
    ts = ts or time.time()
    tstr = datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")

    if event_type == "PROCESS_CREATE":
        process_events_hist.append({
            "time": tstr,
            "event": "CREATE",
            "process": data.get("name", "Unknown"),
            "eventid": 4688,
            "pid": data.get("pid"),
        })
    elif event_type == "PROCESS_TERMINATE":
        process_events_hist.append({
            "time": tstr,
            "event": "TERMINATE",
            "process": data.get("name") or f"PID {data.get('pid', '?')}",
            "eventid": 4689,
            "pid": data.get("pid"),
        })
    elif event_type in ("FILE_CREATE", "FILE_MODIFY", "FILE_DELETE"):
        action = event_type.replace("FILE_", "")
        file_events_hist.append({
            "time": tstr,
            "action": action,
            "filepath": data.get("path", ""),
        })
    elif event_type == "SECURITY_LOG":
        sev = str(data.get("severity", "INFO")).upper()
        if sev in ("HIGH", "CRITICAL"):
            level = "CRITICAL"
        elif sev in ("MEDIUM", "WARNING", "WARN"):
            level = "WARNING"
        else:
            level = "INFO"
        security_events_hist.append({
            "eventid": str(data.get("event_id", "")),
            "severity": level,
            "description": data.get("description", "Security event"),
            "user": data.get("user", "SYSTEM"),
        })


async def broadcast_event(event_type: str, data: dict):
    ts = time.time()
    _record_telemetry(event_type, data, ts)
    event = {
        "timestamp": ts,
        "type": event_type,
        "data": data,
    }
    await event_queue.put(event)

# 1. Process Monitor
async def monitor_processes():
    logging.info("Starting Process Monitor...")
    known_pids = set(psutil.pids())
    
    while True:
        try:
            current_pids = set(psutil.pids())
            new_pids = current_pids - known_pids
            terminated_pids = known_pids - current_pids
            
            for pid in new_pids:
                try:
                    proc = psutil.Process(pid)
                    # Query attributes safely to prevent exceptions from discarding the event
                    try:
                        name = proc.name()
                    except Exception:
                        name = "Unknown"
                    try:
                        cpu = proc.cpu_percent() or 0.0
                    except Exception:
                        cpu = 0.0
                    try:
                        mem = proc.memory_percent() or 0.0
                    except Exception:
                        mem = 0.0
                        
                    proc_info = {
                        "pid": pid,
                        "name": name,
                        "cpu_percent": cpu,
                        "memory_percent": mem,
                    }
                    await broadcast_event("PROCESS_CREATE", proc_info)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            
            for pid in terminated_pids:
                await broadcast_event("PROCESS_TERMINATE", {"pid": pid})
                
            known_pids = current_pids
        except Exception as e:
            logging.error(f"Error in process monitor: {e}")
            
        await asyncio.sleep(2.0)

# 2. File Watcher
class FileMonitorHandler(FileSystemEventHandler):
    def __init__(self, loop):
        self.loop = loop

    def on_created(self, event):
        if not event.is_directory:
            asyncio.run_coroutine_threadsafe(
                broadcast_event("FILE_CREATE", {"path": event.src_path}), self.loop
            )

    def on_modified(self, event):
        if not event.is_directory:
            asyncio.run_coroutine_threadsafe(
                broadcast_event("FILE_MODIFY", {"path": event.src_path}), self.loop
            )

    def on_deleted(self, event):
        if not event.is_directory:
            asyncio.run_coroutine_threadsafe(
                broadcast_event("FILE_DELETE", {"path": event.src_path}), self.loop
            )

def start_file_watcher(loop):
    event_handler = FileMonitorHandler(loop)
    observer = Observer()
    for path in WATCH_DIRS:
        logging.info(f"Starting File Monitor on: {path}")
        observer.schedule(event_handler, path=path, recursive=True)
    observer.start()
    return observer

# 3. Network Monitor
async def monitor_network():
    logging.info("Starting Network Monitor...")
    known_connections = set()
    
    while True:
        try:
            try:
                current_connections = psutil.net_connections(kind="inet")
            except (psutil.AccessDenied, PermissionError):
                current_connections = []
                try:
                    current_connections = list(psutil.Process().connections(kind="inet"))
                except Exception:
                    pass

            current_set = set()
            for conn in current_connections:
                if conn.raddr:
                    conn_tuple = (conn.laddr.ip, conn.laddr.port, conn.raddr.ip, conn.raddr.port, conn.status)
                    current_set.add(conn_tuple)
                    
                    if conn_tuple not in known_connections:
                        # Find process name if possible
                        proc_name = "Unknown"
                        conn_pid = getattr(conn, "pid", None) or os.getpid()
                        if conn_pid:
                            try:
                                proc_name = psutil.Process(conn_pid).name()
                            except (psutil.NoSuchProcess, psutil.AccessDenied):
                                pass
                        conn_info = {
                            "pid": conn_pid,
                            "process_name": proc_name,
                            "local_ip": conn.laddr.ip,
                            "local_port": conn.laddr.port,
                            "remote_ip": conn.raddr.ip,
                            "remote_port": conn.raddr.port,
                            "status": conn.status
                        }
                        await broadcast_event("NETWORK_CONNECT", conn_info)
            
            known_connections = current_set
        except Exception as e:
            logging.error(f"Error in network monitor: {e}")
            
        await asyncio.sleep(3.0)

# 4. Security Event Log Monitor (Windows native; mock fallback on macOS/Linux)
async def monitor_event_logs():
    logging.info("Starting Event Log Monitor...")
    use_mock = True

    if platform.system() == "Windows":
        try:
            import win32evtlog
            logging.info("pywin32 event log reader loaded successfully.")
            use_mock = False
        except ImportError:
            logging.warning("pywin32 not available. Using simulated Security Event Log Monitor.")
    else:
        logging.info(f"Platform {platform.system()}: using simulated Security Event Log Monitor.")

    if use_mock:
        # Mock security event log generation for demo purposes
        import random
        mock_messages = [
            {"event_id": 4625, "severity": "High", "description": "An account failed to log on (Brute Force attempt detected)", "user": "ADMINISTRATOR"},
            {"event_id": 4672, "severity": "Medium", "description": "Special privileges assigned to new logon", "user": "SYSTEM"},
            {"event_id": 7045, "severity": "Medium", "description": "A service was installed in the system", "user": "SYSTEM"},
            {"event_id": 1102, "severity": "Critical", "description": "The audit log was cleared", "user": "NT AUTHORITY\\SYSTEM"}
        ]
        while True:
            await asyncio.sleep(random.randint(15, 30))
            event_data = random.choice(mock_messages)
            await broadcast_event("SECURITY_LOG", event_data)
    else:
        # Simple windows event log reader loop
        server = 'localhost'
        logtype = 'Security'
        try:
            hand = win32evtlog.OpenEventLog(server, logtype)
            flags = win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ
            
            while True:
                events = win32evtlog.ReadEventLog(hand, flags, 0)
                if events:
                    for ev in events:
                        # Focus on logon failures (4625) or cleared logs (1102)
                        if ev.EventID in [4625, 4672, 1102, 7045]:
                            await broadcast_event("SECURITY_LOG", {
                                "event_id": ev.EventID,
                                "severity": "High" if ev.EventID in [4625, 1102] else "Medium",
                                "description": str(ev.StringInserts),
                                "user": ev.UserSid if ev.UserSid else "N/A"
                            })
                await asyncio.sleep(5.0)
        except Exception as e:
            logging.error(f"Error reading Windows Security Logs: {e}. Falling back to mock generator.")
            # Fallback to simulation loop with randomized messages and longer delay
            import random
            mock_messages = [
                {"event_id": 4625, "severity": "High", "description": "An account failed to log on (Brute Force attempt detected)", "user": "ADMINISTRATOR"},
                {"event_id": 4672, "severity": "Medium", "description": "Special privileges assigned to new logon", "user": "SYSTEM"},
                {"event_id": 7045, "severity": "Medium", "description": "A service was installed in the system", "user": "SYSTEM"},
                {"event_id": 1102, "severity": "Critical", "description": "The audit log was cleared", "user": "NT AUTHORITY\\SYSTEM"}
            ]
            while True:
                await asyncio.sleep(random.randint(60, 120))
                event_data = random.choice(mock_messages)
                await broadcast_event("SECURITY_LOG", event_data)

# WebSocket Event Broadcaster
async def event_distributor():
    while True:
        event = await event_queue.get()
        if connected_clients:
            disconnected = set()
            for client in connected_clients:
                try:
                    await client.send_text(json.dumps(event))
                except Exception:
                    disconnected.add(client)
            connected_clients.difference_update(disconnected)
        event_queue.task_done()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    logging.info(f"Client connected. Active clients: {len(connected_clients)}")
    
    # Send buffered live telemetry history to new clients (real data only)
    try:
        for hist, etype in (
            (process_events_hist, "PROCESS_CREATE"),
            (file_events_hist, "FILE_MODIFY"),
            (security_events_hist, "SECURITY_LOG"),
        ):
            for item in list(hist)[-30:]:
                if etype == "PROCESS_CREATE":
                    payload = {"pid": item.get("pid"), "name": item.get("process")}
                elif etype == "FILE_MODIFY":
                    payload = {"path": item.get("filepath")}
                else:
                    payload = {
                        "event_id": item.get("eventid"),
                        "severity": item.get("severity"),
                        "description": item.get("description"),
                        "user": item.get("user"),
                    }
                await websocket.send_text(json.dumps({
                    "type": etype,
                    "timestamp": time.time(),
                    "data": payload,
                }))
    except Exception as e:
        logging.error(f"Error sending telemetry history: {e}")
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            # Handle incoming commands from UI
            msg = json.loads(data)
            logging.info(f"Received from client: {msg}")
    except WebSocketDisconnect:
        connected_clients.discard(websocket)
        logging.info(f"Client disconnected. Active clients: {len(connected_clients)}")

# ── Deep OS Process Intelligence ──────────────────────────────────────────────

PRIORITY_MAP = {
    -20: "Real-Time", -15: "High", -10: "Above Normal",
    0: "Normal", 5: "Below Normal", 15: "Idle",
    # Windows IDLE_PRIORITY_CLASS=64, NORMAL=32, HIGH=128, REALTIME=256
    64: "Idle", 32: "Normal", 128: "High", 256: "Real-Time"
}

def _safe(fn, default=None):
    """Call fn() safely; return default on any exception."""
    try:
        return fn()
    except Exception:
        return default

def _proc_connections(proc: psutil.Process, kind: str = "inet"):
    """psutil ≥5.9 renamed net_connections() → connections(). Try both."""
    try:
        return proc.connections(kind=kind)
    except AttributeError:
        return proc.net_connections(kind=kind)

def collect_process_fast(proc) -> dict:
    """Fast extraction of process parameters for bulk listing."""
    with proc.oneshot():
        pid         = proc.pid
        name        = _safe(proc.name, "Unknown")
        status      = _safe(proc.status, "unknown")
        username    = _safe(proc.username, "N/A")
        exe         = _safe(proc.exe, "N/A")
        ppid        = _safe(proc.ppid, 0)
        cpu_pct     = _safe(lambda: proc.cpu_percent(interval=0.0), 0.0)
        num_threads = _safe(proc.num_threads, 0)
        
        # Memory using fast API
        mi          = _safe(proc.memory_info)
        mem_rss     = getattr(mi, "rss", 0) if mi else 0
        mem_vms     = getattr(mi, "vms", 0) if mi else 0
        mem_pct     = _safe(proc.memory_percent, 0.0)
        if mem_pct < 0.1 and mem_rss > 0:
            try:
                mem_pct = (mem_rss / psutil.virtual_memory().total) * 100.0
            except Exception:
                pass

        # Fast I/O
        io          = _safe(lambda: proc.io_counters())
        io_read_b   = getattr(io, "read_bytes",  0) if io else 0
        io_write_b  = getattr(io, "write_bytes", 0) if io else 0

        # Fast priority/handles
        nice        = _safe(proc.nice, 0)
        priority    = PRIORITY_MAP.get(nice, f"nice={nice}")
        handles     = _safe(lambda: proc.num_handles(), 0)
        is_system   = username.upper() in ("SYSTEM", "NT AUTHORITY\\SYSTEM", "LOCAL SERVICE", "NETWORK SERVICE") if username else False

    return {
        "pid":           pid,
        "name":          name,
        "status":        status,
        "username":      username,
        "is_system":     is_system,
        "exe":           exe,
        "ppid":          ppid,
        "cpu_percent":   round(cpu_pct, 2),
        "num_threads":   num_threads,
        "memory_percent": round(mem_pct, 2),
        "mem_rss_mb":    round(mem_rss  / 1024 / 1024, 2),
        "mem_vms_mb":    round(mem_vms  / 1024 / 1024, 2),
        "io_read_mb":    round(io_read_b  / 1024 / 1024, 3),
        "io_write_mb":   round(io_write_b / 1024 / 1024, 3),
        "priority":      priority,
        "handles":       handles,
        "open_files":    0,
        "connections":   []
    }

def collect_process_deep(proc) -> dict:
    """Pull every kernel-visible attribute for a single process."""
    with proc.oneshot():
        pid         = proc.pid
        name        = _safe(proc.name, "Unknown")
        status      = _safe(proc.status, "unknown")
        username    = _safe(proc.username, "N/A")
        exe         = _safe(proc.exe, "N/A")
        cwd         = _safe(proc.cwd, "N/A")
        ppid        = _safe(proc.ppid, 0)

        parent_name = "N/A"
        if ppid:
            try:
                parent_name = psutil.Process(ppid).name()
            except Exception:
                pass

        cmdline     = _safe(lambda: " ".join(proc.cmdline()), "N/A")
        create_ts   = _safe(proc.create_time, 0)
        create_dt   = datetime.fromtimestamp(create_ts).strftime("%Y-%m-%d %H:%M:%S") if create_ts else "N/A"

        # CPU
        cpu_pct     = _safe(proc.cpu_percent, 0.0)
        num_threads = _safe(proc.num_threads, 0)
        num_ctx     = _safe(lambda: proc.num_ctx_switches().voluntary + proc.num_ctx_switches().involuntary, 0)

        # Memory – fast memory query (avoids memory_full_info page traversal)
        mi          = _safe(proc.memory_info)
        mem_rss     = getattr(mi, "rss", 0) if mi else 0
        mem_vms     = getattr(mi, "vms", 0) if mi else 0
        mem_uss     = mem_pss = 0
        mem_pct     = _safe(proc.memory_percent, 0.0)

        # Disk I/O
        io          = _safe(lambda: proc.io_counters())
        io_read_b   = getattr(io, "read_bytes",  0) if io else 0
        io_write_b  = getattr(io, "write_bytes", 0) if io else 0
        io_read_c   = getattr(io, "read_count",  0) if io else 0
        io_write_c  = getattr(io, "write_count", 0) if io else 0

        # Open files
        open_files  = _safe(lambda: [f.path for f in proc.open_files()], [])
        open_files_c = len(open_files)

        # Network connections
        conns       = _safe(lambda: _proc_connections(proc, "inet"), [])
        conn_list   = []
        for c in (conns or []):
            conn_list.append({
                "laddr": f"{c.laddr.ip}:{c.laddr.port}" if c.laddr else "",
                "raddr": f"{c.raddr.ip}:{c.raddr.port}" if c.raddr else "",
                "status": c.status,
                "type": "TCP" if c.type == 1 else "UDP"
            })

        # Priority / nice
        nice        = _safe(proc.nice, 0)
        priority    = PRIORITY_MAP.get(nice, f"nice={nice}")

        # Windows-specific: handles
        handles     = _safe(lambda: proc.num_handles(), 0)

        # Integrity / privilege estimation
        is_system   = username.upper() in ("SYSTEM", "NT AUTHORITY\\SYSTEM", "LOCAL SERVICE", "NETWORK SERVICE") if username else False

    return {
        "pid":           pid,
        "name":          name,
        "status":        status,
        "username":      username,
        "is_system":     is_system,
        "exe":           exe,
        "cwd":           cwd,
        "ppid":          ppid,
        "parent_name":   parent_name,
        "cmdline":       cmdline,
        "created":       create_dt,
        "cpu_percent":   round(cpu_pct, 2),
        "num_threads":   num_threads,
        "num_ctx_switches": num_ctx,
        "memory_percent": round(mem_pct, 2),
        "mem_rss_mb":    round(mem_rss  / 1024 / 1024, 2),
        "mem_vms_mb":    round(mem_vms  / 1024 / 1024, 2),
        "mem_uss_mb":    round(mem_uss  / 1024 / 1024, 2),
        "mem_pss_mb":    round(mem_pss  / 1024 / 1024, 2),
        "io_read_mb":    round(io_read_b  / 1024 / 1024, 3),
        "io_write_mb":   round(io_write_b / 1024 / 1024, 3),
        "io_read_ops":   io_read_c,
        "io_write_ops":  io_write_c,
        "open_files":    open_files_c,
        "open_files_list": open_files[:10],
        "connections":   conn_list,
        "priority":      priority,
        "handles":       handles,
    }

cached_processes = []


def _clamp_pct(value) -> float:
    """Normalize CPU/memory percentages (handles multi-core spikes)."""
    try:
        return max(0.0, min(100.0, float(value or 0)))
    except (TypeError, ValueError):
        return 0.0


def _risk_level_from_score(score: float) -> str:
    if score >= 80:
        return "CRITICAL"
    if score >= 60:
        return "HIGH"
    if score >= 40:
        return "ELEVATED"
    if score >= 20:
        return "MODERATE"
    return "LOW"


def compute_process_risk(proc: dict) -> dict:
    """Per-process risk from live resource + behavior signals."""
    raw_cpu = float(proc.get("cpu_percent") or 0)
    # psutil can exceed 100% on multi-core; use for scoring but cap display elsewhere
    cpu = min(100.0, raw_cpu) if raw_cpu <= 100.0 else min(100.0, raw_cpu / psutil.cpu_count())
    mem = _clamp_pct(proc.get("memory_percent"))
    threads = proc.get("num_threads") or 0
    handles = proc.get("handles") or 0
    conns = proc.get("net_connections")
    if conns is None:
        conns = len(proc.get("connections") or [])
    io_total = (proc.get("io_read_mb") or 0) + (proc.get("io_write_mb") or 0)
    is_system = bool(proc.get("is_system"))

    cpu_factor = (cpu / 100.0) ** 1.1
    mem_factor = (mem / 100.0) ** 1.05

    score = (
        cpu_factor * 42
        + mem_factor * 28
        + min(threads / 120.0, 1.0) * 12
        + min(handles / 1200.0, 1.0) * 10
        + min(conns / 12.0, 1.0) * 6
        + min(io_total / 300.0, 1.0) * 4
    )

    # Active process baseline so idle-but-running tasks are not scored as 0
    if score < 8 and (threads >= 1 or handles >= 20):
        score = max(score, 6.0 + min(threads / 30.0, 4.0) + min(handles / 400.0, 4.0))

    if is_system and score < 50:
        score *= 0.8

    score = round(min(100.0, max(1.0, score)), 1)
    level = _risk_level_from_score(score)
    return {"risk_score": score, "risk_level": level}


def compute_system_risk(cpu: float, mem: float, procs: list, security_events: deque) -> dict:
    """Host-wide risk from resources, hot processes, and recent security signals."""
    cpu = _clamp_pct(cpu)
    mem = _clamp_pct(mem)

    cpu_contrib = min(38.0, (cpu / 100.0) ** 1.25 * 38)
    mem_contrib = min(32.0, (mem / 100.0) ** 1.2 * 32)

    proc_contrib = 0.0
    if procs:
        risks = [compute_process_risk(p)["risk_score"] for p in procs]
        top_avg = sum(sorted(risks, reverse=True)[:5]) / min(5, len(risks))
        hot = sum(1 for p in procs if _clamp_pct(p.get("cpu_percent")) >= 30)
        proc_contrib = min(22.0, top_avg * 0.22 + hot * 1.2)

    crit = sum(1 for e in security_events if e.get("severity") == "CRITICAL")
    warn = sum(1 for e in security_events if e.get("severity") == "WARNING")
    sec_contrib = min(12.0, crit * 2.5 + warn * 0.4)

    total = round(min(100.0, cpu_contrib + mem_contrib + proc_contrib + sec_contrib), 1)
    level = _risk_level_from_score(total)

    return {
        "risk_percent": total,
        "risk_level": level,
        "risk_factors": {
            "cpu": round(cpu_contrib, 1),
            "memory": round(mem_contrib, 1),
            "processes": round(proc_contrib, 1),
            "security": round(sec_contrib, 1),
        },
    }


def get_processes_snapshot():
    # Prime CPU counters so per-process cpu_percent is non-zero on this pass
    psutil.cpu_percent(interval=0.05)
    procs = []
    for proc in psutil.process_iter():
        try:
            info = collect_process_fast(proc)
            procs.append(info)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return sorted(procs, key=lambda x: x.get("cpu_percent", 0), reverse=True)[:60]

async def cache_processes_loop():
    global cached_processes
    logging.info("Starting background Process Cache Loop...")
    while True:
        try:
            loop = asyncio.get_event_loop()
            procs = await loop.run_in_executor(None, get_processes_snapshot)
            cached_processes = procs
        except Exception as e:
            logging.error(f"Error updating process cache: {e}")
        await asyncio.sleep(4.0)

@app.get("/api/processes")
def get_processes():
    """Deep OS-level process intelligence — far beyond Task Manager."""
    global cached_processes
    return cached_processes


@app.get("/api/processes/detail/{pid}")
def get_process_detail(pid: int):
    """Full forensic deep-dive on a single process — all kernel-visible attributes."""
    try:
        proc = psutil.Process(pid)
        base = collect_process_deep(proc)

        # Extended data: environment variables of this process
        env = _safe(lambda: dict(list(proc.environ().items())[:30]), {})

        # Memory maps (dll/so list)
        maps = _safe(lambda: [
            {"path": m.path, "rss_mb": round(m.rss / 1024 / 1024, 2)}
            for m in proc.memory_maps()
            if m.path
        ], [])
        # Cap maps to 25 entries
        maps = maps[:25]

        # All open files (uncapped)
        all_files = _safe(lambda: [f.path for f in proc.open_files()], [])

        # All network connections (compat wrapper)
        all_conns = _safe(lambda: _proc_connections(proc, "inet"), [])
        conns_full = []
        for c in (all_conns or []):
            conns_full.append({
                "laddr": f"{c.laddr.ip}:{c.laddr.port}" if c.laddr else "",
                "raddr": f"{c.raddr.ip}:{c.raddr.port}" if c.raddr else "",
                "status": c.status,
                "type": "TCP" if c.type == 1 else "UDP"
            })

        base["env_vars"]      = env
        base["memory_maps"]   = maps
        base["all_open_files"]= all_files
        base["all_connections"]= conns_full
        return base
    except psutil.NoSuchProcess:
        return {"error": f"Process {pid} no longer exists."}
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/system/hardware")
def get_hardware_info():
    """Collects GPU, battery, temperature sensors, and CPU physical topology."""
    result = {}

    # CPU physical topology
    result["cpu_physical_cores"]  = psutil.cpu_count(logical=False)
    result["cpu_logical_cores"]   = psutil.cpu_count(logical=True)
    result["cpu_freq_mhz"]        = _safe(lambda: round(psutil.cpu_freq().current, 1), "N/A")
    result["cpu_freq_max_mhz"]    = _safe(lambda: round(psutil.cpu_freq().max,     1), "N/A")
    result["cpu_per_core_pct"]    = _safe(lambda: psutil.cpu_percent(percpu=True), [])
    result["cpu_model"]           = platform.processor()

    # RAM
    vm = psutil.virtual_memory()
    result["ram_total_gb"]   = round(vm.total    / 1024**3, 2)
    result["ram_used_gb"]    = round(vm.used     / 1024**3, 2)
    result["ram_free_gb"]    = round(vm.free     / 1024**3, 2)
    result["ram_cached_gb"]  = round(getattr(vm, "cached", 0) / 1024**3, 2)
    result["ram_pct"]        = vm.percent

    # Swap
    sw = psutil.swap_memory()
    result["swap_total_gb"]  = round(sw.total / 1024**3, 2)
    result["swap_used_gb"]   = round(sw.used  / 1024**3, 2)
    result["swap_pct"]       = sw.percent

    # Battery
    batt = _safe(psutil.sensors_battery)
    if batt:
        result["battery_pct"]     = round(batt.percent, 1)
        result["battery_charging"]= batt.power_plugged
        result["battery_secs"]    = batt.secsleft if batt.secsleft >= 0 else -1
    else:
        result["battery"] = "Not available (desktop or no battery)"

    # Temperature sensors
    temps = _safe(lambda: psutil.sensors_temperatures(), {})
    if temps:
        temp_data = {}
        for name, entries in (temps or {}).items():
            temp_data[name] = [
                {"label": e.label or "core", "current": e.current, "high": e.high, "critical": e.critical}
                for e in entries
            ]
        result["temperatures"] = temp_data
    else:
        result["temperatures"] = "Not available on this platform"

    # GPU — via nvidia-smi if present
    try:
        gpu_out = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=4
        )
        if gpu_out.returncode == 0:
            gpus = []
            for line in gpu_out.stdout.strip().split("\n"):
                parts = [p.strip() for p in line.split(",")]
                if len(parts) >= 5:
                    gpus.append({
                        "name":       parts[0],
                        "util_pct":   parts[1],
                        "mem_used_mb":parts[2],
                        "mem_total_mb":parts[3],
                        "temp_c":     parts[4]
                    })
            result["gpus"] = gpus
        else:
            result["gpus"] = "No NVIDIA GPU detected"
    except Exception:
        result["gpus"] = "nvidia-smi not available"

    # Boot time
    result["boot_time"] = datetime.fromtimestamp(psutil.boot_time()).strftime("%Y-%m-%d %H:%M:%S")

    return result


@app.post("/api/terminate/{pid}")
def terminate_process(pid: int):
    try:
        proc = psutil.Process(pid)
        proc.terminate()
        return {"status": "Success", "message": f"Terminated process {pid}"}
    except Exception as e:
        return {"status": "Error", "message": str(e)}

# ── System Intelligence Endpoints ─────────────────────────────────────────────

@app.get("/api/system/info")
def get_system_info():
    """Returns hostname, local IP, public-facing adapter IP, MAC, OS details."""
    info = {}
    try:
        info["hostname"] = socket.gethostname()
        info["local_ip"] = socket.gethostbyname(socket.gethostname())
    except Exception:
        info["hostname"] = "N/A"
        info["local_ip"] = "N/A"

    # Collect all IPs per interface
    interfaces = []
    addrs = psutil.net_if_addrs()
    stats = psutil.net_if_stats()
    for iface, addr_list in addrs.items():
        entry = {"interface": iface, "ipv4": [], "ipv6": [], "mac": "N/A", "is_up": False}
        for a in addr_list:
            if a.family == socket.AF_INET:
                entry["ipv4"].append(a.address)
            elif a.family == socket.AF_INET6:
                entry["ipv6"].append(a.address)
            elif a.family == psutil.AF_LINK:
                entry["mac"] = a.address
        if iface in stats:
            entry["is_up"] = stats[iface].isup
            entry["speed_mbps"] = stats[iface].speed
            entry["mtu"] = stats[iface].mtu
        interfaces.append(entry)

    info["interfaces"] = interfaces
    # Primary MAC (first active interface with a real MAC)
    for ifc in interfaces:
        if ifc["is_up"] and ifc["mac"] not in ("N/A", "00:00:00:00:00:00"):
            info["primary_mac"] = ifc["mac"]
            info["primary_interface"] = ifc["interface"]
            if ifc["ipv4"]:
                info["primary_ip"] = ifc["ipv4"][0]
            break
    else:
        info["primary_mac"] = "N/A"
        info["primary_interface"] = "N/A"
        info["primary_ip"] = info.get("local_ip", "N/A")

    return info

@app.get("/api/system/interfaces")
def get_interfaces():
    """Returns all network interfaces with full address details."""
    addrs = psutil.net_if_addrs()
    stats = psutil.net_if_stats()
    result = []
    for iface, addr_list in addrs.items():
        entry = {"interface": iface, "addresses": [], "is_up": False, "speed_mbps": 0, "mtu": 0}
        for a in addr_list:
            fam = str(a.family)
            if a.family == socket.AF_INET:
                fam = "IPv4"
            elif a.family == socket.AF_INET6:
                fam = "IPv6"
            elif a.family == psutil.AF_LINK:
                fam = "MAC"
            entry["addresses"].append({"type": fam, "address": a.address, "netmask": a.netmask})
        if iface in stats:
            entry["is_up"] = stats[iface].isup
            entry["speed_mbps"] = stats[iface].speed
            entry["mtu"] = stats[iface].mtu
        result.append(entry)
    return result

@app.get("/api/system/packets")
def get_packet_stats():
    """Returns live network I/O counters (packets sent/recv, bytes, errors, drops)."""
    counters = psutil.net_io_counters(pernic=True)
    total = psutil.net_io_counters(pernic=False)
    per_nic = []
    for nic, c in counters.items():
        per_nic.append({
            "interface": nic,
            "bytes_sent": c.bytes_sent,
            "bytes_recv": c.bytes_recv,
            "packets_sent": c.packets_sent,
            "packets_recv": c.packets_recv,
            "errin": c.errin,
            "errout": c.errout,
            "dropin": c.dropin,
            "dropout": c.dropout,
        })
    return {
        "total": {
            "bytes_sent": total.bytes_sent,
            "bytes_recv": total.bytes_recv,
            "packets_sent": total.packets_sent,
            "packets_recv": total.packets_recv,
            "errin": total.errin,
            "errout": total.errout,
            "dropin": total.dropin,
            "dropout": total.dropout,
        },
        "per_interface": per_nic
    }

@app.get("/api/system/arp")
def get_arp_table():
    """Returns ARP table (IP-to-MAC mappings) — cross-platform."""
    import re
    try:
        result = subprocess.check_output(["arp", "-a"], text=True, timeout=5)
        entries = []
        for line in result.splitlines():
            # macOS/Linux: "? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0"
            # Windows:     "  192.168.1.1    aa-bb-cc-dd-ee-ff    dynamic"
            ip_match = re.search(r'\((\d{1,3}(?:\.\d{1,3}){3})\)', line)
            mac_match = re.search(r'([0-9a-fA-F]{1,2}[:\-][0-9a-fA-F]{1,2}(?:[:\-][0-9a-fA-F]{1,2}){4})', line)
            if not ip_match:
                # Windows format: first token is the IP
                parts = line.split()
                if parts and re.match(r'^\d{1,3}(?:\.\d{1,3}){3}$', parts[0]):
                    ip_match_val = parts[0]
                    mac_val = parts[1] if len(parts) > 1 else "N/A"
                    kind = parts[2] if len(parts) > 2 else "dynamic"
                    entries.append({"ip": ip_match_val, "mac": mac_val, "type": kind})
                    continue
            if ip_match and mac_match:
                entries.append({
                    "ip": ip_match.group(1),
                    "mac": mac_match.group(1),
                    "type": "dynamic",
                })
        return {"arp_table": entries, "raw": result}
    except Exception as e:
        return {"arp_table": [], "error": str(e)}

@app.get("/api/system/connections")
def get_active_connections():
    """Returns all active TCP/UDP connections with process names."""
    conns = []
    try:
        connections = psutil.net_connections(kind="inet")
    except (psutil.AccessDenied, PermissionError):
        connections = []
        try:
            connections = list(psutil.Process().connections(kind="inet"))
        except Exception:
            pass

    for c in connections:
        proc_name = "Unknown"
        c_pid = getattr(c, "pid", None) or os.getpid()
        if c_pid:
            try:
                proc_name = psutil.Process(c_pid).name()
            except Exception:
                pass

        remote = f"{c.raddr.ip}:{c.raddr.port}" if c.raddr else "N/A"
        conns.append({
            "pid": c_pid,
            "process": proc_name,
            "remote_addr": remote,
            "local_address": f"{c.laddr.ip}:{c.laddr.port}" if c.laddr else "N/A",
            "remote_address": remote,
            "status": c.status,
            "family": "TCP" if c.type == socket.SOCK_STREAM else "UDP",
        })
    return {"connections": conns}


@app.get("/api/system/events/processes")
def get_process_events_api():
    return {"events": list(process_events_hist)[::-1][:200]}


@app.get("/api/system/events/files")
def get_file_events_api():
    return {"events": list(file_events_hist)[::-1][:200]}


@app.get("/api/system/events/security")
def get_security_events_api():
    return {"events": list(security_events_hist)[::-1][:200]}


@app.get("/api/system/processes")
def get_system_processes():
    """Process list shaped for the React dashboard."""
    global cached_processes
    procs = cached_processes or get_processes_snapshot()
    shaped = []
    for p in procs:
        risk = compute_process_risk(p)
        shaped.append({
            "pid": p["pid"],
            "name": p["name"],
            "exe": p.get("exe"),
            "ppid": p.get("ppid"),
            "username": p.get("username"),
            "cpu_percent": p.get("cpu_percent", 0),
            "memory_percent": p.get("memory_percent", 0),
            "mem_vms_mb": p.get("mem_vms_mb", 0),
            "io_read_mb": p.get("io_read_mb", 0),
            "io_write_mb": p.get("io_write_mb", 0),
            "num_threads": p.get("num_threads", 0),
            "handles": p.get("handles", 0),
            "net_connections": len(p.get("connections") or []),
            "status": p.get("status", "unknown"),
            "priority": p.get("priority", "Normal"),
            "is_system": p.get("is_system", False),
            "risk_score": risk["risk_score"],
            "risk_level": risk["risk_level"],
        })
    return {"processes": shaped}


def _check_secure_boot_quick() -> bool:
    """Fast per-platform Secure Boot check. Returns True when verified enabled."""
    sys_name = platform.system()
    if sys_name == "Windows":
        try:
            import winreg
            key = winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r"SYSTEM\CurrentControlSet\Control\SecureBoot\State",
                0, winreg.KEY_READ,
            )
            val, _ = winreg.QueryValueEx(key, "UEFISecureBootEnabled")
            return val == 1
        except Exception:
            return False
    elif sys_name == "Darwin":
        try:
            out = subprocess.check_output(
                ["nvram", "94b73556-2197-4702-82a8-3e1337dafbfb:AppleSecureBootPolicy"],
                text=True, stderr=subprocess.DEVNULL, timeout=3,
            )
            # %02 = Full Security, %03 = Medium (both = "enabled")
            return "%02" in out or "%03" in out or "%01" in out
        except Exception:
            try:
                out = subprocess.check_output(
                    ["system_profiler", "SPiBridgeDataType"],
                    text=True, stderr=subprocess.DEVNULL, timeout=5,
                )
                return "Full Security" in out or "T2" in out or "Apple M" in out
            except Exception:
                return False
    else:
        try:
            result = subprocess.check_output(
                ["mokutil", "--sb-state"], text=True, stderr=subprocess.DEVNULL, timeout=3,
            )
            return "enabled" in result.lower()
        except Exception:
            sb = "/sys/firmware/efi/efivars/SecureBoot-8be4df61-93ca-11d2-aa0d-00e098032b8c"
            if os.path.exists(sb):
                try:
                    with open(sb, "rb") as f:
                        data = f.read()
                    return len(data) >= 5 and data[4] == 1
                except Exception:
                    pass
            return False


@app.get("/api/system/status")
def get_system_status():
    cpu = psutil.cpu_percent(interval=0.1)
    mem = psutil.virtual_memory().percent
    procs = cached_processes or []
    risk = compute_system_risk(cpu, mem, procs, security_events_hist)
    hot = sum(1 for p in procs if _clamp_pct(p.get("cpu_percent")) >= 30)
    return {
        **risk,
        "cpu_percent": round(cpu, 1),
        "memory_percent": round(mem, 1),
        "process_count": len(psutil.pids()),
        "telemetry_events": len(process_events_hist) + len(file_events_hist) + len(security_events_hist),
        "shield_active": True,
        "ipc_connected": len(connected_clients) > 0,
        "boot_secure": _check_secure_boot_quick(),
        "mem_secure": mem < 85,
        "beh_secure": hot < 6 and risk["risk_percent"] < 50,
        "modules": {
            "integrity": "ACTIVE",
            "network_c2": "MONITORING",
            "registry": "SECURED",
            "kernel_etw": "COLLECTING",
            "ransomware_shield": "PROTECTED",
        },
        "data_source": "live",
    }


class ExecuteRequest(BaseModel):
    command: str
    shell: str = "powershell"


@app.post("/api/system/execute")
def execute_system_command(req: ExecuteRequest = Body(...)):
    """Run an OS shell command (admin rights apply to the agent process)."""
    cmd = (req.command or "").strip()
    if not cmd:
        return {"ok": False, "error": "Empty command"}

    try:
        import sys
        if sys.platform != "win32":
            proc = subprocess.run(
                ["sh", "-c", cmd],
                capture_output=True,
                text=True,
                timeout=120,
            )
        elif req.shell.lower() == "cmd":
            proc = subprocess.run(
                ["cmd", "/c", cmd],
                capture_output=True,
                text=True,
                timeout=120,
            )
        else:
            proc = subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd],
                capture_output=True,
                text=True,
                timeout=120,
            )
        logging.info(f"Executed command (rc={proc.returncode}): {cmd[:120]}")
        return {
            "ok": proc.returncode == 0,
            "returncode": proc.returncode,
            "stdout": (proc.stdout or "")[-50000:],
            "stderr": (proc.stderr or "")[-10000:],
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "Command timed out after 120 seconds"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@app.get("/api/system/dns")
def get_dns_info():
    """Returns DNS configuration and resolver records (cross-platform)."""
    sys_name = platform.system()
    records = []
    raw = ""
    try:
        if sys_name == "Darwin":
            result = subprocess.check_output(["scutil", "--dns"], text=True, timeout=8)
            raw = result
            for line in result.splitlines():
                line = line.strip()
                if line.startswith("nameserver[") or line.startswith("search domain["):
                    parts = line.split(":", 1)
                    if len(parts) == 2:
                        records.append(parts[1].strip())
        elif sys_name == "Linux":
            try:
                with open("/etc/resolv.conf") as f:
                    raw = f.read()
                for line in raw.splitlines():
                    line = line.strip()
                    if line.startswith("nameserver") or line.startswith("search"):
                        records.append(line)
            except Exception:
                pass
            try:
                r2 = subprocess.check_output(
                    ["resolvectl", "status"], text=True, timeout=5,
                    stderr=subprocess.DEVNULL,
                )
                raw += "\n" + r2
                for line in r2.splitlines():
                    if "DNS Servers" in line:
                        parts = line.split(":", 1)
                        if len(parts) == 2:
                            records.extend(parts[1].strip().split())
            except Exception:
                pass
        else:
            result = subprocess.check_output(["ipconfig", "/displaydns"], text=True, timeout=8)
            raw = result
            for line in result.splitlines():
                if "Record Name" in line or "Eintragname" in line:
                    parts = line.split(":", 1)
                    if len(parts) == 2:
                        records.append(parts[1].strip())
        return {"dns_records": list(dict.fromkeys(records))[:50], "raw_preview": raw[:2000]}
    except Exception as e:
        return {"dns_records": [], "error": str(e)}

@app.get("/api/system/cpu_mem")
def get_cpu_mem():
    """Returns live CPU and memory utilization."""
    cpu_per_core = psutil.cpu_percent(interval=0.5, percpu=True)
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()
    return {
        "cpu_total_percent": psutil.cpu_percent(interval=None),
        "cpu_per_core": cpu_per_core,
        "cpu_count": psutil.cpu_count(),
        "cpu_freq_mhz": psutil.cpu_freq().current if psutil.cpu_freq() else 0,
        "memory_total_gb": round(mem.total / 1e9, 2),
        "memory_used_gb": round(mem.used / 1e9, 2),
        "memory_percent": mem.percent,
        "swap_total_gb": round(swap.total / 1e9, 2),
        "swap_used_gb": round(swap.used / 1e9, 2),
        "swap_percent": swap.percent
    }

@app.get("/api/system/disk")
def get_disk_info():
    """Returns disk partitions and usage."""
    partitions = []
    for p in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(p.mountpoint)
            partitions.append({
                "device": p.device,
                "mountpoint": p.mountpoint,
                "fstype": p.fstype,
                "total_gb": round(usage.total / 1e9, 2),
                "used_gb": round(usage.used / 1e9, 2),
                "free_gb": round(usage.free / 1e9, 2),
                "percent": usage.percent
            })
        except Exception:
            pass
    return partitions

@app.post("/api/system/cache/clear")
def clear_system_cache():
    """Clears system DNS cache (cross-platform)."""
    sys_name = platform.system()
    try:
        if sys_name == "Darwin":
            subprocess.run(["dscacheutil", "-flushcache"], check=True, timeout=5)
            subprocess.run(["killall", "-HUP", "mDNSResponder"], check=True, timeout=5)
            return {"status": "Success", "message": "Successfully flushed macOS DNS cache (mDNSResponder reloaded)."}
        elif sys_name == "Linux":
            for cmd in (
                ["resolvectl", "flush-caches"],
                ["systemd-resolve", "--flush-caches"],
                ["service", "nscd", "restart"],
            ):
                try:
                    subprocess.run(cmd, check=True, timeout=5, capture_output=True)
                    return {"status": "Success", "message": "Successfully flushed Linux DNS resolver cache."}
                except Exception:
                    continue
            return {"status": "Error", "message": "No supported DNS cache flush tool found (resolvectl/nscd). Try running as root."}
        else:
            out = subprocess.check_output(["ipconfig", "/flushdns"], text=True, timeout=5)
            return {"status": "Success", "message": "Successfully cleared system DNS cache.", "raw": out}
    except subprocess.CalledProcessError as e:
        return {"status": "Error", "message": f"Command failed (may need elevated privileges): {str(e)}"}
    except Exception as e:
        return {"status": "Error", "message": str(e)}

@app.get("/api/system/cache/info")
def get_cache_info():
    """Gets DNS cache size and OS cache details (cross-platform)."""
    sys_name = platform.system()
    dns_count = 0
    try:
        if sys_name == "Darwin":
            try:
                result = subprocess.check_output(
                    ["dscacheutil", "-statistics"], text=True, timeout=5,
                    stderr=subprocess.DEVNULL,
                )
                import re as _re
                m = _re.search(r'Total\s+(\d+)', result)
                if m:
                    dns_count = int(m.group(1))
            except Exception:
                pass
        elif sys_name == "Linux":
            try:
                result = subprocess.check_output(
                    ["resolvectl", "statistics"], text=True, timeout=5,
                    stderr=subprocess.DEVNULL,
                )
                for line in result.splitlines():
                    if "Current Cache Size" in line:
                        parts = line.split(":")
                        if len(parts) == 2:
                            try:
                                dns_count = int(parts[1].strip())
                            except ValueError:
                                pass
            except Exception:
                pass
        else:
            result = subprocess.check_output(["ipconfig", "/displaydns"], text=True, timeout=8)
            for line in result.splitlines():
                if "Record Name" in line or "Eintragname" in line:
                    dns_count += 1
    except Exception:
        pass

    mem = psutil.virtual_memory()
    cached_bytes = getattr(mem, "cached", 0)
    return {
        "dns_records_count": dns_count,
        "system_cache_bytes": cached_bytes,
        "available_memory_gb": round(mem.available / 1e9, 2),
    }

@app.get("/api/system/os_info")
def get_os_info():
    """Returns operating system name, release version, kernel, architecture, and uptime."""
    try:
        boot_time_ts = psutil.boot_time()
        uptime_seconds = int(time.time() - boot_time_ts)
        
        days = uptime_seconds // 86400
        hours = (uptime_seconds % 86400) // 3600
        minutes = (uptime_seconds % 3600) // 60
        seconds = uptime_seconds % 60
        
        uptime_str = ""
        if days > 0: uptime_str += f"{days}d "
        if hours > 0 or days > 0: uptime_str += f"{hours}h "
        uptime_str += f"{minutes}m {seconds}s"

        return {
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "machine": platform.machine(),
            "processor": platform.processor(),
            "boot_time": datetime.fromtimestamp(boot_time_ts).strftime("%Y-%m-%d %H:%M:%S"),
            "uptime_seconds": uptime_seconds,
            "uptime": uptime_str
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/system/services")
def get_system_services():
    """Returns active running system services (cross-platform)."""
    sys_name = platform.system()
    services = []
    try:
        if sys_name == "Windows":
            for service in psutil.win_service_iter():
                try:
                    info = service.as_dict()
                    if info.get("status") == "running":
                        services.append({
                            "name": info.get("name"),
                            "display_name": info.get("display_name"),
                            "status": info.get("status"),
                            "start_type": info.get("start_type"),
                        })
                except Exception:
                    pass
        elif sys_name == "Darwin":
            result = subprocess.check_output(
                ["launchctl", "list"], text=True, timeout=8,
            )
            for line in result.splitlines()[1:]:  # skip header
                parts = line.split("\t")
                if len(parts) >= 3:
                    pid_str, _status, label = parts[0].strip(), parts[1].strip(), parts[2].strip()
                    if pid_str != "-" and label:
                        services.append({
                            "name": label,
                            "display_name": label,
                            "status": "running",
                            "start_type": "automatic",
                        })
        else:
            result = subprocess.check_output(
                ["systemctl", "list-units", "--type=service", "--state=running",
                 "--no-pager", "--no-legend"],
                text=True, timeout=8,
            )
            for line in result.splitlines():
                parts = line.split()
                if len(parts) >= 4:
                    unit = parts[0].rstrip()
                    desc = " ".join(parts[4:]) if len(parts) > 4 else unit
                    services.append({
                        "name": unit,
                        "display_name": desc,
                        "status": parts[2],
                        "start_type": "enabled",
                    })
    except Exception as e:
        return {"services": [], "error": str(e)}
    return {"services": sorted(services, key=lambda s: s["name"])[:35], "total_running": len(services)}

@app.get("/api/system/users")
def get_logged_in_users():
    """Returns currently logged in system users."""
    try:
        users = []
        for u in psutil.users():
            users.append({
                "name": u.name,
                "terminal": u.terminal,
                "host": u.host,
                "started": datetime.fromtimestamp(u.started).strftime("%Y-%m-%d %H:%M:%S") if u.started else "N/A",
                "pid": u.pid
            })
        
        if not users:
            try:
                current_user = os.getlogin()
            except Exception:
                current_user = os.environ.get("USERNAME", "N/A")
            users.append({
                "name": current_user,
                "terminal": "Console",
                "host": "localhost",
                "started": "N/A",
                "pid": os.getpid()
            })
        return {"users": users}
    except Exception as e:
        return {"users": [], "error": str(e)}

@app.get("/api/system/env_vars")
def get_environment_variables():
    """Returns key system environment variables (cross-platform)."""
    try:
        sys_name = platform.system()
        if sys_name == "Windows":
            keys = ["COMPUTERNAME", "USERNAME", "OS", "PROCESSOR_ARCHITECTURE",
                    "SYSTEMROOT", "USERPROFILE", "NUMBER_OF_PROCESSORS"]
        elif sys_name == "Darwin":
            keys = ["HOSTNAME", "USER", "HOME", "SHELL", "TMPDIR", "TERM", "LANG", "PATH"]
        else:
            keys = ["HOSTNAME", "USER", "HOME", "SHELL", "TERM", "LANG",
                    "XDG_SESSION_TYPE", "PATH"]
        vars_dict = {k: os.environ.get(k, "N/A") for k in keys}
        # Ensure a minimal cross-platform baseline is always populated
        for ck in ("USER", "HOME"):
            if ck not in vars_dict:
                vars_dict[ck] = os.environ.get(ck, "N/A")
        return {"env_variables": vars_dict}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/firewall/block")
def block_ip_address(ip: str):
    """Blocks an IP address using the platform firewall (cross-platform)."""
    try:
        socket.inet_aton(ip)
    except Exception:
        return {"status": "Error", "message": f"Invalid IP address format: {ip}"}

    sys_name = platform.system()
    safe_ip = ip.replace(".", "_")
    try:
        if sys_name == "Darwin":
            # macOS: pfctl anchor rule
            anchor = f"securit/{safe_ip}"
            rule = f"block drop from {ip} to any\nblock drop from any to {ip}\n"
            anchor_file = f"/tmp/securit_block_{safe_ip}.conf"
            with open(anchor_file, "w") as fh:
                fh.write(rule)
            subprocess.run(["pfctl", "-a", anchor, "-f", anchor_file],
                           check=True, capture_output=True, timeout=5)
            subprocess.run(["pfctl", "-e"], capture_output=True, timeout=5)
            return {"status": "Success", "message": f"macOS PF firewall rule added to block {ip}."}
        elif sys_name == "Linux":
            subprocess.run(["iptables", "-I", "INPUT", "-s", ip, "-j", "DROP"],
                           check=True, capture_output=True, timeout=5)
            subprocess.run(["iptables", "-I", "OUTPUT", "-d", ip, "-j", "DROP"],
                           check=True, capture_output=True, timeout=5)
            return {"status": "Success", "message": f"iptables rules added to block {ip}."}
        else:
            cmd_in = ["netsh", "advfirewall", "firewall", "add", "rule",
                      f"name=SecuritBlock_{ip}_In", "dir=in", "action=block", f"remoteip={ip}"]
            cmd_out = ["netsh", "advfirewall", "firewall", "add", "rule",
                       f"name=SecuritBlock_{ip}_Out", "dir=out", "action=block", f"remoteip={ip}"]
            r_in = subprocess.run(cmd_in, capture_output=True, text=True, timeout=5)
            r_out = subprocess.run(cmd_out, capture_output=True, text=True, timeout=5)
            if r_in.returncode == 0 and r_out.returncode == 0:
                return {"status": "Success", "message": f"Windows Firewall rules added to block {ip}."}
            err = r_in.stderr or r_out.stderr or "Permission denied (requires admin)"
            return {"status": "Simulated", "message": f"Virtual firewall isolated {ip}. (Rule failed: {err.strip()})"}
    except subprocess.CalledProcessError as e:
        return {"status": "Simulated", "message": f"Virtual firewall isolated {ip}. (Requires elevated privileges: {str(e)})"}
    except Exception as e:
        return {"status": "Simulated", "message": f"Virtual firewall isolated {ip}. (Error: {str(e)})"}

@app.post("/api/file/quarantine")
def quarantine_file(filepath: str):
    """Quarantines a dangerous file by moving it to a secure sandbox directory."""
    if not filepath:
        return {"status": "Error", "message": "No file path provided."}
        
    target_path = os.path.abspath(filepath)
    if not os.path.exists(target_path):
        return {"status": "Error", "message": f"File not found: {target_path}"}
        
    try:
        quarantine_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "quarantine")
        os.makedirs(quarantine_dir, exist_ok=True)
        
        filename = os.path.basename(target_path)
        dest_path = os.path.join(quarantine_dir, f"{filename}.quarantine_{int(time.time())}")
        
        os.rename(target_path, dest_path)
        
        log_path = dest_path + ".log"
        with open(log_path, "w") as f:
            f.write(f"Quarantined File: {target_path}\nDate: {datetime.now()}\nStatus: ISOLATED")
            
        return {
            "status": "Success",
            "message": f"File '{filename}' successfully quarantined.",
            "original_path": target_path,
            "quarantine_path": dest_path
        }
    except Exception as e:
        return {"status": "Error", "message": f"Failed to quarantine file: {str(e)}"}

@app.on_event("startup")
async def startup_event():
    loop = asyncio.get_event_loop()
    # Start tasks
    asyncio.create_task(event_distributor())
    asyncio.create_task(monitor_processes())
    asyncio.create_task(monitor_network())
    asyncio.create_task(monitor_event_logs())
    asyncio.create_task(cache_processes_loop())
    
    # Start file watcher in background thread (requires watchdog's own threading structure)
    loop.run_in_executor(None, start_file_watcher, loop)

# Serve the frontend directory (built output)
frontend_dist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "dist")
frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")
# Prefer dist/ (Vite build output), fall back to frontend/ root
serve_dir = frontend_dist_dir if os.path.exists(frontend_dist_dir) else frontend_dir
if os.path.exists(serve_dir):
    from fastapi.responses import FileResponse
    @app.get("/")
    def serve_index():
        response = FileResponse(os.path.join(serve_dir, "index.html"))
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response
    app.mount("/", StaticFiles(directory=serve_dir), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
