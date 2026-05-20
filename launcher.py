# C:\Users\Utkarsh Dubey\.gemini\antigravity\Securit-Windows\launcher.py
import os
import sys
import subprocess
import time
import webbrowser

def install_dependencies():
    print("[*] Installing required Python dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("[+] Dependencies installed successfully.")
    except Exception as e:
        print(f"[-] Dependency installation failed: {e}")
        sys.exit(1)

def run_service(script_name, port):
    print(f"[*] Starting {script_name} on port {port}...")
    # Run as background subprocess
    proc = subprocess.Popen([sys.executable, script_name])
    return proc

def main():
    install_dependencies()
    
    services = []
    try:
        # Start AI Engine on port 8001
        ai_proc = run_service("ai_engine.py", 8001)
        services.append(ai_proc)
        
        # Start Core Agent on port 8000
        core_proc = run_service("core_agent.py", 8000)
        services.append(core_proc)
        
        # Give services a couple of seconds to spin up
        time.sleep(3)
        
        # Open frontend UI via the core agent web server to ensure secure context for audio/voice features
        print("[*] Launching Frontend: http://127.0.0.1:8000/")
        webbrowser.open("http://127.0.0.1:8000/")

        print("[+] JARVIS Defense Platform is running. Press Ctrl+C in this terminal to shutdown services.")
        
        # Keep launcher alive
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n[-] Shutdown signal received. Stopping services...")
    finally:
        for proc in services:
            try:
                proc.terminate()
                proc.wait(timeout=2)
            except Exception:
                pass
        print("[+] Clean shutdown complete.")

if __name__ == "__main__":
    main()
