# JARVIS System Startup Script
Write-Host "========================================"
Write-Host "   JARVIS - Security OS AI Assistant"
Write-Host "========================================"
Write-Host ""

# Start Core Agent
Write-Host "[*] Starting Core Agent (Port 8000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; python core_agent.py" -WindowStyle Normal

# Wait 3 seconds
Start-Sleep -Seconds 3

# Start AI Engine
Write-Host "[*] Starting AI Engine (Port 8001)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\ai_engine'; python -m uvicorn main:app --host 127.0.0.1 --port 8001" -WindowStyle Normal

# Wait 3 seconds
Start-Sleep -Seconds 3

# Open browser
Write-Host "[*] Opening JARVIS Dashboard..." -ForegroundColor Cyan
Start-Process "http://127.0.0.1:8000"

Write-Host ""
Write-Host "========================================"
Write-Host "All services started!" -ForegroundColor Green
Write-Host "Dashboard: http://127.0.0.1:8000"
Write-Host "========================================"
Write-Host ""
