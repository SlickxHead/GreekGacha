@echo off
cd /d "%~dp0"
echo Serving http://localhost:5173  (Ctrl+C to stop)
python -m http.server 5173
