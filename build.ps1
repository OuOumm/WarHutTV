# WarHutTV Build Script
# Usage: powershell -ExecutionPolicy Bypass -File build.ps1

$OriginalLocation = Get-Location
$OrigMiseShell = $env:MISE_SHELL
$env:MISE_SHELL = ''  # 临时禁用 mise prompt hook，避免 Invoke-Expression 解析含空格 PATH 出错
try {

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  WarHutTV Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Clean
Write-Host "`n[1/5] Cleaning..." -ForegroundColor Yellow
if (Test-Path "bin") { Remove-Item -Recurse -Force "bin" }
if (Test-Path "frontend\dist") { Remove-Item -Recurse -Force "frontend\dist" }
if (Test-Path "backend\frontend") { Remove-Item -Recurse -Force "backend\frontend" }
New-Item -ItemType Directory -Force -Path "bin" | Out-Null
Write-Host "  Done" -ForegroundColor Green

# 2. Build frontend
Write-Host "`n[2/5] Building frontend..." -ForegroundColor Yellow
Push-Location "frontend"
npm run build
$frontendOk = $LASTEXITCODE -eq 0
Pop-Location
if (-not $frontendOk) {
    Write-Host "  Frontend build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  Done" -ForegroundColor Green

# 3. Build backend
Write-Host "`n[3/5] Building backend..." -ForegroundColor Yellow
Push-Location "backend"
Copy-Item -Path "..\frontend\dist" -Destination "frontend\dist" -Recurse -Force

Write-Host "  Building Windows amd64..." -ForegroundColor Gray
$env:GOOS = "windows"
$env:GOARCH = "amd64"
go build -o "..\bin\warhutv-windows-amd64.exe" -ldflags="-s -w" .
$winOk = $LASTEXITCODE -eq 0
Remove-Item Env:GOOS -ErrorAction SilentlyContinue
Remove-Item Env:GOARCH -ErrorAction SilentlyContinue

Write-Host "  Building Linux amd64..." -ForegroundColor Gray
$env:GOOS = "linux"
$env:GOARCH = "amd64"
go build -o "..\bin\warhutv-linux-amd64" -ldflags="-s -w" .
$linOk = $LASTEXITCODE -eq 0
Remove-Item Env:GOOS -ErrorAction SilentlyContinue
Remove-Item Env:GOARCH -ErrorAction SilentlyContinue

Remove-Item -Recurse -Force "frontend" -ErrorAction SilentlyContinue
Pop-Location

if (-not $winOk -or -not $linOk) {
    Write-Host "  Backend build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  Done" -ForegroundColor Green

# 4. Compress with UPX
Write-Host "`n[4/5] Compressing with UPX..." -ForegroundColor Yellow
$upxAvailable = Get-Command upx -ErrorAction SilentlyContinue
if ($upxAvailable) {
    Write-Host "  Compressing Windows binary..." -ForegroundColor Gray
    upx --best --lzma "bin\warhutv-windows-amd64.exe" 2>&1 | Out-Null
    
    Write-Host "  Compressing Linux binary..." -ForegroundColor Gray
    upx --best --lzma "bin\warhutv-linux-amd64" 2>&1 | Out-Null
    
    Write-Host "  Done" -ForegroundColor Green
} else {
    Write-Host "  UPX not found, skipping compression" -ForegroundColor Yellow
}

# 5. Result
Write-Host "`n[5/5] Build Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nOutput files:" -ForegroundColor Yellow
Get-ChildItem "bin" -Recurse | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
    $name = $_.FullName.Replace((Get-Location).Path + "\", "")
    $mb = [math]::Round($_.Length / 1MB, 2)
    Write-Host ("  {0}  {1} MB" -f $name, $mb) -ForegroundColor Green
}

Write-Host ""

} finally {
    $env:MISE_SHELL = $OrigMiseShell
    Set-Location $OriginalLocation
}
