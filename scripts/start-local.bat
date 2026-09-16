@echo off
cd /d "%~dp0.."
set "HUIJU_VAR_DIR=%CD%\.codex-tmp\local-var"
start "" /b powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:8081/studio.html?v=20260908-member-access-v41'"
".local-venv\Scripts\python.exe" -m uvicorn backend.huiju.api.app:app --host 127.0.0.1 --port 8081
pause
