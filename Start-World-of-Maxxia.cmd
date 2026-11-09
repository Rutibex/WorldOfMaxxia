@echo off
setlocal
pushd "%~dp0engine\world-of-maxxia"
if errorlevel 1 exit /b 1
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.18 or newer, then run this launcher again.
  pause
  popd
  exit /b 1
)
echo Open http://localhost:3000 after the server reports that it has started.
node server.mjs
set "maxxia_exit=%errorlevel%"
popd
if not "%maxxia_exit%"=="0" pause
exit /b %maxxia_exit%
