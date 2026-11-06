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
pnpm run build
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

# Version is injected so /api/version works even when the `version` file is not
# shipped next to the binary; -trimpath keeps local absolute paths out.
$Version = (Get-Content "..\version" -ErrorAction SilentlyContinue | Select-Object -First 1)
if (-not $Version) { $Version = "dev" }
$Version = $Version.Trim()
$LdFlags = "-s -w -X main.version=$Version"

# Platform list is kept in sync with build.sh and the README table.
$Targets = @(
    @{ GOOS = "windows"; GOARCH = "amd64"; Out = "warhutv-windows-amd64.exe" },
    @{ GOOS = "linux";   GOARCH = "amd64"; Out = "warhutv-linux-amd64" },
    @{ GOOS = "linux";   GOARCH = "arm64"; Out = "warhutv-linux-arm64" },
    @{ GOOS = "darwin";  GOARCH = "amd64"; Out = "warhutv-darwin-amd64" },
    @{ GOOS = "darwin";  GOARCH = "arm64"; Out = "warhutv-darwin-arm64" }
)

$failures = 0
foreach ($target in $Targets) {
    Write-Host ("  Building {0}/{1}..." -f $target.GOOS, $target.GOARCH) -ForegroundColor Gray
    $env:GOOS = $target.GOOS
    $env:GOARCH = $target.GOARCH
    $env:CGO_ENABLED = "0"
    go build -tags embed -trimpath -ldflags="$LdFlags" -o ("..\bin\" + $target.Out) .
    if ($LASTEXITCODE -ne 0) { $failures++ }
    Remove-Item Env:GOOS -ErrorAction SilentlyContinue
    Remove-Item Env:GOARCH -ErrorAction SilentlyContinue
    Remove-Item Env:CGO_ENABLED -ErrorAction SilentlyContinue
}

Remove-Item -Recurse -Force "frontend" -ErrorAction SilentlyContinue
Pop-Location

if ($failures -gt 0) {
    Write-Host "  Backend build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  Done" -ForegroundColor Green

# 4. Compress with UPX
Write-Host "`n[4/5] Compressing with UPX..." -ForegroundColor Yellow
$upxAvailable = Get-Command upx -ErrorAction SilentlyContinue
if ($upxAvailable) {
    # UPX only handles the binaries it understands; failures (e.g. darwin
    # Mach-O with --lzma) are non-fatal, so keep going and report at the end.
    foreach ($file in Get-ChildItem "bin" -File) {
        Write-Host ("  Compressing {0}..." -f $file.Name) -ForegroundColor Gray
        upx --best --lzma $file.FullName 2>&1 | Out-Null
    }
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
