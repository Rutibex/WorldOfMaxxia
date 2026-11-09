@echo off
cd /d "%~dp0.."
node --experimental-strip-types engine\world-of-maxxia\scripts\build-offline.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
echo Open http://localhost:3000 in your browser.
echo Single-map proof: http://localhost:3000/?project=projects/SingleMapProof/SingleMapProof.maxxia
node engine\world-of-maxxia\server.mjs
pause
