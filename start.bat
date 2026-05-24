@echo off
setlocal

set "APP_DIR=%~dp0"
set "LOG_DIR=%APP_DIR%logs"
cd /d "%APP_DIR%"

title Natively Launcher
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>nul

echo [Natively] stopping old Natively dev processes...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root = (Resolve-Path '%APP_DIR%').Path; Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.Contains($root) -and ($_.CommandLine -match 'node_modules[\\/]+vite[\\/]+bin[\\/]+vite\.js' -or $_.CommandLine -match 'node_modules[\\/]+electron[\\/]+dist[\\/]+electron\.exe' -or $_.CommandLine -match 'node_modules[\\/]+electron[\\/]+cli\.js') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo [Natively] checking OmniRoute on 127.0.0.1:20128...
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (-not (Test-NetConnection 127.0.0.1 -Port 20128 -InformationLevel Quiet)) { exit 1 }"
if errorlevel 1 (
  echo [Natively] OmniRoute is not running on 127.0.0.1:20128.
  echo [Natively] Start OmniRoute first, then run this file again.
  pause
  exit /b 1
)

if not exist "%APP_DIR%native-module\index.win32-x64-msvc.node" (
  echo [Natively] building native audio module...
  call npm run build:native
  if errorlevel 1 (
    echo [Natively] Native audio build failed.
    pause
    exit /b 1
  )
)

echo [Natively] starting Vite on 127.0.0.1:5180...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -WindowStyle Hidden -WorkingDirectory '%APP_DIR%' -FilePath 'node' -ArgumentList @('node_modules\vite\bin\vite.js','--host','127.0.0.1','--port','5180','--strictPort') -RedirectStandardOutput '%LOG_DIR%\vite.log' -RedirectStandardError '%LOG_DIR%\vite.err.log'"

echo [Natively] waiting for Vite...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline = (Get-Date).AddSeconds(45); do { try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:5180/?window=launcher' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; Start-Sleep -Milliseconds 500 } while ((Get-Date) -lt $deadline); exit 1"
if errorlevel 1 (
  echo [Natively] Vite did not start on 127.0.0.1:5180.
  echo [Natively] Vite logs: %LOG_DIR%\vite.log and %LOG_DIR%\vite.err.log
  pause
  exit /b 1
)

echo [Natively] building Electron main...
call npm run build:electron
if errorlevel 1 (
  echo [Natively] Electron main build failed.
  pause
  exit /b 1
)

echo [Natively] launching Electron...
set "NODE_ENV=development"
start "Natively Electron" "%APP_DIR%node_modules\electron\dist\electron.exe" .
exit /b 0
