param(
    [switch]$SkipNpmInstall,
    [switch]$SkipPipInstall
)

# Bootstrap both frontend and backend, then launch uvicorn once assets are built.
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSCommandPath
Push-Location $repoRoot

try {
    $venvPath = Join-Path $repoRoot ".venv"
    $venvPython = Join-Path $venvPath "Scripts/python.exe"

    if (-not (Test-Path $venvPython)) {
        Write-Host "Creating Python virtual environment (.venv)" -ForegroundColor Cyan
        python -m venv .venv
    }

    if (-not $SkipPipInstall) {
        Write-Host "Installing backend dependencies" -ForegroundColor Cyan
        & $venvPython -m pip install --upgrade pip | Out-Null
        & $venvPython -m pip install -r (Join-Path $repoRoot "backend/requirements.txt")
    }

    Push-Location (Join-Path $repoRoot "frontend")
    try {
        if (-not $SkipNpmInstall) {
            Write-Host "Installing frontend dependencies" -ForegroundColor Cyan
            npm install | Out-Null
        }

        Write-Host "Building React frontend" -ForegroundColor Cyan
        npm run build | Out-Null
    }
    finally {
        Pop-Location
    }

    Write-Host "Starting FastAPI server on http://0.0.0.0:8000 (reachable on your LAN IP)" -ForegroundColor Green
    & $venvPython -m uvicorn backend.main:app --reload --host 0.0.0.0
}
finally {
    Pop-Location
}