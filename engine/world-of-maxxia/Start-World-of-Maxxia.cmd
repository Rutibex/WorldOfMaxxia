@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js 22.18 or newer, then run this file again.
  pause
  exit /b 1
)
if not exist dist\index.html (
  echo Browser build is missing. Run npm ci then npm run build first.
  pause
  exit /b 1
)
echo World of Maxxia 0.72.0 - Elevation, Hazards and Mutable Routes (MP27)
echo Stop any older launcher window with Ctrl+C first.
echo Open http://localhost:3000 only after THIS window says the server has started.
echo Keep this window open while playing. Press Ctrl+C to stop.
node server.mjs
pause
