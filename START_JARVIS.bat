@echo off
title JARVIS System Startup
color 0A

echo.
echo ========================================
echo    JARVIS - Security OS AI Assistant
echo ========================================
echo.

REM Start Core Agent (Port 8000)
echo [*] Starting Core Agent (Port 8000)...
start "JARVIS Core Agent" cmd /k "cd /d "%cd%\ai_engine" && python core_agent.py"

REM Wait 3 seconds
timeout /t 3 /nobreak

REM Start AI Engine (Port 8001)
echo [*] Starting AI Engine (Port 8001)...
start "JARVIS AI Engine" cmd /k "cd /d "%cd%\ai_engine" && python -m uvicorn main:app --host 127.0.0.1 --port 8001"

REM Wait 3 seconds
timeout /t 3 /nobreak

REM Open browser
echo [*] Opening JARVIS Dashboard...
start http://127.0.0.1:8000

echo.
echo ========================================
echo All services started!
echo Dashboard: http://127.0.0.1:8000
echo ========================================
echo.
pause
