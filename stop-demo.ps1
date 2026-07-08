# LeadPilot -- one-click shutdown for Windows.
# Stops the app. Leaves Ollama running by default (it is lightweight idle and
# keeping it up means the next demo starts instantly with no re-warm delay).
# Pass -All to also stop Ollama.
#
# Usage:  powershell -ExecutionPolicy Bypass -File stop-demo.ps1
#         powershell -ExecutionPolicy Bypass -File stop-demo.ps1 -All
param(
  [switch]$All
)

$root = $PSScriptRoot
Set-Location $root
$pidFile = Join-Path $root ".demo-app.pid"

function Write-Step($msg) { Write-Host "`n=> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "   $msg" -ForegroundColor Green }

Write-Step "Stopping LeadPilot"

$stopped = $false

# Preferred: use the PID we recorded when starting.
if (Test-Path $pidFile) {
  $savedId = Get-Content $pidFile -ErrorAction SilentlyContinue
  if ($savedId) {
    Stop-Process -Id $savedId -Force -ErrorAction SilentlyContinue
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

# Reliable fallback: kill whatever is actually listening on port 3000
# (covers the case where npm spawned a child node.exe, or the pid file is stale).
try {
  $procIds = (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop).OwningProcess | Sort-Object -Unique
  foreach ($procId in $procIds) {
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    $stopped = $true
  }
} catch { }

if ($stopped) { Write-Ok "LeadPilot stopped." } else { Write-Ok "LeadPilot was not running." }

if ($All) {
  Write-Step "Stopping Ollama"
  try {
    Get-Process -Name "ollama*" -ErrorAction Stop | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Ok "Ollama stopped."
  } catch {
    Write-Ok "Ollama was not running."
  }
} else {
  Write-Host "`n   (Ollama left running -- pass -All to stop it too)" -ForegroundColor DarkGray
}

Write-Host ""
