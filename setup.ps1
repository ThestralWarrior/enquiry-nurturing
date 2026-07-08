# LeadPilot -- one-shot setup for Windows: fresh clone to running app.
# Installs Ollama if missing, pulls both models, installs npm dependencies,
# creates .env.local, builds, and starts the demo. Safe to re-run any time --
# every step checks first and skips what's already done.
#
# Usage:  powershell -ExecutionPolicy Bypass -File setup.ps1
#         powershell -ExecutionPolicy Bypass -File setup.ps1 -SkipAnalyzeModel
#
# -SkipAnalyzeModel : only pull the chat model (qwen2.5:1.5b). Saves ~2 GB and
#                     some time; background lead analysis will just use the
#                     same small model instead of the more capable one.
param(
  [switch]$SkipAnalyzeModel
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

$chatModel = "qwen2.5:1.5b"
$analyzeModel = "qwen2.5:3b"

function Write-Step($msg) { Write-Host "`n=> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "   $msg" -ForegroundColor Green }
function Write-Bad($msg)  { Write-Host "   $msg" -ForegroundColor Red }

Write-Host "================================================" -ForegroundColor DarkGray
Write-Host " LeadPilot -- full setup" -ForegroundColor White
Write-Host " This installs everything needed and starts the app." -ForegroundColor DarkGray
Write-Host "================================================" -ForegroundColor DarkGray

# ---------- Node.js ----------
Write-Step "Checking Node.js"
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Bad "Node.js not found. Install the LTS version from https://nodejs.org, then re-run this script."
  exit 1
}
Write-Ok "Node.js $(node --version) found."

# ---------- Ollama ----------
Write-Step "Checking Ollama"
$ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
$ollamaExe = if ($ollamaCmd) { $ollamaCmd.Source } else { Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe" }

if (-not $ollamaCmd -and -not (Test-Path $ollamaExe)) {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    Write-Bad "Ollama not found and winget isn't available to install it automatically."
    Write-Bad "Install it manually from https://ollama.com/download, then re-run this script."
    exit 1
  }
  Write-Host "   Ollama not found -- installing via winget (downloads ~300 MB)..." -ForegroundColor Yellow
  winget install --id Ollama.Ollama --accept-package-agreements --accept-source-agreements --silent --disable-interactivity
  if (-not (Test-Path $ollamaExe)) {
    Write-Bad "Ollama install did not complete. Install manually from https://ollama.com/download and re-run this script."
    exit 1
  }
}
Write-Ok "Ollama is installed."

function Test-OllamaUp {
  try { Invoke-WebRequest "http://127.0.0.1:11434/api/version" -UseBasicParsing -TimeoutSec 3 | Out-Null; return $true }
  catch { return $false }
}

Write-Step "Starting Ollama server"
if (-not (Test-OllamaUp)) {
  Start-Process -FilePath $ollamaExe -ArgumentList "serve" -WindowStyle Hidden
  for ($i = 0; $i -lt 30; $i++) { if (Test-OllamaUp) { break }; Start-Sleep -Seconds 1 }
}
if (Test-OllamaUp) { Write-Ok "Ollama server is up." } else { Write-Bad "Could not reach Ollama."; exit 1 }

# ---------- Models ----------
function Test-ModelInstalled($name) {
  $tags = Invoke-RestMethod "http://127.0.0.1:11434/api/tags" -TimeoutSec 5
  return @($tags.models | ForEach-Object { $_.name }) -contains $name
}

Write-Step "Checking model: $chatModel (live buyer-facing chat)"
if (-not (Test-ModelInstalled $chatModel)) {
  Write-Host "   pulling $chatModel (~1 GB, one time)..." -ForegroundColor Yellow
  & $ollamaExe pull $chatModel
} else { Write-Ok "already installed." }

$haveAnalyzeModel = $false
if ($SkipAnalyzeModel) {
  Write-Step "Skipping $analyzeModel (-SkipAnalyzeModel passed)"
  Write-Host "   Background analysis will use $chatModel instead." -ForegroundColor DarkGray
} else {
  Write-Step "Checking model: $analyzeModel (background lead analysis)"
  if (-not (Test-ModelInstalled $analyzeModel)) {
    Write-Host "   pulling $analyzeModel (~2 GB, one time)..." -ForegroundColor Yellow
    & $ollamaExe pull $analyzeModel
  } else { Write-Ok "already installed." }
  $haveAnalyzeModel = Test-ModelInstalled $analyzeModel
}

# ---------- npm dependencies ----------
Write-Step "Installing npm dependencies"
if (-not (Test-Path (Join-Path $root "node_modules"))) {
  npm install
} else {
  Write-Ok "node_modules already present -- skipping (delete the folder to force a reinstall)."
}

# ---------- .env.local ----------
Write-Step "Configuring environment"
$envLocal = Join-Path $root ".env.local"
if (-not (Test-Path $envLocal)) {
  if ($haveAnalyzeModel) {
    @"
# Created by setup.ps1 -- see .env.example for what each of these does.
OLLAMA_ANALYZE_MODEL=$analyzeModel
"@ | Out-File -FilePath $envLocal -Encoding utf8
    Write-Ok "Created .env.local (chat uses $chatModel, analysis uses $analyzeModel)."
  } else {
    Write-Ok "Skipping .env.local (analysis will use $chatModel by default)."
  }
} else {
  Write-Ok ".env.local already exists -- leaving it as is."
}

# ---------- Build ----------
Write-Step "Building the app"
npm run build

Write-Host "`n================================================" -ForegroundColor DarkGray
Write-Host " Setup complete." -ForegroundColor White
Write-Host " Next time, just run:  powershell -ExecutionPolicy Bypass -File start-demo.ps1" -ForegroundColor DarkGray
Write-Host "================================================" -ForegroundColor DarkGray

# ---------- Launch ----------
Write-Step "Starting LeadPilot now"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "start-demo.ps1")
