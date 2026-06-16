# WarHutTV Build Script
# Usage: powershell -ExecutionPolicy Bypass -File build.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  WarHutTV Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Clean
Write-Host "`n[1/6] Cleaning..." -ForegroundColor Yellow
if (Test-Path "bin") { Remove-Item -Recurse -Force "bin" }
if (Test-Path "frontend\dist") { Remove-Item -Recurse -Force "frontend\dist" }
if (Test-Path "backend\frontend") { Remove-Item -Recurse -Force "backend\frontend" }
New-Item -ItemType Directory -Force -Path "bin\data" | Out-Null
New-Item -ItemType Directory -Force -Path "bin\data\cache" | Out-Null
Write-Host "  Done" -ForegroundColor Green

# 2. Build frontend
Write-Host "`n[2/6] Building frontend..." -ForegroundColor Yellow
Push-Location "frontend"
npm run build
$frontendOk = $LASTEXITCODE -eq 0
Pop-Location
if (-not $frontendOk) {
    Write-Host "  Frontend build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  Done" -ForegroundColor Green

# 3. Copy frontend to backend
Write-Host "`n[3/6] Copying frontend..." -ForegroundColor Yellow
Copy-Item -Path "frontend\dist" -Destination "backend\frontend\dist" -Recurse -Force
Write-Host "  Done" -ForegroundColor Green

# 4. Build backend
Write-Host "`n[4/6] Building backend..." -ForegroundColor Yellow
Push-Location "backend"

Write-Host "  Building Windows amd64..." -ForegroundColor Gray
$env:GOOS = "windows"
$env:GOARCH = "amd64"
go build -o "..\bin\warhutv-windows-amd64.exe" -ldflags="-s -w" .
$winOk = $LASTEXITCODE -eq 0
Remove-Item Env:GOOS -ErrorAction SilentlyContinue
Remove-Item Env:GOARCH -ErrorAction SilentlyContinue
if (-not $winOk) {
    Pop-Location
    Write-Host "  Windows build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "  Building Linux amd64..." -ForegroundColor Gray
$env:GOOS = "linux"
$env:GOARCH = "amd64"
go build -o "..\bin\warhutv-linux-amd64" -ldflags="-s -w" .
$linOk = $LASTEXITCODE -eq 0
Remove-Item Env:GOOS -ErrorAction SilentlyContinue
Remove-Item Env:GOARCH -ErrorAction SilentlyContinue
Pop-Location

if (-not $linOk) {
    Write-Host "  Linux build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  Done" -ForegroundColor Green

# 5. Copy config (skip if already exists)
Write-Host "`n[5/6] Copying config..." -ForegroundColor Yellow
if (Test-Path "data\config.json") {
    if (Test-Path "bin\data\config.json") {
        Write-Host "  Skipped: bin\data\config.json already exists" -ForegroundColor Gray
    } else {
        Copy-Item -Path "data\config.json" -Destination "bin\data\config.json"
        Write-Host "  Done" -ForegroundColor Green
    }
} else {
    Write-Host "  Skipped: data\config.json not found" -ForegroundColor Gray
}

# 6. Cleanup
Write-Host "`n[6/6] Cleaning up..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "backend\frontend" -ErrorAction SilentlyContinue
Write-Host "  Done" -ForegroundColor Green

# Result
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nOutput files:" -ForegroundColor Yellow
Get-ChildItem "bin" -Recurse | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
    $name = $_.FullName.Replace((Get-Location).Path + "\", "")
    $mb = [math]::Round($_.Length / 1MB, 2)
    Write-Host ("  {0}  {1} MB" -f $name, $mb) -ForegroundColor Green
}

Write-Host ""
Write-Host "Run: cd bin && warhutv-windows-amd64.exe" -ForegroundColor Gray
