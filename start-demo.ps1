# LeadPilot -- one-click demo launcher for Windows.
# Starts Ollama + the app in the background, waits until it is ready, opens
# your browser, then returns control to you. Close nothing -- just demo.
#
# Usage:  powershell -ExecutionPolicy Bypass -File start-demo.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

$model = if ($env:OLLAMA_MODEL) { $env:OLLAMA_MODEL } else { "qwen2.5:1.5b" }
$pidFile = Join-Path $root ".demo-app.pid"
$logFile = Join-Path $root "demo-app.log"

function Write-Step($msg) { Write-Host "`n=> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "   $msg" -ForegroundColor Green }
function Write-Bad($msg)  { Write-Host "   $msg" -ForegroundColor Red }

# ---------- Ollama ----------
$ollama = "ollama"
if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
  $candidate = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
  if (Test-Path $candidate) { $ollama = $candidate }
  else { Write-Bad "Ollama not found. Install it from https://ollama.com/download"; exit 1 }
}

function Test-OllamaUp {
  try { Invoke-WebRequest "http://127.0.0.1:11434/api/version" -UseBasicParsing -TimeoutSec 3 | Out-Null; return $true }
  catch { return $false }
}

Write-Step "Checking Ollama server"
if (-not (Test-OllamaUp)) {
  Write-Host "   starting Ollama..." -ForegroundColor Yellow
  Start-Process -FilePath $ollama -ArgumentList "serve" -WindowStyle Hidden
  for ($i = 0; $i -lt 30; $i++) { if (Test-OllamaUp) { break }; Start-Sleep -Seconds 1 }
}
if (Test-OllamaUp) { Write-Ok "Ollama is up." } else { Write-Bad "Could not reach Ollama."; exit 1 }

# ---------- Model ----------
Write-Step "Checking model: $model"
$tags = Invoke-RestMethod "http://127.0.0.1:11434/api/tags" -TimeoutSec 5
$have = @($tags.models | ForEach-Object { $_.name }) -contains $model
if (-not $have) {
  Write-Host "   pulling $model (one-time download)..." -ForegroundColor Yellow
  & $ollama pull $model
} else { Write-Ok "model present." }

Write-Step "Warming the model"
$body = @{ model = $model; keep_alive = "4h"; messages = @(@{ role = "user"; content = "hi" }); options = @{ num_predict = 1 }; stream = $false } | ConvertTo-Json -Depth 5
try { Invoke-RestMethod "http://127.0.0.1:11434/api/chat" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 60 | Out-Null; Write-Ok "warm." } catch {}

# ---------- Build (first run only) ----------
if (-not (Test-Path (Join-Path $root ".next"))) {
  Write-Step "Building the app (first run only, ~1 min)"
  npm run build
}

# ---------- Start the app in the background ----------
Write-Step "Starting LeadPilot"

function Test-AppUp {
  try { Invoke-WebRequest "http://localhost:3000/" -UseBasicParsing -TimeoutSec 2 | Out-Null; return $true }
  catch { return $false }
}

if (Test-AppUp) {
  Write-Ok "Already running."
} else {
  $npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue)
  $npmPath = if ($npmCmd) { $npmCmd.Source } else { "npm.cmd" }

  $errLogFile = Join-Path $root "demo-app.err.log"
  $proc = Start-Process -FilePath $npmPath -ArgumentList "start" `
    -WorkingDirectory $root -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $logFile -RedirectStandardError $errLogFile

  $proc.Id | Out-File -FilePath $pidFile -Encoding ascii -Force

  Write-Host "   waiting for it to come up..." -ForegroundColor Yellow
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) { if (Test-AppUp) { $ready = $true; break }; Start-Sleep -Seconds 1 }
  if ($ready) { Write-Ok "LeadPilot is running." } else { Write-Bad "Timed out waiting for LeadPilot -- check demo-app.log"; exit 1 }
}

# ---------- Open the browser ----------
Start-Process "http://localhost:3000"

Write-Host "`n================================================" -ForegroundColor DarkGray
Write-Host " LeadPilot is live: http://localhost:3000" -ForegroundColor White
Write-Host " Agent dashboard:   http://localhost:3000/dashboard" -ForegroundColor White
Write-Host " Go run your demo. When you are done, run:" -ForegroundColor DarkGray
Write-Host "   powershell -ExecutionPolicy Bypass -File stop-demo.ps1" -ForegroundColor DarkGray
Write-Host "================================================`n" -ForegroundColor DarkGray
